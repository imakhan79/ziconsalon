-- Scheduled notification checks via pg_cron: appointment reminders, membership
-- expiry warnings, birthday greetings, staff shift reminders, and attendance
-- alerts. Dedup is done by checking the notifications table for an existing
-- row (per entity + type, scoped to a relevant time window) rather than
-- adding tracking columns to every source table.
--
-- Shift times are compared against `localtime` (session/server time, UTC on
-- Supabase) rather than each branch's own timezone — a known simplification.

create extension if not exists pg_cron;

create function notify_and_log(
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text,
  p_entity_type text default null,
  p_entity_id uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_prefs jsonb;
  v_name text;
begin
  select communication_preferences, full_name into v_prefs, v_name from profiles where id = p_recipient;
  if v_name is null then
    return;
  end if;

  perform notify(p_recipient, p_type, p_title, p_message, null, p_entity_type, p_entity_id);

  if coalesce(v_prefs ->> 'email', 'true') = 'true' then
    insert into communications_log (channel, recipient, customer_id, status)
    values ('email', v_name, p_recipient, 'pending');
  end if;
  if coalesce(v_prefs ->> 'sms', 'true') = 'true' then
    insert into communications_log (channel, recipient, customer_id, status)
    values ('sms', v_name, p_recipient, 'pending');
  end if;
  if coalesce(v_prefs ->> 'whatsapp', 'true') = 'true' then
    insert into communications_log (channel, recipient, customer_id, status)
    values ('whatsapp', v_name, p_recipient, 'pending');
  end if;
end;
$$;

create function run_scheduled_notifications() returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_appt record;
  v_member record;
  v_cust record;
  v_shift record;
  v_alert record;
  v_manager uuid;
begin
  -- Appointment reminders: appointments starting ~24h from now.
  for v_appt in
    select a.id, a.customer_id, a.start_time
    from appointments a
    where a.status in ('pending', 'confirmed')
      and a.start_time between now() + interval '23 hours' and now() + interval '25 hours'
      and not exists (
        select 1 from notifications n
        where n.entity_type = 'appointment' and n.entity_id = a.id and n.type = 'appointment_reminder'
      )
  loop
    perform notify_and_log(
      v_appt.customer_id, 'appointment_reminder', 'Appointment reminder',
      'You have an appointment tomorrow at ' || to_char(v_appt.start_time, 'HH12:MI AM') || '.',
      'appointment', v_appt.id
    );
  end loop;

  -- Membership expiry: active memberships expiring within 7 days.
  for v_member in
    select cm.id, cm.customer_id, cm.expires_at, mp.name as plan_name
    from customer_memberships cm
    join membership_plans mp on mp.id = cm.plan_id
    where cm.status = 'active'
      and cm.expires_at between now() and now() + interval '7 days'
      and not exists (
        select 1 from notifications n
        where n.entity_type = 'membership' and n.entity_id = cm.id and n.type = 'membership_expiry'
          and n.created_at > cm.expires_at - interval '10 days'
      )
  loop
    perform notify_and_log(
      v_member.customer_id, 'membership_expiry', 'Membership expiring soon',
      'Your ' || v_member.plan_name || ' membership expires on ' || to_char(v_member.expires_at, 'PP') || '.',
      'membership', v_member.id
    );
  end loop;

  -- Birthday greetings: customers whose birthday is today, once per year.
  for v_cust in
    select p.id, p.full_name from profiles p
    where p.role = 'customer' and p.is_active and p.date_of_birth is not null
      and extract(month from p.date_of_birth) = extract(month from current_date)
      and extract(day from p.date_of_birth) = extract(day from current_date)
      and not exists (
        select 1 from notifications n
        where n.entity_type = 'profile' and n.entity_id = p.id and n.type = 'birthday_greeting'
          and n.created_at > date_trunc('year', now())
      )
  loop
    perform notify_and_log(
      v_cust.id, 'birthday_greeting', 'Happy Birthday!',
      'Happy birthday, ' || v_cust.full_name || '! Enjoy a special treat on us at your next visit.',
      'profile', v_cust.id
    );
  end loop;

  -- Staff shift reminders: shifts starting within the next 2 hours today.
  for v_shift in
    select s.id, s.staff_id, s.start_time
    from shifts s
    where extract(dow from current_date)::int = any(s.days_of_week)
      and s.start_time between localtime and localtime + interval '2 hours'
      and not exists (
        select 1 from notifications n
        where n.entity_type = 'shift' and n.entity_id = s.id and n.type = 'staff_shift_reminder'
          and n.created_at::date = current_date
      )
  loop
    perform notify_and_log(
      v_shift.staff_id, 'staff_shift_reminder', 'Upcoming shift',
      'Your shift starts today at ' || to_char(v_shift.start_time, 'HH12:MI AM') || '.',
      'shift', v_shift.id
    );
  end loop;

  -- Attendance alerts: shift started >15 minutes ago with no check-in yet.
  for v_alert in
    select s.id, s.staff_id, s.branch_id, s.start_time
    from shifts s
    where extract(dow from current_date)::int = any(s.days_of_week)
      and s.start_time < localtime - interval '15 minutes'
      and not exists (
        select 1 from attendance_records ar
        where ar.staff_id = s.staff_id and ar.work_date = current_date and ar.check_in_time is not null
      )
      and not exists (
        select 1 from notifications n
        where n.entity_type = 'shift' and n.entity_id = s.id and n.type = 'attendance_alert'
          and n.created_at::date = current_date
      )
  loop
    perform notify_and_log(
      v_alert.staff_id, 'attendance_alert', 'Missed check-in',
      'You have not checked in for your shift that started at ' || to_char(v_alert.start_time, 'HH12:MI AM') || '.',
      'shift', v_alert.id
    );
    for v_manager in
      select id from profiles
      where role = 'admin' or (role = 'manager' and branch_id is not distinct from v_alert.branch_id)
    loop
      perform notify(
        v_manager, 'attendance_alert', 'Staff missed check-in',
        'A staff member has not checked in for their scheduled shift.', null, 'shift', v_alert.id
      );
    end loop;
  end loop;
end;
$$;

-- Internal — only meant to run via cron, not to be callable over the API.
revoke execute on function notify_and_log(uuid, text, text, text, text, uuid) from public;
revoke execute on function run_scheduled_notifications() from public;

select cron.schedule('scheduled-notifications', '0 * * * *', $$select run_scheduled_notifications()$$);
