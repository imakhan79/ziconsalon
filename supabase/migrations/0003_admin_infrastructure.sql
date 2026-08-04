-- Super Administrator infrastructure: audit logging and integration configuration.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on audit_logs(created_at desc);

alter table audit_logs enable row level security;

create policy "audit_logs_select_admin" on audit_logs for select
  using (is_admin(auth.uid()));
create policy "audit_logs_insert_authenticated" on audit_logs for insert
  with check (actor_id = auth.uid());

-- ============ Integrations ============
-- Config storage only: the admin supplies their own provider credentials.
-- "is_enabled"/"connected_at" reflect that configuration was saved, not a
-- live-tested connection to the third-party service.
create table integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  display_name text not null,
  category text not null,
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table integrations enable row level security;

create policy "integrations_select_admin" on integrations for select
  using (is_admin(auth.uid()));
create policy "integrations_manage_admin" on integrations for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into integrations (provider, display_name, category) values
  ('payment_gateway', 'Payment Gateway', 'payments'),
  ('whatsapp_business', 'WhatsApp Business API', 'messaging'),
  ('sms_gateway', 'SMS Gateway', 'messaging'),
  ('email_server', 'Email Server (SMTP)', 'messaging'),
  ('google_calendar', 'Google Calendar', 'calendar'),
  ('outlook_calendar', 'Outlook Calendar', 'calendar'),
  ('accounting_software', 'Accounting Software', 'finance'),
  ('qr_code', 'QR Code Check-in', 'hardware'),
  ('barcode_scanner', 'Barcode Scanner', 'hardware'),
  ('receipt_printer', 'Receipt Printer', 'hardware'),
  ('biometric_attendance', 'Biometric Attendance', 'hardware');
