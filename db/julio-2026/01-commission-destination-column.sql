-- Julio 2026 — durable per-contract default destination bank for the commission.
--
-- A contract's ADMI (commission) goes to a fixed Pampa bank account that follows
-- the administración (Alejandro assigns each employee's book to a bank). Storing
-- it on the contract makes every period's commission inherit the bank
-- automatically, instead of re-picking each month; the encargada can still
-- assign/move it from the ADMI cell. NULL = no default yet (Galicia/unclassified).
alter table contracts
  add column if not exists commission_destination text
  check (commission_destination in ('ADM_GALICIA','ADM_FRANCES_50_9','ADM_FRANCES_51_6'));
