'use client'

// ============================================================================
// AblSurchargeEditor — toggle + amount input for the contract's recurring
// ABL surcharge. Per Alejandro's 2026-06-19 voice: "un lugar para poner el
// ABL o el gas que a veces lo tenemos que sumar al alquiler en algunos
// contratos."
//
// When the toggle is ON, the planilla's expected rent = current_rent +
// abl_amount; when OFF, expected stays at current_rent. The two fields are
// edited together so the DB can never be `includes_abl=true with NULL
// amount` (= meaningless state).
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateContractAblSurcharge } from '@/lib/contract/inline-field-actions'
import { fmtMoney } from '@/lib/format'

interface Props {
  contractId:    string
  initialOn:     boolean
  initialAmount: number
  currentRent:   number
}

export function AblSurchargeEditor({ contractId, initialOn, initialAmount, currentRent }: Props) {
  const [on, setOn]             = useState(initialOn)
  const [amount, setAmount]     = useState(initialAmount > 0 ? String(initialAmount) : '')
  const [error, setError]       = useState<string | null>(null)
  const [hint, setHint]         = useState<string | null>(null)
  const [pending, startTx]      = useTransition()
  const router = useRouter()

  function save(nextOn: boolean, nextAmountStr: string) {
    setError(null)
    const nextAmount = nextOn ? Number(nextAmountStr) : null
    if (nextOn) {
      if (!isFinite(nextAmount as number) || (nextAmount as number) <= 0) {
        setError('Ingresá un monto mayor a 0 para el ABL.')
        return
      }
    }
    startTx(async () => {
      const res = await updateContractAblSurcharge(contractId, nextOn, nextAmount)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar.')
        return
      }
      setHint('✓ Guardado')
      setTimeout(() => setHint(null), 1500)
      router.refresh()
    })
  }

  const numericAmount = Number(amount) || 0
  const expectedTotal = on && numericAmount > 0 ? currentRent + numericAmount : currentRent

  return (
    <div className="bg-paper border border-line rounded p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="label-cap text-slate">ABL / recargo mensual</p>
          <p className="text-[12px] text-slate mt-0.5 max-w-[480px]">
            Algunos contratos suman el ABL (u otro recargo fijo) al alquiler cada mes.
            Cuando está activado, la planilla muestra el monto esperado como{' '}
            <strong className="text-ink">alquiler + ABL</strong>.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={on}
            onChange={e => {
              const next = e.target.checked
              setOn(next)
              if (!next) save(false, '')
            }}
            disabled={pending}
            className="h-4 w-4 accent-ink"
          />
          <span className="text-[12px] text-ink font-medium">
            {on ? 'Activado' : 'Desactivado'}
          </span>
        </label>
      </div>

      {on && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
              Monto ABL mensual
            </span>
            <input
              type="number"
              value={amount}
              step="0.01"
              min="0"
              onChange={e => setAmount(e.target.value)}
              onBlur={e => {
                if (Number(e.target.value) !== initialAmount) save(true, e.target.value)
              }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              placeholder="0"
              disabled={pending}
              className="w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info tabular-nums text-right"
            />
          </label>
          <div className="text-[11.5px] text-slate-dark pb-2">
            <span className="text-gray-500">Cobro esperado:</span>{' '}
            <strong className="text-ink tabular-nums">{fmtMoney(expectedTotal)}</strong>
            <br />
            <span className="text-gray-400 tabular-nums text-[10.5px]">
              {fmtMoney(currentRent)} alquiler + {fmtMoney(numericAmount)} ABL
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11.5px] text-danger">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-2 text-[11.5px] text-success">{hint}</p>
      )}
    </div>
  )
}
