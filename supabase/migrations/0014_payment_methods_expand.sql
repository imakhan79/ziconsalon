-- Expand payment_method to cover Finance Hub / POS payment options.
-- New enum values must land in their own migration/transaction before
-- they can be referenced (Postgres restriction on ALTER TYPE ADD VALUE).
alter type payment_method add value 'debit_card';
alter type payment_method add value 'credit_card';
alter type payment_method add value 'online';
alter type payment_method add value 'gift_card';
alter type payment_method add value 'store_credit';
