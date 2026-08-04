-- Shift Management, Holiday Calendar, tips, and richer Service Hub fields.

create table shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  shift_type text not null default 'custom' check (shift_type in ('morning', 'evening', 'custom', 'rotational')),
  start_time time not null,
  end_time time not null,
  days_of_week smallint[] not null default '{1,2,3,4,5}',
  created_at timestamptz not null default now(),
  unique (staff_id)
);

alter table shifts enable row level security;

create policy "shifts_select" on shifts for select
  using (staff_id = auth.uid() or can_view_branch(branch_id));
create policy "shifts_manage" on shifts for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

-- ============ Holiday calendar ============
create table holidays (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  name text not null,
  date date not null,
  created_at timestamptz not null default now()
);

alter table holidays enable row level security;

create policy "holidays_select_all" on holidays for select using (true);
create policy "holidays_manage" on holidays for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

-- ============ Tips ============
alter table payments add column tip_amount numeric(10,2) not null default 0;

-- ============ Service Hub: sub-categories + richer fields ============
alter table service_categories add column parent_category_id uuid references service_categories(id) on delete set null;

alter table services add column gender_focus text default 'all' check (gender_focus in ('all', 'female', 'male'));
alter table services add column room text;
alter table services add column equipment text;
alter table services add column tax_rate numeric(5,2) not null default 0;
alter table services add column commission_override numeric(5,2);
