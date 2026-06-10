// ============================================================================
// URGENCY — shared visual language across every list page.
//
// Colors deliberately mirror what Alejandro's team uses in Excel today:
//   ORANGE = special / new / immediate attention   (the AGUAISOL row)
//   YELLOW = money issue / debt / saldo pendiente  (the DEBE SALDO cells)
//   GREEN  = verified / documented / recently touched
//   BLUE   = scheduled / upcoming event
//   none   = routine, recedes
//
// Saturated -200 backgrounds (full opacity) so the tint reads against
// cream/white pages. Cell-level tint uses -400 for higher contrast on the
// specific empty audit fields.
// ============================================================================

export type UrgencyTier = 'critical' | 'warning' | 'recent' | 'upcoming' | 'ok'

export interface UrgencyStyle {
  row:        string  // background tint for the <tr>
  borderLeft: string  // border-l-* class (width set inline)
  cellTint:   string  // background tint for an empty audit cell inside the row
}

export const URGENCY_STYLES: Record<UrgencyTier, UrgencyStyle> = {
  critical: {
    row:        'bg-orange-200 hover:bg-orange-300',
    borderLeft: 'border-l-orange-600',
    cellTint:   'bg-orange-400',
  },
  warning: {
    row:        'bg-yellow-200 hover:bg-yellow-300',
    borderLeft: 'border-l-yellow-600',
    cellTint:   'bg-yellow-400',
  },
  recent: {
    row:        'bg-green-200 hover:bg-green-300',
    borderLeft: 'border-l-green-600',
    cellTint:   '',
  },
  upcoming: {
    row:        'bg-sky-200 hover:bg-sky-300',
    borderLeft: 'border-l-sky-600',
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

// Banner palette — used on detail pages to mirror the row tint
export const URGENCY_BANNER: Record<UrgencyTier, {
  border: string; bg: string; text: string; dot: string;
}> = {
  critical: { border: 'border-l-orange-600', bg: 'bg-orange-100', text: 'text-orange-900',  dot: 'bg-orange-600' },
  warning:  { border: 'border-l-yellow-600', bg: 'bg-yellow-100', text: 'text-yellow-900',  dot: 'bg-yellow-600' },
  recent:   { border: 'border-l-green-600',  bg: 'bg-green-100',  text: 'text-green-900',   dot: 'bg-green-600'  },
  upcoming: { border: 'border-l-sky-600',    bg: 'bg-sky-100',    text: 'text-sky-900',     dot: 'bg-sky-600'    },
  ok:       { border: 'border-l-transparent', bg: '',             text: '',                 dot: ''              },
}
