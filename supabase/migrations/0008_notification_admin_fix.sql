-- Fix: branch-level notifications (no-show, low stock, leave requests) were
-- scoped by exact branch_id match for BOTH manager and admin recipients.
-- Admins (Super Administrator, "complete system control") should receive
-- these regardless of their own branch_id; only managers should be scoped
-- to their own branch — matching can_view_branch/can_manage_branch already
-- used elsewhere in RLS.

create or replace function trg_appointment_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  when_text text;
  mgr record;
begin
  when_text := to_char(new.start_time, 'Mon DD, YYYY HH12:MI AM');

  if TG_OP = 'INSERT' then
    perform notify(new.customer_id, 'appointment_booked', 'Booking confirmed',
      'Your appointment on ' || when_text || ' has been booked.', '/dashboard/appointments', 'appointment', new.id);
    if new.staff_id is not null then
      perform notify(new.staff_id, 'appointment_assigned', 'New appointment assigned',
        'You have a new appointment on ' || when_text || '.', '/dashboard/my-work', 'appointment', new.id);
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if new.status is distinct from old.status then
      if new.status = 'confirmed' then
        perform notify(new.customer_id, 'appointment_confirmed', 'Checked in',
          'You''re checked in for your appointment on ' || when_text || '.', '/dashboard/appointments', 'appointment', new.id);
      elsif new.status = 'cancelled' then
        perform notify(new.customer_id, 'appointment_cancelled', 'Appointment cancelled',
          'Your appointment on ' || when_text || ' was cancelled.', '/dashboard/appointments', 'appointment', new.id);
        if new.staff_id is not null then
          perform notify(new.staff_id, 'appointment_cancelled', 'Appointment cancelled',
            'The appointment on ' || when_text || ' was cancelled.', '/dashboard/my-work', 'appointment', new.id);
        end if;
      elsif new.status = 'completed' then
        perform notify(new.customer_id, 'appointment_completed', 'Thanks for visiting!',
          'We''d love your feedback — leave a review from your appointment history.', '/dashboard', 'appointment', new.id);
      elsif new.status = 'no_show' then
        for mgr in
          select id from profiles
          where role = 'admin' or (role = 'manager' and branch_id is not distinct from new.branch_id)
        loop
          perform notify(mgr.id, 'appointment_no_show', 'No-show recorded',
            'A customer did not show up for their ' || when_text || ' appointment.', '/dashboard/appointments', 'appointment', new.id);
        end loop;
      end if;
    elsif new.start_time is distinct from old.start_time then
      perform notify(new.customer_id, 'appointment_rescheduled', 'Appointment rescheduled',
        'Your appointment is now on ' || when_text || '.', '/dashboard/appointments', 'appointment', new.id);
      if new.staff_id is not null then
        perform notify(new.staff_id, 'appointment_rescheduled', 'Schedule change',
          'An appointment was rescheduled to ' || when_text || '.', '/dashboard/my-work', 'appointment', new.id);
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function trg_low_stock_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  mgr record;
begin
  if new.stock_qty <= new.reorder_level and (TG_OP = 'INSERT' or old.stock_qty > old.reorder_level) then
    for mgr in
      select id from profiles
      where role = 'admin' or (role = 'manager' and branch_id is not distinct from new.branch_id)
    loop
      perform notify(mgr.id, 'low_stock', 'Low stock alert',
        new.name || ' is low on stock (' || new.stock_qty || ' left).', '/dashboard/inventory', 'product', new.id);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function trg_leave_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  mgr record;
  staff_name text;
begin
  if TG_OP = 'INSERT' then
    select full_name into staff_name from profiles where id = new.staff_id;
    for mgr in
      select id from profiles
      where role = 'admin' or (role = 'manager' and branch_id is not distinct from new.branch_id)
    loop
      perform notify(mgr.id, 'leave_requested', 'New leave request',
        coalesce(staff_name, 'A staff member') || ' requested leave from ' || new.start_date || ' to ' || new.end_date || '.',
        '/dashboard', 'leave_request', new.id);
    end loop;
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform notify(new.staff_id, 'leave_reviewed', 'Leave request ' || new.status,
      'Your leave request from ' || new.start_date || ' to ' || new.end_date || ' was ' || new.status || '.',
      '/dashboard/my-work', 'leave_request', new.id);
  end if;
  return new;
end;
$$;
