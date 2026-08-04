-- Managers/admins need to be able to create an attendance record for a
-- staff member directly (e.g. marking someone absent/on-leave for a day
-- they never clocked in) — the original policy only allowed self-insert.
create policy "attendance_insert_manager" on attendance_records for insert
  with check (can_manage_branch(branch_id));
