// ============================================================================
// Contract urgency — single source of truth for the audit signal.
// Used by /contratos (row tinting + sort) AND /contratos/[id] (detail banner).
// ============================================================================

export type UrgencyTier = 'critical' | 'warning' | 'recent' | 'upcoming' | 'ok'

export interface UrgencyInputs {
  status:            string
  endDate:           string
  hasRentThisMonth:  boolean
  hasNoteThisMonth:  boolean
  recentlyTouched:   boolean
  nextAdjustment:    string | null
  today?:            Date
}

export interface UrgencyResult {
  urgency: UrgencyTier
  reasons: string[]
}

export function computeUrgency(i: UrgencyInputs): UrgencyResult {
  if (i.status !== 'active') return { urgency: 'ok', reasons: [] }

  const today    = i.today ?? new Date()
  const in30days = new Date(today.getTime() + 30 * 86400000)
  const in60days = new Date(today.getTime() + 60 * 86400000)

  const end           = new Date(i.endDate)
  const venceSoon30   = end >= today && end <= in30days
  const venceSoon60   = end >  in30days && end <= in60days
  const noRent        = !i.hasRentThisMonth
  const noNote        = !i.hasNoteThisMonth

  const reasons: string[] = []
  if (venceSoon30)  reasons.push('Vence en ≤30 días')
  else if (venceSoon60) reasons.push('Vence en 31-60 días')
  if (noRent)       reasons.push('Sin pago de alquiler este mes')
  if (noNote)       reasons.push('Sin nota del período')

  if (venceSoon30)      return { urgency: 'critical', reasons }
  if (noRent && noNote) return { urgency: 'critical', reasons }
  if (venceSoon60)      return { urgency: 'warning',  reasons }
  if (noRent || noNote) return { urgency: 'warning',  reasons }

  if (i.recentlyTouched) return { urgency: 'recent', reasons: ['Datos actualizados en las últimas 48 hs'] }

  if (i.nextAdjustment) {
    const adj = new Date(i.nextAdjustment)
    if (adj >= today && adj <= in30days) {
      return { urgency: 'upcoming', reasons: ['Próximo aumento en ≤30 días'] }
    }
  }

  return { urgency: 'ok', reasons: [] }
}

export const URGENCY_RANK: Record<UrgencyTier, number> = {
  critical: 0, warning: 1, recent: 2, upcoming: 3, ok: 4,
}

export const URGENCY_LABEL: Record<UrgencyTier, string> = {
  critical: 'Atención requerida',
  warning:  'Verificar',
  recent:   'Cambios recientes',
  upcoming: 'Aumento próximo',
  ok:       'Al día',
}

// ----------------------------------------------------------------------------
// Visual style table — jewel-tone palette. Premium feel: deeper hues, lower
// opacity, fewer simultaneous colors. Only critical and warning tint the row;
// recent/upcoming are surfaced through the status badge instead.
// ----------------------------------------------------------------------------
export interface UrgencyStyle {
  row:        string  // background tint for the <tr>
  borderLeft: string  // border-l-* class (color only; width is fixed via inline class)
  cellTint:   string  // background tint for an empty audit cell within the row
}

export const URGENCY_STYLES: Record<UrgencyTier, UrgencyStyle> = {
  critical: {
    row:        'bg-red-900/[0.07] hover:bg-red-900/[0.13]',
    borderLeft: 'border-l-red-900',
    cellTint:   'bg-red-900/[0.14]',
  },
  warning: {
    row:        'bg-amber-800/[0.06] hover:bg-amber-800/[0.12]',
    borderLeft: 'border-l-amber-800',
    cellTint:   'bg-amber-800/[0.12]',
  },
  recent: {
    // No row tint — surfaced through the status badge only (restraint = premium)
    row:        '',
    borderLeft: 'border-l-transparent',
    cellTint:   '',
  },
  upcoming: {
    row:        '',
    borderLeft: 'border-l-transparent',
    cellTint:   '',
  },
  ok: {
    row:        '',
    borderLeft: 'border-l-transparent',
    cellTint:   '',
  },
}
