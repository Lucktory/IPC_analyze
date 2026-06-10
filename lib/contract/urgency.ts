// ============================================================================
// Contract urgency — contract-specific audit logic (rent / note / vencimiento).
// Visual styles, tier ranks, labels live in lib/urgency.ts and are re-exported
// here so existing imports keep working.
// ============================================================================

export {
  URGENCY_STYLES,
  URGENCY_TEXT,
  URGENCY_RANK,
  URGENCY_LABEL,
  URGENCY_BANNER,
  type UrgencyTier,
  type UrgencyStyle,
} from '@/lib/urgency'
import type { UrgencyTier } from '@/lib/urgency'

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
