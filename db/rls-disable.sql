-- ============================================================================
-- RLS disable for development
-- ============================================================================
-- Run this in Supabase SQL Editor ONCE so the front-end can read the data
-- via the anon key (no auth flow yet).
--
-- TODO Phase C: re-enable RLS with proper "authenticated reads only" policies
-- once login is wired and Alejandro has a user account.
-- ============================================================================

alter table administrations         disable row level security;
alter table administrators          disable row level security;
alter table external_accountants    disable row level security;
alter table landlords               disable row level security;
alter table banks                   disable row level security;
alter table bank_accounts           disable row level security;
alter table tenants                 disable row level security;
alter table properties              disable row level security;
alter table property_landlords      disable row level security;
alter table contracts               disable row level security;
alter table contract_landlords      disable row level security;
alter table contract_tenants        disable row level security;
alter table contract_administrators disable row level security;
alter table contract_period_notes   disable row level security;
alter table pending_actions_sent    disable row level security;
alter table transaction_types       disable row level security;
alter table transactions            disable row level security;
alter table liquidaciones           disable row level security;
alter table liquidacion_lines       disable row level security;
alter table adjustments             disable row level security;
alter table cpi_values              disable row level security;
alter table recibos                 disable row level security;
