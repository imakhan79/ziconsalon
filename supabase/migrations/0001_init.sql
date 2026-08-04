-- Ziconsalon: Beauty Salon Management Software — core MVP schema
-- Roles: admin, manager, staff, customer

create type user_role as enum ('admin', 'manager', 'staff', 'customer');
create type appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type invoice_status as enum ('unpaid', 'partial', 'paid', 'refunded', 'void');
create type payment_method as enum ('cash', 'card', 'bank_transfer', 'wallet', 'other');
create type inventory_txn_type as enum ('purchase', 'sale', 'adjustment', 'return');

-- ============ Profiles (one row per auth.users, shared identity for staff/customers) ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  role user_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function is_staff_or_above(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = uid and role in ('admin', 'manager', 'staff')
  );
$$;

create function is_manager_or_above(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = uid and role in ('admin', 'manager')
  );
$$;

-- ============ Staff detail ============
create table staff (
  id uuid primary key references profiles(id) on delete cascade,
  title text,
  specialization text,
  commission_rate numeric(5,2) not null default 0,
  hired_at date,
  bio text
);

-- ============ Service catalog ============
create table service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

create table services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  description text,
  duration_minutes int not null default 30,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table staff_services (
  staff_id uuid not null references staff(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ============ Appointments ============
create table appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status appointment_status not null default 'pending',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id uuid not null references services(id),
  price numeric(10,2) not null,
  duration_minutes int not null
);

create index idx_appointments_customer on appointments(customer_id);
create index idx_appointments_staff on appointments(staff_id);
create index idx_appointments_start on appointments(start_time);

-- ============ Products / Inventory ============
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text,
  cost_price numeric(10,2) not null default 0,
  sell_price numeric(10,2) not null default 0,
  stock_qty numeric(10,2) not null default 0,
  reorder_level numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type inventory_txn_type not null,
  qty numeric(10,2) not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ Billing ============
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null default ('INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  customer_id uuid not null references profiles(id),
  appointment_id uuid references appointments(id) on delete set null,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status invoice_status not null default 'unpaid',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  service_id uuid references services(id),
  product_id uuid references products(id),
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(10,2) not null,
  method payment_method not null default 'cash',
  reference text,
  received_by uuid references profiles(id),
  paid_at timestamptz not null default now()
);

-- ============ Finance: expenses ============
create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ Marketing ============
create table promotions (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ Business settings ============
create table business_settings (
  id int primary key default 1,
  business_name text not null default 'My Salon',
  address text,
  phone text,
  currency text not null default 'USD',
  opening_hours jsonb not null default '{}'::jsonb,
  check (id = 1)
);
insert into business_settings (id) values (1);

-- ==================================================================
-- Row Level Security
-- ==================================================================
alter table profiles enable row level security;
alter table staff enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table staff_services enable row level security;
alter table appointments enable row level security;
alter table appointment_items enable row level security;
alter table products enable row level security;
alter table inventory_transactions enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table promotions enable row level security;
alter table business_settings enable row level security;

-- profiles
create policy "profiles_select_own_or_staff" on profiles for select
  using (id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_staff" on profiles for update
  using (is_manager_or_above(auth.uid()));

-- staff
create policy "staff_select_all_authenticated" on staff for select
  using (auth.uid() is not null);
create policy "staff_manage_managers" on staff for all
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));

-- service catalog: public read for booking widgets, staff manage
create policy "service_categories_select_all" on service_categories for select using (true);
create policy "service_categories_manage_staff" on service_categories for all
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));

create policy "services_select_all" on services for select using (true);
create policy "services_manage_staff" on services for all
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));

create policy "staff_services_select_all" on staff_services for select using (true);
create policy "staff_services_manage_staff" on staff_services for all
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));

-- appointments
create policy "appointments_select_own_or_staff" on appointments for select
  using (customer_id = auth.uid() or staff_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "appointments_insert_own_or_staff" on appointments for insert
  with check (customer_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "appointments_update_own_or_staff" on appointments for update
  using (customer_id = auth.uid() or staff_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "appointments_delete_staff" on appointments for delete
  using (is_staff_or_above(auth.uid()));

create policy "appointment_items_select" on appointment_items for select
  using (exists (select 1 from appointments a where a.id = appointment_id
    and (a.customer_id = auth.uid() or a.staff_id = auth.uid() or is_staff_or_above(auth.uid()))));
create policy "appointment_items_manage_staff" on appointment_items for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

-- inventory: staff only
create policy "products_select_staff" on products for select using (is_staff_or_above(auth.uid()));
create policy "products_manage_staff" on products for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

create policy "inventory_txn_select_staff" on inventory_transactions for select using (is_staff_or_above(auth.uid()));
create policy "inventory_txn_manage_staff" on inventory_transactions for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

-- billing
create policy "invoices_select_own_or_staff" on invoices for select
  using (customer_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "invoices_manage_staff" on invoices for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

create policy "invoice_items_select" on invoice_items for select
  using (exists (select 1 from invoices i where i.id = invoice_id
    and (i.customer_id = auth.uid() or is_staff_or_above(auth.uid()))));
create policy "invoice_items_manage_staff" on invoice_items for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

create policy "payments_select" on payments for select
  using (exists (select 1 from invoices i where i.id = invoice_id
    and (i.customer_id = auth.uid() or is_staff_or_above(auth.uid()))));
create policy "payments_manage_staff" on payments for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

-- finance & marketing: manager+
create policy "expenses_manage_managers" on expenses for all
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));

create policy "promotions_select_all" on promotions for select using (true);
create policy "promotions_manage_managers" on promotions for all
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));

create policy "business_settings_select_all" on business_settings for select using (true);
create policy "business_settings_manage_admin" on business_settings for update
  using (is_manager_or_above(auth.uid())) with check (is_manager_or_above(auth.uid()));
