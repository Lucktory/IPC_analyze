-- ============================================================================
-- Migration: pending_actions_sent (2026-06-11)
-- ============================================================================
-- Tracks when the encargada has marked a pending action as "sent" so the
-- row drops out of /pendientes for a snooze window (7 days). After the
-- window the row reappears if the underlying condition still holds —
-- prevents her from chasing the same item daily but also prevents true
-- forgets when she sends one notice and never follows up.
--
-- ADDITIVE migration. Idempotent. Safe to re-run.
-- ============================================================================

create table if not exists pending_actions_sent (
  contract_id uuid        not null references contracts(id) on delete cascade,
  category    text        not null check (category in ('cobranza', 'aumento', 'renovacion')),
  sent_at     timestamptz not null default now(),
  sent_by     text,
  primary key (contract_id, category)
);

create index if not exists idx_pending_actions_sent_sent_at
  on pending_actions_sent (sent_at);

alter table pending_actions_sent disable row level security;

-- Sanity check
select
  (select count(*) from pending_actions_sent) as rows;
