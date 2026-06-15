'use client'

// ============================================================================
// InlineDateCell — click-to-edit date inside the /liquidacion grid.
//
// Visible state when not editing:
//   filled  → "DD/MM" in text-ink, font-medium
//   empty   → "—" in text-slate/60 (the "gris tenue" default)
//
// Click → reveals <input type="date"> autofocused.
//   Enter or blur → save (calls upsertTransactionByContractPeriod)
//   Escape         → cancel
//
// On save, if there was no transaction yet, one is created using
// `defaultAmount` (current_rent for RENT_IN, computed transferencia for
// LANDLORD_PAYOUT). If a transaction already existed, only the bank_date
// is updated — the amount is preserved.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertTransactionByContractPeriod } from '@/lib/transaction/actions'

interface Props {
  contractId:    string
  /** YYYY-MM-01 — first of the period month. */
  period:        string
  /** Which transaction type this cell governs: 'RENT_IN' or 'LANDLORD_PAYOUT'. */
  typeCode:      string
  /** Current bank_date on the matching transaction, or null if none exists yet. */
  initialDate:   string | null
  /** Used only on CREATE (when initialDate is null and the user types a new date). */
  defaultAmount: number
}

function fmtShort(s: string | null): string {
  if (!s) return ''
  // s is ISO "YYYY-MM-DD"; show DD/MM
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`
}

export function InlineDateCell({ contractId, period, typeCode, initialDate, defaultAmount }: Props) {
  const [editing, setEditing]      = useState(false)
  const [value, setValue]          = useState(initialDate ?? '')
  const [error, setError]          = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function save() {
    const newDate = value.trim() || null
    if (newDate === (initialDate ?? null)) {
      setEditing(false)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await upsertTransactionByContractPeriod({
        contractId,
        period,
        typeCode,
        bankDate: newDate,
        // Only pass amount on create; on update keep existing amount.
        amount:   initialDate ? undefined : defaultAmount,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function cancel() {
    setValue(initialDate ?? '')
    setEditing(false)
    setError(null)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-editing
        type="date"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  save()
          if (e.key === 'Escape') cancel()
        }}
        onBlur={save}
        disabled={pending}
        className="w-full px-1 py-0.5 text-[11px] border border-ink rounded bg-paper outline-none text-ink"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Tocá para editar"
      className={`w-full px-1 -mx-1 rounded hover:bg-cream-2 transition-colors tabular-nums ${initialDate ? 'text-ink font-medium' : 'text-slate/60'} ${pending ? 'opacity-50' : ''}`}
    >
      {initialDate ? fmtShort(initialDate) : '—'}
      {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
    </button>
  )
}
