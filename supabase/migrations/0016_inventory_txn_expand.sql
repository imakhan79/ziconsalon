-- Expand inventory_txn_type to cover Inventory Hub flows (transfers, write-offs).
-- New enum values must land in their own migration/transaction before
-- they can be referenced (Postgres restriction on ALTER TYPE ADD VALUE).
alter type inventory_txn_type add value 'transfer_in';
alter type inventory_txn_type add value 'transfer_out';
alter type inventory_txn_type add value 'write_off';
