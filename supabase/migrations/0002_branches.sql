-- Multi-branch architecture: branches table, branch_id on operational tables,
-- branch-scoped RLS (admin/"Super Administrator" stays unrestricted;
-- manager/"Branch Administrator" and staff are scoped to their own branch).

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  address text,
  phone text,
  email text,
  timezone text not null default 'UTC',
  opening_hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into branches (name, code) values ('Main Branch', 'MAIN');

-- ============ branch_id columns ============
alter table profiles add column branch_id uuid references branches(id) on delete set null;
alter table appointments add column branch_id uuid references branches(id) on delete set null;
alter table products add column branch_id uuid references branches(id) on delete set null;
alter table services add column branch_id uuid references branches(id) on delete set null;
alter table promotions add column branch_id uuid references branches(id) on delete set null;
alter table expenses add column branch_id uuid references branches(id) on delete set null;
alter table invoices add column branch_id uuid references branches(id) on delete set null;

-- Backfill existing operational rows to the default branch. Services/promotions
-- are left null (meaning "all branches") since they were already shared catalog-wide.
do $$
declare main_branch_id uuid;
begin
  select id into main_branch_id from branches where code = 'MAIN';

  update profiles set branch_id = main_branch_id where role in ('admin', 'manager', 'staff');
  update appointments set branch_id = main_branch_id;
  update products set branch_id = main_branch_id;
  update expenses set branch_id = main_branch_id;
  update invoices set branch_id = main_branch_id;
end $$;

create index idx_appointments_branch on appointments(branch_id);
create index idx_products_branch on products(branch_id);
create index idx_invoices_branch on invoices(branch_id);
create index idx_profiles_branch on profiles(branch_id);

-- ============ Branch-scoping helper functions ============
create function is_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

-- Admin can view/manage any branch; manager/staff only their own (null-safe compare).
create function can_view_branch(target_branch uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (role in ('manager', 'staff') and branch_id is not distinct from target_branch)
      )
  );
$$;

create function can_manage_branch(target_branch uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (role = 'manager' and branch_id is not distinct from target_branch)
      )
  );
$$;

-- ============ branches RLS ============
alter table branches enable row level security;

create policy "branches_select_authenticated" on branches for select
  using (auth.uid() is not null);
create policy "branches_manage_admin" on branches for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ============ Re-scope existing policies to be branch-aware ============

-- profiles: managers may only manage profiles within their own branch; admin unrestricted.
drop policy "profiles_update_staff" on profiles;
create policy "profiles_update_staff" on profiles for update
  using (can_manage_branch(branch_id));

-- staff: managers may only manage staff within their own branch; admin unrestricted.
drop policy "staff_manage_managers" on staff;
create policy "staff_manage_managers" on staff for all
  using (can_manage_branch((select branch_id from profiles where id = staff.id)))
  with check (can_manage_branch((select branch_id from profiles where id = staff.id)));

-- appointments: branch-scope the staff-wide visibility clause.
drop policy "appointments_select_own_or_staff" on appointments;
create policy "appointments_select_own_or_staff" on appointments for select
  using (customer_id = auth.uid() or staff_id = auth.uid() or can_view_branch(branch_id));

drop policy "appointments_insert_own_or_staff" on appointments;
create policy "appointments_insert_own_or_staff" on appointments for insert
  with check (customer_id = auth.uid() or can_view_branch(branch_id));

drop policy "appointments_update_own_or_staff" on appointments;
create policy "appointments_update_own_or_staff" on appointments for update
  using (customer_id = auth.uid() or staff_id = auth.uid() or can_view_branch(branch_id));

drop policy "appointments_delete_staff" on appointments;
create policy "appointments_delete_staff" on appointments for delete
  using (can_manage_branch(branch_id));

-- products / inventory_transactions: branch-scoped.
drop policy "products_select_staff" on products;
create policy "products_select_staff" on products for select using (can_view_branch(branch_id));
drop policy "products_manage_staff" on products;
create policy "products_manage_staff" on products for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

drop policy "inventory_txn_select_staff" on inventory_transactions;
create policy "inventory_txn_select_staff" on inventory_transactions for select
  using (can_view_branch((select branch_id from products where id = product_id)));
drop policy "inventory_txn_manage_staff" on inventory_transactions;
create policy "inventory_txn_manage_staff" on inventory_transactions for all
  using (can_manage_branch((select branch_id from products where id = product_id)))
  with check (can_manage_branch((select branch_id from products where id = product_id)));

-- invoices: branch-scoped staff-wide visibility, customer's own invoices unaffected.
drop policy "invoices_select_own_or_staff" on invoices;
create policy "invoices_select_own_or_staff" on invoices for select
  using (customer_id = auth.uid() or can_view_branch(branch_id));
drop policy "invoices_manage_staff" on invoices;
create policy "invoices_manage_staff" on invoices for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

comment on table branches is 'Physical salon locations. A null branch_id on other tables means "applies to all branches".';
