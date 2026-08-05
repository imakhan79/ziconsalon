-- Reports Hub: campaign budget for ROI calculation, PKR as default currency.

alter table campaigns add column budget_cost numeric(10,2);

alter table business_settings alter column currency set default 'PKR';
update business_settings set currency = 'PKR' where currency = 'USD';
