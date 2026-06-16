// ============================================================================
// Tunable thresholds for the /liquidacion planilla (Phase 9A → 9C).
//
// Anything user-tunable lives here. Change a number, redeploy, done. No
// code elsewhere needs to move. Each export is a single number or grouped
// numeric object — easy to diff in PRs, easy to grep for callers.
// ============================================================================

// ── Phase 9A — Contract-end visual alert in the Contrato column ─────────────
//
// Alejandro's spec (June 2026):
//   "dos meses antes le podemos poner un celestito… y un mes antes,
//    el mes del vencimiento, se vence un azul con las letras atrás de fondo."
//
// Threshold semantics:
//   • days_until_end > APPROACHING_DAYS  →  status = 'normal'   (no tint)
//   • IMMINENT_DAYS < days_until_end ≤ APPROACHING_DAYS → 'approaching'  (light blue)
//   • days_until_end ≤ IMMINENT_DAYS  (incl. negative / past)  → 'imminent' (solid blue)
//
// Past-due contracts share the 'imminent' tier because they're equally
// urgent — Alejandro needs to talk to the tenant either way.
export const CONTRACT_END_APPROACHING_DAYS = 60
export const CONTRACT_END_IMMINENT_DAYS    = 30

// ── Phase 9A — Visual classes for each tier ────────────────────────────────
//
// Kept here so the grid component imports them rather than hard-coding.
// Tailwind colors are project-defined via CSS variables in tailwind.config.
export const CONTRACT_END_TIER_CLASSES = {
  normal:      '',
  approaching: 'bg-info/15',
  imminent:    'bg-info text-white font-medium',
} as const

export type ContractEndStatus = 'normal' | 'approaching' | 'imminent'
