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

const MS_48H = 48 * 3600000

/**
 * Audit rule (single source of truth) — "rent paid this month" is a positive
 * RENT_IN / RENT_NF_IN cobro. OTHER_IN (reintegros, ajustes) is income but NOT
 * rent, so it must not silence the "sin pago de alquiler" audit. Both the list
 * (entities) and the contract detail feed this so they can't contradict.
 */
export function hasRentForAudit(rentPaidAmount: number): boolean {
  return rentPaidAmount > 0
}

/** "Recently touched" = a rent confirmed on the bank OR a note edited within the
 *  last 48h. Same rule on the list and the detail. */
export function isRecentlyTouched(args: {
  rentBankDate?:  string | null
  noteUpdatedAt?: string | null
  now?:           number
}): boolean {
  const now = args.now ?? Date.now()
  const fresh = (iso?: string | null) => !!iso && (now - new Date(iso).getTime()) < MS_48H
  return fresh(args.rentBankDate) || fresh(args.noteUpdatedAt)
}

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
