-- Rich customer profile fields + staff-only customer notes + avatar storage.

alter table profiles add column gender text;
alter table profiles add column date_of_birth date;
alter table profiles add column preferred_staff_id uuid references staff(id) on delete set null;
alter table profiles add column allergies text;
alter table profiles add column beauty_preferences text;
alter table profiles add column communication_preferences jsonb not null default '{"email": true, "sms": true, "whatsapp": true}'::jsonb;
alter table profiles add column emergency_contact_name text;
alter table profiles add column emergency_contact_phone text;

-- Internal notes staff/managers keep about a customer — never exposed to the
-- customer themselves, hence a separate table rather than a profiles column
-- (profiles_update_own would otherwise let a customer edit their own file).
create table customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  note text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table customer_notes enable row level security;

create policy "customer_notes_staff_only" on customer_notes for all
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

-- ============ Avatar storage ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatar_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
