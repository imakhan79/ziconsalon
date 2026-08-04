-- Finance Hub: POS support (walk-ins, packages, gift cards, store credit),
-- refund management with approval workflow, daily cash-session closing,
-- and a log for not-yet-connected receipt delivery channels.

-- ============ Walk-in sales + service charge on invoices ============
alter table invoices alter column customer_id drop not null;
alter table invoices add column walk_in_name text;
alter table invoices add constraint invoices_customer_or_walkin_check
  check (customer_id is not null or walk_in_name is not null);
alter table invoices add column service_charge numeric(10,2) not null default 0;

-- ============ Service packages (package billing) ============
create table service_packages (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table service_package_items (
  package_id uuid not null references service_packages(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  quantity int not null default 1,
  primary key (package_id, service_id)
);

alter table invoice_items add column package_id uuid references service_packages(id) on delete set null;

-- ============ Gift cards (also used for "voucher" redemption) ============
create table gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default ('GC-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  branch_id uuid references branches(id) on delete set null,
  initial_value numeric(10,2) not null check (initial_value > 0),
  balance numeric(10,2) not null,
  issued_to uuid references profiles(id) on delete set null,
  issued_by uuid references profiles(id),
  is_active boolean not null default true,
  expires_at date,
  created_at timestamptz not null default now()
);

create table gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references gift_cards(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  amount numeric(10,2) not null,
  type text not null check (type in ('issue', 'redeem', 'adjustment')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_gift_card_txns_card on gift_card_transactions(gift_card_id);

-- ============ Refunds (approval workflow) ============
create table refunds (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  type text not null check (type in ('full', 'partial')),
  reason text,
  refund_method text not null default 'original_payment'
    check (refund_method in ('original_payment', 'store_credit', 'cash')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  credit_note_number text,
  created_at timestamptz not null default now()
);

create index idx_refunds_invoice on refunds(invoice_id);
create index idx_refunds_branch_status on refunds(branch_id, status);

-- ============ Store credit ledger ============
create table store_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  reason text,
  invoice_id uuid references invoices(id) on delete set null,
  refund_id uuid references refunds(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_store_credit_customer on store_credit_transactions(customer_id);

create view store_credit_balances
with (security_invoker = true) as
select customer_id, sum(amount) as balance
from store_credit_transactions
group by customer_id;

-- ============ Daily cash closing ============
create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  opened_by uuid references profiles(id),
  opened_at timestamptz not null default now(),
  opening_float numeric(10,2) not null default 0,
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  counted_cash numeric(10,2),
  bank_deposit_amount numeric(10,2),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create unique index cash_sessions_one_open_per_branch on cash_sessions(branch_id) where status = 'open';

-- ============ Receipt delivery log (email/WhatsApp not yet connected) ============
create table communications_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ RLS ============
alter table service_packages enable row level security;
alter table service_package_items enable row level security;
alter table gift_cards enable row level security;
alter table gift_card_transactions enable row level security;
alter table refunds enable row level security;
alter table store_credit_transactions enable row level security;
alter table cash_sessions enable row level security;
alter table communications_log enable row level security;

create policy "service_packages_select" on service_packages for select
  using (is_staff_or_above(auth.uid()));
create policy "service_packages_manage" on service_packages for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "service_package_items_select" on service_package_items for select
  using (is_staff_or_above(auth.uid()));
create policy "service_package_items_manage" on service_package_items for all
  using (can_manage_branch((select branch_id from service_packages where id = package_id)))
  with check (can_manage_branch((select branch_id from service_packages where id = package_id)));

create policy "gift_cards_select" on gift_cards for select
  using (is_staff_or_above(auth.uid()) or issued_to = auth.uid());
create policy "gift_cards_insert" on gift_cards for insert
  with check (is_staff_or_above(auth.uid()) and can_view_branch(branch_id));
create policy "gift_cards_update" on gift_cards for update
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "gift_card_txns_select" on gift_card_transactions for select
  using (
    is_staff_or_above(auth.uid())
    or exists (select 1 from gift_cards g where g.id = gift_card_id and g.issued_to = auth.uid())
  );
create policy "gift_card_txns_insert" on gift_card_transactions for insert
  with check (
    is_staff_or_above(auth.uid())
    and can_view_branch((select branch_id from gift_cards where id = gift_card_id))
  );

create policy "refunds_select" on refunds for select
  using (can_view_branch(branch_id) or requested_by = auth.uid());

create policy "store_credit_select" on store_credit_transactions for select
  using (is_staff_or_above(auth.uid()) or customer_id = auth.uid());

create policy "cash_sessions_select" on cash_sessions for select
  using (can_view_branch(branch_id));
create policy "cash_sessions_insert" on cash_sessions for insert
  with check (is_staff_or_above(auth.uid()) and can_view_branch(branch_id));
create policy "cash_sessions_update" on cash_sessions for update
  using (is_staff_or_above(auth.uid()) and can_view_branch(branch_id))
  with check (is_staff_or_above(auth.uid()) and can_view_branch(branch_id));

create policy "communications_log_select" on communications_log for select
  using (is_staff_or_above(auth.uid()));
create policy "communications_log_insert" on communications_log for insert
  with check (is_staff_or_above(auth.uid()));

-- ============ RPCs ============
-- refunds and store-credit issuance are only ever written through these
-- functions (no direct insert/update policy on `refunds`), so approval
-- rules stay centralized in one place instead of scattered client checks.

create function redeem_gift_card(p_code text, p_amount numeric, p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_card gift_cards%rowtype;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into v_card from gift_cards where code = p_code and is_active for update;
  if not found then
    raise exception 'Gift card not found or inactive';
  end if;
  if v_card.expires_at is not null and v_card.expires_at < current_date then
    raise exception 'Gift card has expired';
  end if;
  if v_card.balance < p_amount then
    raise exception 'Insufficient gift card balance';
  end if;

  update gift_cards set balance = balance - p_amount where id = v_card.id;
  insert into gift_card_transactions (gift_card_id, invoice_id, amount, type, created_by)
  values (v_card.id, p_invoice_id, -p_amount, 'redeem', auth.uid());
end;
$$;

create function redeem_store_credit(p_customer_id uuid, p_amount numeric, p_invoice_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_balance numeric;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from store_credit_transactions where customer_id = p_customer_id;

  if v_balance < p_amount then
    raise exception 'Insufficient store credit balance';
  end if;

  insert into store_credit_transactions (customer_id, amount, reason, invoice_id, created_by)
  values (p_customer_id, -p_amount, 'POS redemption', p_invoice_id, auth.uid());
end;
$$;

create function request_refund(
  p_invoice_id uuid,
  p_amount numeric,
  p_type text,
  p_reason text,
  p_refund_method text default 'original_payment'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_branch_id uuid;
  v_customer_id uuid;
  v_can_manage boolean;
  v_refund_id uuid;
  v_credit_note text;
  v_manager uuid;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_type not in ('full', 'partial') then
    raise exception 'Invalid refund type';
  end if;

  select branch_id, customer_id into v_branch_id, v_customer_id from invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if not can_view_branch(v_branch_id) then
    raise exception 'Not authorized for this invoice';
  end if;

  v_can_manage := can_manage_branch(v_branch_id);

  insert into refunds (invoice_id, branch_id, amount, type, reason, refund_method, status, requested_by, reviewed_by, reviewed_at)
  values (
    p_invoice_id, v_branch_id, p_amount, p_type, p_reason, p_refund_method,
    case when v_can_manage then 'approved' else 'pending' end,
    auth.uid(),
    case when v_can_manage then auth.uid() else null end,
    case when v_can_manage then now() else null end
  )
  returning id into v_refund_id;

  if v_can_manage then
    v_credit_note := 'CN-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);
    update refunds set credit_note_number = v_credit_note where id = v_refund_id;

    update invoices
    set status = case when p_type = 'full' then 'refunded'::invoice_status else status end
    where id = p_invoice_id;

    if p_refund_method = 'store_credit' and v_customer_id is not null then
      insert into store_credit_transactions (customer_id, amount, reason, invoice_id, refund_id, created_by)
      values (v_customer_id, p_amount, 'Refund credit', p_invoice_id, v_refund_id, auth.uid());
    end if;

    if v_customer_id is not null then
      perform notify(v_customer_id, 'refund', 'Refund processed', 'Your refund of ' || p_amount::text || ' has been approved.', null, 'refund', v_refund_id);
    end if;
  else
    for v_manager in
      select id from profiles
      where role = 'admin' or (role = 'manager' and branch_id is not distinct from v_branch_id)
    loop
      perform notify(v_manager, 'refund_pending', 'Refund needs approval', 'A refund of ' || p_amount::text || ' is awaiting your approval.', null, 'refund', v_refund_id);
    end loop;
  end if;

  return v_refund_id;
end;
$$;

create function review_refund(p_refund_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_refund refunds%rowtype;
  v_credit_note text;
  v_customer_id uuid;
begin
  select * into v_refund from refunds where id = p_refund_id for update;
  if not found then
    raise exception 'Refund not found';
  end if;
  if v_refund.status <> 'pending' then
    raise exception 'Refund already reviewed';
  end if;
  if not can_manage_branch(v_refund.branch_id) then
    raise exception 'Not authorized to review this refund';
  end if;

  select customer_id into v_customer_id from invoices where id = v_refund.invoice_id;

  if p_approve then
    v_credit_note := 'CN-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);
    update refunds
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), credit_note_number = v_credit_note,
        reason = coalesce(reason, '') || case when p_notes is not null then E'\n[Review] ' || p_notes else '' end
    where id = p_refund_id;

    update invoices
    set status = case when v_refund.type = 'full' then 'refunded'::invoice_status else status end
    where id = v_refund.invoice_id;

    if v_refund.refund_method = 'store_credit' and v_customer_id is not null then
      insert into store_credit_transactions (customer_id, amount, reason, invoice_id, refund_id, created_by)
      values (v_customer_id, v_refund.amount, 'Refund credit', v_refund.invoice_id, p_refund_id, auth.uid());
    end if;

    if v_customer_id is not null then
      perform notify(v_customer_id, 'refund', 'Refund approved', 'Your refund of ' || v_refund.amount::text || ' has been approved.', null, 'refund', p_refund_id);
    end if;
  else
    update refunds
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        reason = coalesce(reason, '') || case when p_notes is not null then E'\n[Review] ' || p_notes else '' end
    where id = p_refund_id;

    perform notify(v_refund.requested_by, 'refund_rejected', 'Refund rejected', coalesce(p_notes, 'Your refund request was rejected.'), null, 'refund', p_refund_id);
  end if;
end;
$$;
