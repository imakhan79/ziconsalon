-- Seed the remaining requested integration entries (Maps, Cash Drawer, Card
-- Terminal) alongside the existing payments/messaging/calendar/finance/
-- hardware rows.
insert into integrations (provider, display_name, category, is_enabled, config)
values
  ('maps', 'Maps', 'maps', false, '{}'::jsonb),
  ('cash_drawer', 'Cash Drawer', 'hardware', false, '{}'::jsonb),
  ('card_terminal', 'Card Terminal', 'hardware', false, '{}'::jsonb);
