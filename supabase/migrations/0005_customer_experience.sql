-- Customer Hub: loyalty points, membership plans, and reviews.

create table loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  points integer not null,
  type text not null check (type in ('earn', 'redeem', 'adjustment')),
  reason text,
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_loyalty_customer on loyalty_transactions(customer_id, created_at desc);

alter table loyalty_transactions enable row level security;

create policy "loyalty_select" on loyalty_transactions for select
  using (customer_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "loyalty_insert_staff" on loyalty_transactions for insert
  with check (is_staff_or_above(auth.uid()));

-- ============ Membership plans ============
create table membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  duration_months int not null default 12,
  discount_percent numeric(5,2) not null default 0,
  priority_booking boolean not null default false,
  benefits text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table membership_plans enable row level security;

create policy "membership_plans_select_all" on membership_plans for select using (true);
create policy "membership_plans_manage_admin" on membership_plans for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into membership_plans (name, price, discount_percent, priority_booking, benefits) values
  ('Silver', 49.00, 5, false, 'Priority reminders and 5% off all services.'),
  ('Gold', 99.00, 10, true, 'Priority booking, 10% off all services, and free birthday add-on.'),
  ('Premium', 199.00, 15, true, 'Priority booking, 15% off all services, complimentary product samples.');

-- ============ Customer memberships ============
create table customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references membership_plans(id),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_memberships_customer on customer_memberships(customer_id);

alter table customer_memberships enable row level security;

create policy "memberships_select" on customer_memberships for select
  using (customer_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "memberships_insert_self_or_staff" on customer_memberships for insert
  with check (customer_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "memberships_update_staff" on customer_memberships for update
  using (is_staff_or_above(auth.uid()));

-- ============ Reviews ============
create table reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

alter table reviews enable row level security;

create policy "reviews_select_all" on reviews for select using (true);
create policy "reviews_insert_own_completed" on reviews for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from appointments a
      where a.id = appointment_id and a.customer_id = auth.uid() and a.status = 'completed'
    )
  );
