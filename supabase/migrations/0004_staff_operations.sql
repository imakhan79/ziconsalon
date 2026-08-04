-- Staff Member operations: attendance tracking and leave requests, plus
-- letting a staff member self-manage which services they're assigned to.

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  work_date date not null default current_date,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'half_day', 'overtime', 'leave')),
  created_at timestamptz not null default now(),
  unique (staff_id, work_date)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_attendance_staff on attendance_records(staff_id, work_date desc);
create index idx_leave_staff on leave_requests(staff_id, created_at desc);

alter table attendance_records enable row level security;
alter table leave_requests enable row level security;

create policy "attendance_select" on attendance_records for select
  using (staff_id = auth.uid() or can_view_branch(branch_id));
create policy "attendance_insert_self" on attendance_records for insert
  with check (staff_id = auth.uid());
create policy "attendance_update" on attendance_records for update
  using (staff_id = auth.uid() or can_manage_branch(branch_id));

create policy "leave_select" on leave_requests for select
  using (staff_id = auth.uid() or can_view_branch(branch_id));
create policy "leave_insert_self" on leave_requests for insert
  with check (staff_id = auth.uid());
create policy "leave_update_own_pending" on leave_requests for update
  using ((staff_id = auth.uid() and status = 'pending') or can_manage_branch(branch_id));

-- Let a staff member assign themselves to the services they perform,
-- in addition to the existing manager-controlled policy.
create policy "staff_services_manage_self" on staff_services for all
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());
