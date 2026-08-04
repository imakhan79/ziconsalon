-- Inventory Hub: vendors, purchase orders + receiving, inter-branch
-- transfers, expiry/batch tracking, barcode field, low-stock &
-- valuation views, and an atomic stock-adjustment RPC.

-- ============ Vendors ============
create table vendors (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ Products: barcode + default vendor ============
alter table products add column barcode text unique;
alter table products add column default_vendor_id uuid references vendors(id) on delete set null;

-- ============ Purchase orders ============
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique not null default
    ('PO-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  vendor_id uuid references vendors(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  ordered_at timestamptz,
  received_at timestamptz
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_ordered numeric(10,2) not null check (qty_ordered > 0),
  qty_received numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0
);

-- ============ Batch / expiry tracking ============
create table product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  batch_number text,
  qty numeric(10,2) not null default 0,
  expiry_date date,
  received_at timestamptz not null default now(),
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_product_batches_expiry on product_batches(expiry_date);

-- ============ Inter-branch stock transfers ============
create table stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text unique not null default
    ('TRF-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  from_branch_id uuid not null references branches(id),
  to_branch_id uuid not null references branches(id),
  status text not null default 'pending'
    check (status in ('pending', 'in_transit', 'completed', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (from_branch_id <> to_branch_id)
);

create table stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  from_product_id uuid not null references products(id),
  to_product_id uuid not null references products(id),
  qty numeric(10,2) not null check (qty > 0)
);

-- ============ Reporting views ============
create view low_stock_products
with (security_invoker = true) as
select * from products
where is_active and stock_qty <= reorder_level;

create view inventory_valuation
with (security_invoker = true) as
select branch_id, category, sum(stock_qty * cost_price) as total_value, sum(stock_qty) as total_qty
from products
where is_active
group by branch_id, category;

-- ============ RLS ============
alter table vendors enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table product_batches enable row level security;
alter table stock_transfers enable row level security;
alter table stock_transfer_items enable row level security;

create policy "vendors_select" on vendors for select
  using (can_view_branch(branch_id));
create policy "vendors_manage" on vendors for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "purchase_orders_select" on purchase_orders for select
  using (can_view_branch(branch_id));
create policy "purchase_orders_manage" on purchase_orders for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "purchase_order_items_select" on purchase_order_items for select
  using (can_view_branch((select branch_id from purchase_orders where id = purchase_order_id)));
create policy "purchase_order_items_manage" on purchase_order_items for all
  using (can_manage_branch((select branch_id from purchase_orders where id = purchase_order_id)))
  with check (can_manage_branch((select branch_id from purchase_orders where id = purchase_order_id)));

create policy "product_batches_select" on product_batches for select
  using (can_view_branch((select branch_id from products where id = product_id)));
create policy "product_batches_manage" on product_batches for all
  using (can_manage_branch((select branch_id from products where id = product_id)))
  with check (can_manage_branch((select branch_id from products where id = product_id)));

create policy "stock_transfers_select" on stock_transfers for select
  using (can_view_branch(from_branch_id) or can_view_branch(to_branch_id));
create policy "stock_transfers_manage" on stock_transfers for all
  using (can_manage_branch(from_branch_id) or can_manage_branch(to_branch_id))
  with check (can_manage_branch(from_branch_id) or can_manage_branch(to_branch_id));

create policy "stock_transfer_items_select" on stock_transfer_items for select
  using (
    can_view_branch((select from_branch_id from stock_transfers where id = transfer_id))
    or can_view_branch((select to_branch_id from stock_transfers where id = transfer_id))
  );
create policy "stock_transfer_items_manage" on stock_transfer_items for all
  using (
    can_manage_branch((select from_branch_id from stock_transfers where id = transfer_id))
    or can_manage_branch((select to_branch_id from stock_transfers where id = transfer_id))
  )
  with check (
    can_manage_branch((select from_branch_id from stock_transfers where id = transfer_id))
    or can_manage_branch((select to_branch_id from stock_transfers where id = transfer_id))
  );

-- ============ RPCs ============
-- Each RPC performs its own row-locked, atomic read-modify-write on
-- products.stock_qty + a matching inventory_transactions row, replacing
-- the old two-step (insert txn, then separately update stock_qty)
-- client-side pattern that was vulnerable to lost updates under
-- concurrent sales/adjustments.

create function adjust_stock(
  p_product_id uuid,
  p_qty_delta numeric,
  p_type text,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_branch uuid;
  v_stock numeric;
  v_new_stock numeric;
begin
  select branch_id, stock_qty into v_branch, v_stock from products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;
  if not (is_staff_or_above(auth.uid()) and can_view_branch(v_branch)) then
    raise exception 'Not authorized';
  end if;

  v_new_stock := v_stock + p_qty_delta;
  if v_new_stock < 0 and p_type <> 'adjustment' then
    raise exception 'Insufficient stock';
  end if;

  update products set stock_qty = v_new_stock where id = p_product_id;
  insert into inventory_transactions (product_id, type, qty, note, created_by)
  values (p_product_id, p_type::inventory_txn_type, p_qty_delta, p_note, auth.uid());
end;
$$;

create function receive_po_item(
  p_po_item_id uuid,
  p_qty_received numeric,
  p_batch_number text default null,
  p_expiry_date date default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_item purchase_order_items%rowtype;
  v_po purchase_orders%rowtype;
  v_stock numeric;
  v_all_received boolean;
begin
  if p_qty_received <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select * into v_item from purchase_order_items where id = p_po_item_id for update;
  if not found then
    raise exception 'Purchase order item not found';
  end if;
  select * into v_po from purchase_orders where id = v_item.purchase_order_id;
  if not can_manage_branch(v_po.branch_id) then
    raise exception 'Not authorized';
  end if;

  update purchase_order_items
  set qty_received = qty_received + p_qty_received
  where id = p_po_item_id;

  select stock_qty into v_stock from products where id = v_item.product_id for update;
  update products set stock_qty = v_stock + p_qty_received where id = v_item.product_id;
  insert into inventory_transactions (product_id, type, qty, note, created_by)
  values (v_item.product_id, 'purchase', p_qty_received, 'PO receipt ' || v_po.po_number, auth.uid());

  if p_batch_number is not null or p_expiry_date is not null then
    insert into product_batches (product_id, batch_number, qty, expiry_date, purchase_order_id)
    values (v_item.product_id, p_batch_number, p_qty_received, p_expiry_date, v_po.id);
  end if;

  select bool_and(qty_received >= qty_ordered) into v_all_received
  from purchase_order_items where purchase_order_id = v_po.id;

  update purchase_orders
  set status = case when v_all_received then 'received' else 'partially_received' end,
      received_at = case when v_all_received then now() else received_at end
  where id = v_po.id;
end;
$$;

create function complete_stock_transfer(p_transfer_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_transfer stock_transfers%rowtype;
  v_item record;
  v_from_stock numeric;
  v_to_stock numeric;
begin
  select * into v_transfer from stock_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'Transfer not found';
  end if;
  if v_transfer.status = 'completed' then
    raise exception 'Transfer already completed';
  end if;
  if not can_manage_branch(v_transfer.from_branch_id) then
    raise exception 'Not authorized';
  end if;

  for v_item in select * from stock_transfer_items where transfer_id = p_transfer_id loop
    select stock_qty into v_from_stock from products where id = v_item.from_product_id for update;
    if v_from_stock < v_item.qty then
      raise exception 'Insufficient stock for transfer item %', v_item.id;
    end if;
    update products set stock_qty = v_from_stock - v_item.qty where id = v_item.from_product_id;
    insert into inventory_transactions (product_id, type, qty, note, created_by)
    values (v_item.from_product_id, 'transfer_out', -v_item.qty, 'Transfer ' || v_transfer.transfer_number, auth.uid());

    select stock_qty into v_to_stock from products where id = v_item.to_product_id for update;
    update products set stock_qty = v_to_stock + v_item.qty where id = v_item.to_product_id;
    insert into inventory_transactions (product_id, type, qty, note, created_by)
    values (v_item.to_product_id, 'transfer_in', v_item.qty, 'Transfer ' || v_transfer.transfer_number, auth.uid());
  end loop;

  update stock_transfers set status = 'completed', completed_at = now() where id = p_transfer_id;
end;
$$;

create function write_off_batch(p_batch_id uuid, p_qty numeric, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_batch product_batches%rowtype;
  v_branch uuid;
  v_stock numeric;
begin
  if p_qty <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select * into v_batch from product_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch not found';
  end if;
  if p_qty > v_batch.qty then
    raise exception 'Cannot write off more than remaining batch quantity';
  end if;

  select branch_id, stock_qty into v_branch, v_stock from products where id = v_batch.product_id for update;
  if not can_manage_branch(v_branch) then
    raise exception 'Not authorized';
  end if;

  update products set stock_qty = greatest(0, v_stock - p_qty) where id = v_batch.product_id;
  insert into inventory_transactions (product_id, type, qty, note, created_by)
  values (v_batch.product_id, 'write_off', -p_qty, coalesce(p_reason, 'Expired stock write-off'), auth.uid());

  update product_batches set qty = qty - p_qty where id = p_batch_id;
end;
$$;
