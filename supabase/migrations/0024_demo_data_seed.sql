-- Demo data seed: fills out the sparse demo account (Main Branch, Demo
-- Customer, Test Admin, Demo Staff) with realistic activity across
-- scheduling, sales, and CRM tables so every hub has data to show.

-- ============ Shifts ============
insert into shifts (staff_id, branch_id, shift_type, start_time, end_time, days_of_week) values
('3d87132d-af36-4633-aba0-67adf2545c96','7ec5edbf-223f-4ce5-9328-7afa7286e64a','morning','09:00','17:00','{1,2,3,4,5}'),
('229e1d70-a1e4-47e4-a0c6-a0251dc3dc95','7ec5edbf-223f-4ce5-9328-7afa7286e64a','evening','12:00','20:00','{1,2,3,4,5,6}')
on conflict (staff_id) do nothing;

-- ============ Holidays ============
insert into holidays (branch_id, name, date) values
('7ec5edbf-223f-4ce5-9328-7afa7286e64a','New Year','2027-01-01'),
('7ec5edbf-223f-4ce5-9328-7afa7286e64a','Independence Day','2026-08-14');

-- ============ Attendance (past 6 weekdays) ============
insert into attendance_records (staff_id, branch_id, work_date, check_in_time, check_out_time, status)
select s.staff_id, '7ec5edbf-223f-4ce5-9328-7afa7286e64a', d::date,
  d + interval '9 hour', d + interval '17 hour',
  case when extract(dow from d) in (0) then 'leave' else 'present' end
from (select unnest(array['3d87132d-af36-4633-aba0-67adf2545c96','229e1d70-a1e4-47e4-a0c6-a0251dc3dc95'])::uuid as staff_id) s
cross join generate_series(current_date - 6, current_date - 1, interval '1 day') d
on conflict (staff_id, work_date) do nothing;

-- ============ Extra products & services ============
insert into products (sku, barcode, name, category, branch_id, cost_price, sell_price, stock_qty, reorder_level) values
('SKU-COND-01','8901000001','Conditioner 250ml','Hair Care','7ec5edbf-223f-4ce5-9328-7afa7286e64a',3.50,9.00,40,10),
('SKU-WAX-01','8901000002','Hair Wax 100g','Styling','7ec5edbf-223f-4ce5-9328-7afa7286e64a',4.00,12.00,25,5),
('SKU-OIL-01','8901000003','Argan Oil 100ml','Hair Care','7ec5edbf-223f-4ce5-9328-7afa7286e64a',6.00,18.00,15,5);

insert into services (category_id, name, duration_minutes, price, branch_id, tax_rate, is_active) values
(null,'Hair Coloring',90,60.00,'7ec5edbf-223f-4ce5-9328-7afa7286e64a',5,true),
(null,'Facial Treatment',45,35.00,'7ec5edbf-223f-4ce5-9328-7afa7286e64a',5,true),
(null,'Pedicure',40,20.00,'7ec5edbf-223f-4ce5-9328-7afa7286e64a',5,true);

-- ============ Appointments (varied statuses, past + upcoming) ============
insert into appointments (customer_id, staff_id, branch_id, start_time, end_time, status, created_by) values
('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5','3d87132d-af36-4633-aba0-67adf2545c96','7ec5edbf-223f-4ce5-9328-7afa7286e64a', now() - interval '5 day' + interval '10 hour', now() - interval '5 day' + interval '11 hour','completed','59c19b54-c5d6-4185-b68e-dba9d7eaf6f5'),
('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5','229e1d70-a1e4-47e4-a0c6-a0251dc3dc95','7ec5edbf-223f-4ce5-9328-7afa7286e64a', now() - interval '2 day' + interval '14 hour', now() - interval '2 day' + interval '15 hour','completed','3d87132d-af36-4633-aba0-67adf2545c96'),
('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5','3d87132d-af36-4633-aba0-67adf2545c96','7ec5edbf-223f-4ce5-9328-7afa7286e64a', now() - interval '1 day' + interval '9 hour', now() - interval '1 day' + interval '10 hour','no_show','59c19b54-c5d6-4185-b68e-dba9d7eaf6f5'),
('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5','229e1d70-a1e4-47e4-a0c6-a0251dc3dc95','7ec5edbf-223f-4ce5-9328-7afa7286e64a', now() + interval '1 day' + interval '11 hour', now() + interval '1 day' + interval '12 hour','confirmed','59c19b54-c5d6-4185-b68e-dba9d7eaf6f5'),
('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5','3d87132d-af36-4633-aba0-67adf2545c96','7ec5edbf-223f-4ce5-9328-7afa7286e64a', now() + interval '3 day' + interval '13 hour', now() + interval '3 day' + interval '14 hour','pending','3d87132d-af36-4633-aba0-67adf2545c96'),
('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5','229e1d70-a1e4-47e4-a0c6-a0251dc3dc95','7ec5edbf-223f-4ce5-9328-7afa7286e64a', now() - interval '10 day' + interval '10 hour', now() - interval '10 day' + interval '11 hour','cancelled','59c19b54-c5d6-4185-b68e-dba9d7eaf6f5');

insert into appointment_items (appointment_id, service_id, price, duration_minutes)
select a.id, '2eed6257-2cd3-4b98-a211-8877bc6ddf97', 40.00, 30
from appointments a where a.status in ('completed','no_show') and a.staff_id='3d87132d-af36-4633-aba0-67adf2545c96';

insert into appointment_items (appointment_id, service_id, price, duration_minutes)
select a.id, '5723a76a-d791-4d7d-af79-aab558ff9405', 25.00, 30
from appointments a where a.status='completed' and a.staff_id='229e1d70-a1e4-47e4-a0c6-a0251dc3dc95';

-- ============ Gift card, membership, review, loyalty ============
insert into gift_cards (branch_id, initial_value, balance, issued_to, expires_at) values
('7ec5edbf-223f-4ce5-9328-7afa7286e64a', 50.00, 50.00, '59c19b54-c5d6-4185-b68e-dba9d7eaf6f5', current_date + interval '6 month');

insert into customer_memberships (customer_id, plan_id, status, started_at, expires_at)
select '59c19b54-c5d6-4185-b68e-dba9d7eaf6f5', id, 'active', now() - interval '2 month', now() + interval '10 month'
from membership_plans where name='Gold' limit 1;

insert into reviews (customer_id, appointment_id, staff_id, rating, comment)
select '59c19b54-c5d6-4185-b68e-dba9d7eaf6f5', a.id, a.staff_id, 5, 'Loved the service, very professional!'
from appointments a where a.status='completed' limit 1;

insert into loyalty_transactions (customer_id, points, type, reason)
values ('59c19b54-c5d6-4185-b68e-dba9d7eaf6f5', 50, 'earn', 'Service completed reward');

-- ============ Expenses ============
insert into expenses (category, description, amount, expense_date, branch_id) values
('Utilities','Electricity bill', 120.00, current_date - 10, '7ec5edbf-223f-4ce5-9328-7afa7286e64a'),
('Supplies','Salon towels and gowns', 65.00, current_date - 5, '7ec5edbf-223f-4ce5-9328-7afa7286e64a'),
('Rent','Monthly rent', 900.00, current_date - 20, '7ec5edbf-223f-4ce5-9328-7afa7286e64a');

-- ============ Invoices + payments for the completed appointments ============
insert into invoices (customer_id, appointment_id, branch_id, subtotal, discount, tax, total, status, created_by)
select a.customer_id, a.id, a.branch_id, 40.00, 0, 2.00, 42.00, 'paid', a.staff_id
from appointments a where a.status='completed' and a.staff_id='3d87132d-af36-4633-aba0-67adf2545c96';

insert into invoices (customer_id, appointment_id, branch_id, subtotal, discount, tax, total, status, created_by)
select a.customer_id, a.id, a.branch_id, 25.00, 2.00, 1.15, 24.15, 'paid', a.staff_id
from appointments a where a.status='completed' and a.staff_id='229e1d70-a1e4-47e4-a0c6-a0251dc3dc95';

insert into invoice_items (invoice_id, description, service_id, quantity, unit_price, line_total)
select i.id, 'Haircut', '2eed6257-2cd3-4b98-a211-8877bc6ddf97', 1, 40.00, 40.00 from invoices i where i.total = 42.00;

insert into invoice_items (invoice_id, description, service_id, quantity, unit_price, line_total)
select i.id, 'Manicure', '5723a76a-d791-4d7d-af79-aab558ff9405', 1, 25.00, 25.00 from invoices i where i.total = 24.15;

insert into payments (invoice_id, amount, method, paid_at)
select id, total, 'card', created_at from invoices where total in (42.00, 24.15);

-- ============ Promotions & payroll ============
insert into promotions (code, name, discount_type, discount_value, branch_id, usage_limit, usage_count, is_active) values
('WELCOME10','Welcome 10% off','percent',10,'7ec5edbf-223f-4ce5-9328-7afa7286e64a',100,12,true),
('SUMMER20','Summer Sale 20%','percent',20,'7ec5edbf-223f-4ce5-9328-7afa7286e64a',50,5,true);

insert into staff_compensation (staff_id, salary) values ('3d87132d-af36-4633-aba0-67adf2545c96', 60000)
on conflict (staff_id) do update set salary = excluded.salary;
