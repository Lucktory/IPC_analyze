// ============================================================================
// URGENCY THEME — SINGLE SOURCE OF TRUTH
//
// EDIT ONLY THIS BLOCK to change urgency colors everywhere.
// Bump tone levels:
//   100 → 200 = stronger
//   100 → 50  = softer
//   500 → 600 = deeper border (used as the eye-magnet stripe)
//
// Everything below builds from URGENCY_THEME — don't override at call sites.
// ============================================================================

export type UrgencyTier = 'critical' | 'warning' | 'recent' | 'upcoming' | 'ok'

const URGENCY_THEME = {
  critical: {
    rowBg:      'bg-orange-100',        // soft tint for the whole row
    rowBgHover: 'hover:bg-orange-200',  // deeper on hover
    cellBg:     'bg-orange-200',        // deeper tint on the specific empty audit cell
    border:     'border-l-orange-500',  // saturated 4px stripe — carries the signal
    dot:        'bg-orange-500',
    text:       'text-orange-900',
    bannerBg:   'bg-orange-100',        // detail-page banner background
  },
  warning: {
    rowBg:      'bg-yellow-100',
    rowBgHover: 'hover:bg-yellow-200',
    cellBg:     'bg-yellow-200',
    border:     'border-l-yellow-500',
    dot:        'bg-yellow-500',
    text:       'text-yellow-900',
    bannerBg:   'bg-yellow-100',
  },
  recent: {
    rowBg:      'bg-green-100',
    rowBgHover: 'hover:bg-green-200',
    cellBg:     '',
    border:     'border-l-green-500',
    dot:        'bg-green-500',
    text:       'text-green-900',
    bannerBg:   'bg-green-100',
  },
  upcoming: {
    rowBg:      'bg-sky-100',
    rowBgHover: 'hover:bg-sky-200',
    cellBg:     '',
    border:     'border-l-sky-500',
    dot:        'bg-sky-500',
    text:       'text-sky-900',
    bannerBg:   'bg-sky-100',
  },
}

// ============================================================================
// Generated style tables — DON'T edit, edit URGENCY_THEME above.
// ============================================================================

export interface UrgencyStyle {
  row:        string  // background tint for the <tr>
  borderLeft: string  // border-l-* class (width set inline)
  cellTint:   string  // background tint for an empty audit cell inside the row
}

export const URGENCY_STYLES: Record<UrgencyTier, UrgencyStyle> = {
  critical: {
    row:        `${URGENCY_THEME.critical.rowBg} ${URGENCY_THEME.critical.rowBgHover}`,
    borderLeft: URGENCY_THEME.critical.border,
    cellTint:   URGENCY_THEME.critical.cellBg,
  },
  warning: {
    row:        `${URGENCY_THEME.warning.rowBg} ${URGENCY_THEME.warning.rowBgHover}`,
    borderLeft: URGENCY_THEME.warning.border,
    cellTint:   URGENCY_THEME.warning.cellBg,
  },
  recent: {
    row:        `${URGENCY_THEME.recent.rowBg} ${URGENCY_THEME.recent.rowBgHover}`,
    borderLeft: URGENCY_THEME.recent.border,
    cellTint:   '',
  },
  upcoming: {
    row:        `${URGENCY_THEME.upcoming.rowBg} ${URGENCY_THEME.upcoming.rowBgHover}`,
    borderLeft: URGENCY_THEME.upcoming.border,
    cellTint:   '',
  },
  ok: {
    row:        '',
    borderLeft: 'border-l-transparent',
    cellTint:   '',
  },
}

export const URGENCY_RANK: Record<UrgencyTier, number> = {
  critical: 0, warning: 1, recent: 2, upcoming: 3, ok: 4,
}

export const URGENCY_LABEL: Record<UrgencyTier, string> = {
  critical: 'Atención requerida',
  warning:  'Verificar',
  recent:   'Cambios recientes',
  upcoming: 'Próximo evento',
  ok:       'Al día',
}

// Detail-page banner palette — mirrors row tints (consistency between list and
// detail when you click into a contract).
export const URGENCY_BANNER: Record<UrgencyTier, {
  border: string; bg: string; text: string; dot: string;
}> = {
  critical: { border: URGENCY_THEME.critical.border, bg: URGENCY_THEME.critical.bannerBg, text: URGENCY_THEME.critical.text, dot: URGENCY_THEME.critical.dot },
  warning:  { border: URGENCY_THEME.warning.border,  bg: URGENCY_THEME.warning.bannerBg,  text: URGENCY_THEME.warning.text,  dot: URGENCY_THEME.warning.dot  },
  recent:   { border: URGENCY_THEME.recent.border,   bg: URGENCY_THEME.recent.bannerBg,   text: URGENCY_THEME.recent.text,   dot: URGENCY_THEME.recent.dot   },
  upcoming: { border: URGENCY_THEME.upcoming.border, bg: URGENCY_THEME.upcoming.bannerBg, text: URGENCY_THEME.upcoming.text, dot: URGENCY_THEME.upcoming.dot },
  ok:       { border: 'border-l-transparent', bg: '', text: '', dot: '' },
}

// Soft -100 backgrounds use default dark text (text-ink, text-slate-dark) just
// fine. Kept as a no-op shape so existing call sites compile; remove later if
// we don't end up needing per-tier text overrides.
export const URGENCY_TEXT: Record<UrgencyTier, { onRow: string; onCellTint: string }> = {
  critical: { onRow: '', onCellTint: '' },
  warning:  { onRow: '', onCellTint: '' },
  recent:   { onRow: '', onCellTint: '' },
  upcoming: { onRow: '', onCellTint: '' },
  ok:       { onRow: '', onCellTint: '' },
}
