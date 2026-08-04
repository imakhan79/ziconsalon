-- Staff Hub / HR: employee details, compensation (kept separate from the
-- broadly-readable staff table so customers can't read salaries),
-- documents.

alter table staff add column qualifications text;
alter table staff add column skills text;
alter table staff add column employment_type text default 'full_time' check (employment_type in ('full_time', 'part_time', 'contract'));
alter table staff add column annual_leave_days int not null default 20;

-- staff itself is broadly readable ("staff_select_all_authenticated": any
-- authenticated user, including customers, for display purposes like
-- booking dropdowns). Salary must not ride along on that policy.
create table staff_compensation (
  staff_id uuid primary key references staff(id) on delete cascade,
  salary numeric(10,2),
  updated_at timestamptz not null default now()
);

alter table staff_compensation enable row level security;

create policy "compensation_select" on staff_compensation for select
  using (staff_id = auth.uid() or can_view_branch((select branch_id from profiles where id = staff_id)));
create policy "compensation_manage" on staff_compensation for all
  using (can_manage_branch((select branch_id from profiles where id = staff_id)))
  with check (can_manage_branch((select branch_id from profiles where id = staff_id)));

-- ============ Staff documents ============
create table staff_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  name text not null,
  file_url text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table staff_documents enable row level security;

create policy "staff_documents_select" on staff_documents for select
  using (staff_id = auth.uid() or is_staff_or_above(auth.uid()));
create policy "staff_documents_manage" on staff_documents for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

insert into storage.buckets (id, name, public)
values ('staff-documents', 'staff-documents', false)
on conflict (id) do nothing;

create policy "staff_docs_read" on storage.objects for select
  using (bucket_id = 'staff-documents' and is_staff_or_above(auth.uid()));
create policy "staff_docs_write" on storage.objects for insert
  with check (bucket_id = 'staff-documents' and is_staff_or_above(auth.uid()));
create policy "staff_docs_delete" on storage.objects for delete
  using (bucket_id = 'staff-documents' and is_staff_or_above(auth.uid()));
