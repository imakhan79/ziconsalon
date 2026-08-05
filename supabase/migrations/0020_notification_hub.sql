-- Notification Hub: admin/manager history visibility + manual broadcast RPC.

create policy "notifications_select_admin" on notifications for select
  using (
    is_admin(auth.uid())
    or (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'manager')
      and exists (
        select 1 from profiles r
        where r.id = notifications.recipient_id
          and r.branch_id is not distinct from (select branch_id from profiles where id = auth.uid())
      )
    )
  );

create function send_broadcast_notification(
  p_audience text,
  p_branch_id uuid,
  p_title text,
  p_message text,
  p_channels text[] default array['email']::text[]
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_recipient record;
  v_count int := 0;
begin
  if not is_staff_or_above(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_audience not in ('all_customers', 'branch_customers', 'all_staff', 'branch_staff') then
    raise exception 'Invalid audience';
  end if;

  for v_recipient in
    select id, full_name, communication_preferences from profiles
    where is_active
      and (
        (p_audience = 'all_customers' and role = 'customer')
        or (p_audience = 'branch_customers' and role = 'customer' and branch_id is not distinct from p_branch_id)
        or (p_audience = 'all_staff' and role in ('staff', 'manager'))
        or (p_audience = 'branch_staff' and role in ('staff', 'manager') and branch_id is not distinct from p_branch_id)
      )
  loop
    perform notify(v_recipient.id, 'broadcast', p_title, p_message);
    v_count := v_count + 1;

    if 'email' = any(p_channels) and coalesce(v_recipient.communication_preferences ->> 'email', 'true') = 'true' then
      insert into communications_log (channel, recipient, customer_id, status, created_by)
      values ('email', v_recipient.full_name, v_recipient.id, 'pending', auth.uid());
    end if;
    if 'sms' = any(p_channels) and coalesce(v_recipient.communication_preferences ->> 'sms', 'true') = 'true' then
      insert into communications_log (channel, recipient, customer_id, status, created_by)
      values ('sms', v_recipient.full_name, v_recipient.id, 'pending', auth.uid());
    end if;
    if 'whatsapp' = any(p_channels) and coalesce(v_recipient.communication_preferences ->> 'whatsapp', 'true') = 'true' then
      insert into communications_log (channel, recipient, customer_id, status, created_by)
      values ('whatsapp', v_recipient.full_name, v_recipient.id, 'pending', auth.uid());
    end if;
  end loop;

  return v_count;
end;
$$;
