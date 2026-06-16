-- ============================================================================
-- Migration: contract_events (2026-06-17)
-- ============================================================================
-- Unified timeline / dossier table for everything that happens during a
-- contract's life — Alejandro's 2026-06-17 voice message:
--
--   "En las pestañas, observaciones, si se hicieron arreglos y no están
--    cargados. Que el pintor fue a tal casa, la pintó y acá no figura.
--    ¿A quién le corresponde esa pintura? Al dueño, al inquilino.
--    Tiene que haber un lugar para cargarlo, para descontárselo al dueño,
--    para descontárselo al inquilino."
--
-- Today the contract detail page is period-shaped: it can only show ONE
-- month's embudo + notes at a time. There's no chronological log of
-- "what has happened to this contract" (arreglos, aumentos, mails
-- enviados, observaciones libres, cambios de estado). This table is
-- that log — one row per event, queried by `contract_id` and ordered by
-- `occurred_at` to render the timeline.
--
-- Design (kept deliberately minimal — matches Medhi-chan's confirmed
-- model 2026-06-17):
--
--   • One table, NOT one-per-kind. arreglo / aumento / mail / observación
--     all live here and are distinguished by `kind`.
--   • Six business columns: contract_id, occurred_at, kind, description,
--     amount, payer, created_by. That's it.
--   • Hidden BIGSERIAL `id` so Postgres has a stable row identity for
--     updates / replication; never used by the application code.
--   • Composite `(contract_id, occurred_at DESC)` index so the contract
--     dossier query is fast even with thousands of events.
--
-- Future kinds can be added without schema changes — `kind` is plain TEXT.
-- If a particular kind ever needs a custom field that's used heavily,
-- we add a real column then. We don't pre-engineer JSONB blobs.
--
-- ADDITIVE migration. Idempotent. Safe to re-run.
-- ============================================================================

create table if not exists contract_events (
  -- Hidden plumbing — application code never touches this.
  id            bigserial   primary key,

  -- The contract this event belongs to. Read the full dossier with:
  --   SELECT * FROM contract_events WHERE contract_id = ? ORDER BY occurred_at DESC;
  contract_id   uuid        not null references contracts(id) on delete cascade,

  -- WHEN it happened in the business sense (not when it was typed).
  -- The encargada may log a repair that happened last week; this date is
  -- "last week", not "today". Default is now() because most events ARE
  -- logged at the moment they happen.
  occurred_at   timestamptz not null default now(),

  -- WHAT kind of situation. Free text on purpose so future kinds can be
  -- added without schema work. Known values used by the UI today:
  --   'arreglo'         — repair / mantenimiento (pintor, plomero, etc.)
  --   'aumento'         — rent adjustment applied
  --   'mail_enviado'    — liquidación / aviso emailed to landlord/tenant
  --   'observacion'     — free-text note the encargada wants pinned
  --   'status_change'   — contract went draft → active → rescinded / etc.
  -- Add new kinds in the application layer; no migration needed.
  kind          text        not null,

  -- Human-readable summary shown verbatim in the timeline.
  --   arreglo  → "Pintura del living — Pintor Juan"
  --   aumento  → "Aumento trimestral aplicado"
  --   mail     → "Liquidación mayo enviada a propietario"
  description   text,

  -- HOW MUCH money the event represents (signed). Optional — only meaningful
  -- for arreglo / aumento. For non-monetary kinds (status_change, mail
  -- enviado) leave NULL.
  --   arreglo  → cost of the repair (always positive)
  --   aumento  → new rent OR rent delta (UI decides; keep it consistent)
  amount        numeric(14,2),

  -- For arreglos only: WHO PAYS. Decided manually by the encargada per the
  -- saved rule ("client_repair_tracking_manual_classification" memory).
  -- NULL for non-arreglo kinds. CHECK constraint admits NULL so other
  -- kinds aren't forced to pick a value.
  payer         text        check (payer is null or payer in ('landlord', 'tenant')),

  -- Audit: who logged the event. NOT a foreign key because Supabase auth
  -- users live in auth.users which we don't want to hard-link from a
  -- business table. Storing the uuid is enough.
  created_by    uuid,

  -- Audit: server-side write timestamp (separate from occurred_at since
  -- backfills are possible). Never edited.
  created_at    timestamptz not null default now()
);

-- The ONE index that makes the dossier query fast.
create index if not exists idx_contract_events_contract_occurred
  on contract_events (contract_id, occurred_at desc);

-- RLS off — matches the rest of the schema's posture. Access control lives
-- in the application layer (Supabase auth + server actions). If RLS gets
-- enabled project-wide later, add a policy that mirrors the contracts
-- table's policy.
alter table contract_events disable row level security;

-- Tell PostgREST to pick up the new table immediately.
notify pgrst, 'reload schema';

-- Sanity check — should return 0 on a fresh apply.
select
  (select count(*) from contract_events) as rows_after_migration;
