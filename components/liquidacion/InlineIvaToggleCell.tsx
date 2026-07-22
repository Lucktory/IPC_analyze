'use client'

// ============================================================================
// InlineIvaToggleCell — click-to-edit toggle for contracts.commission_includes_iva.
//
// Shows the embedded-IVA amount when the contract is RI-invoiced
// (commission_includes_iva = true), or a muted dash for Monotributo.
// Click → small popover with two choices (Con IVA 21% / Sin IVA). Pick →
// instant commit (optimistic) → router.refresh re-derives IVA from the
// freshly-saved flag. Esc closes without saving.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useFloatingPopover } from './useFloatingPopover'
import { updateContractCommissionIncludesIva } from '@/lib/contract/inline-field-actions'
import { fmtMoney } from '@/lib/format'

interface Props {
  contractId:           string
  /** The row's period (YYYY-MM-01) — lets the toggle re-sync that period's
   *  commission so the ADMI corrects itself without a second "Calcular" click. */
  period:               string
  /** Current value of contracts.commission_includes_iva. */
  includesIva:          boolean
  /** Derived IVA portion (admi × 0.21 / 1.21) — already computed by the grid. */
  ivaAmount:            number
  /** Admi net of IVA — shown in the tooltip so the encargada sees the breakdown. */
  adminNet:             number
  /** Existing dark/light text-color treatment from the surrounding cell. */
  amountClassName:      string
}

export function InlineIvaToggleCell({
  contractId, period, includesIva, ivaAmount, adminNet, amountClassName,
}: Props) {
  const [open, setOpen]             = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [pending, setPending]       = useState(false)
  const [optimistic, setOptimistic] = useState<boolean | undefined>(undefined)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router    = useRouter()

  const [popoverEl, setPopoverEl] = useState<HTMLElement | null>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, popover: popoverEl, minWidth: 160 })

  const effective = optimistic ?? includesIva

  function pick(next: boolean) {
    if (next === includesIva) {
      setOpen(false)
      return
    }
    setOptimistic(next)
    setOpen(false)
    setPending(true)
    updateContractCommissionIncludesIva(contractId, next, period)
      .then(res => {
        if (!res.ok) {
          setOptimistic(undefined)
          setError(res.error ?? 'Error al guardar')
        } else {
          router.refresh()
        }
      })
      .finally(() => setPending(false))
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const tooltip = effective
    ? ivaAmount > 0
      ? `IVA 21% sobre comisión neta ${fmtMoney(adminNet)} = ${fmtMoney(ivaAmount)} (incluido dentro del ADMI). Click para cambiar.`
      : 'Contrato RI: el IVA 21% se aplicará cuando se registre el COMMISSION_OUT. Click para cambiar.'
    : 'Administrador Monotributo: la comisión no lleva IVA. Click para cambiar.'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={tooltip}
        className={`w-full text-right px-0 hover:bg-info/10 transition-colors ${pending ? 'opacity-60' : ''}`}
      >
        {effective ? (
          <span className={`tabular-nums ${amountClassName}`}>
            {ivaAmount > 0 ? fmtMoney(ivaAmount) : '—'}
          </span>
        ) : (
          <span className="tabular-nums text-slate">—</span>
        )}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />

          <ul
            ref={setPopoverEl} style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-paper border border-line rounded shadow-lg py-0.5"
          >
            <li
              onClick={() => pick(true)}
              className={`px-3 py-1.5 text-[12.5px] cursor-pointer ${effective ? 'bg-info/10 text-ink font-medium' : 'text-slate-dark hover:bg-cream-2'}`}
              title="RI: la comisión se factura con IVA 21% incluido"
            >
              Con IVA 21% <span className="text-slate text-[10.5px] ml-1">(RI)</span>
            </li>
            <li
              onClick={() => pick(false)}
              className={`px-3 py-1.5 text-[12.5px] cursor-pointer ${!effective ? 'bg-info/10 text-ink font-medium' : 'text-slate-dark hover:bg-cream-2'}`}
              title="Monotributo: la comisión se factura sin IVA"
            >
              Sin IVA <span className="text-slate text-[10.5px] ml-1">(Monotributo)</span>
            </li>
          </ul>
        </>,
        document.body,
      )}
    </>
  )
}
