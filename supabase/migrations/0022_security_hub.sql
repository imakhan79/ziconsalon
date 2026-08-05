-- Security Hub: configurable session-timeout duration + GDPR-style
-- account-deletion request (notifies admins; actual deletion stays a
-- manual admin action, not an automated cascade).
alter table business_settings add column session_timeout_minutes int not null default 30 check (session_timeout_minutes between 5 and 240);

create function request_account_deletion() returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_admin uuid;
begin
  select full_name into v_name from profiles where id = auth.uid();
  for v_admin in select id from profiles where role = 'admin' loop
    perform notify(
      v_admin, 'account_deletion_request', 'Account deletion requested',
      coalesce(v_name, 'A user') || ' has requested their account be deleted.', null, 'profile', auth.uid()
    );
  end loop;
end;
$$;
