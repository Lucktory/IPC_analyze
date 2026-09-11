'use client'

// ============================================================================
// DeudaAnteriorEditor — alta y baja de la deuda que el inquilino arrastra de
// meses anteriores al corte (Septiembre 2026), en la ficha del contrato.
//
// Una fila por mes, con su monto. Alejandro, 2026-09-11: "la deuda cuando yo
// la agrego, puedo poner a que periodo pertenece?" — si: si debe Junio y
// Julio, carga dos lineas, cada una con su monto.
//
// El monto se escribe a mano a proposito. Julio y Agosto 2026 nunca se
// cargaron del todo, asi que calcularlo desde los alquileres faltantes daria
// un numero que parece exacto pero no lo es. El dato bueno esta en los
// registros de la oficina.
//
// Lo que se carga aca aparece en la columna Deuda de la planilla con el (+) y
// en el desglose, marcado como "cargado a mano" para que nunca se confunda con
// lo que calculo el sistema.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'
import { setDeudaAnterior, deleteDeudaAnterior, type DeudaAnteriorRow } from '@/lib/contract/deuda-anterior-actions'

interface Props {
  contractId: string
  rows:       DeudaAnteriorRow[]
}

export function DeudaAnteriorEditor({ contractId, rows }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mes,    setMes]    = useState('')     // <input type="month"> → "2026-07"
  const [monto,  setMonto]  = useState('')
  const [nota,   setNota]   = useState('')
  const [error,  setError]  = useState<string | null>(null)

  const total = rows.reduce((s, r) => s + r.amount, 0)

  const run = (fn: () => Promise<{ ok: boolean; error: string | null }>, onOk?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) { setError(res.error); return }
      onOk?.()
      router.refresh()
    })
  }

  const add = () => {
    // <input type="month"> entrega "YYYY-MM"; la tabla guarda primero de mes.
    if (!/^\d{4}-\d{2}$/.test(mes)) { setError('Elegí un mes.'); return }
    const amount = Number(monto)
    if (!isFinite(amount) || amount <= 0) { setError('El monto debe ser mayor a 0.'); return }
    run(
      () => setDeudaAnterior(contractId, `${mes}-01`, amount, nota),
      () => { setMes(''); setMonto(''); setNota('') },
    )
  }

  return (
    <div className="text-[12.5px]">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-display text-[13px] font-medium text-ink">Deuda anterior</span>
        {total > 0 && (
          <span className="tabular-nums font-medium text-danger">{fmtMoney(total)}</span>
        )}
      </div>

      <p className="text-[10.5px] text-slate leading-snug mb-2">
        Meses anteriores a Septiembre 2026 que el inquilino todavía debe. Se cargan a mano:
        el sistema no los calcula porque esos meses no están completos.
      </p>

      {rows.length > 0 && (
        <ul className="mb-2 divide-y divide-line/60 border-y border-line/60">
          {rows.map(r => (
            <li key={r.period} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-baseline py-1">
              <span className="text-slate-dark">
                {periodLabel(r.period)}
                {r.note && <span className="text-slate text-[11px]"> — {r.note}</span>}
              </span>
              <span className="tabular-nums text-ink">{fmtMoney(r.amount)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteDeudaAnterior(contractId, r.period))}
                title={`Borrar la deuda de ${periodLabel(r.period)}`}
                className="text-slate hover:text-danger transition-colors px-1 disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={mes}
          max="2026-08"
          onChange={e => setMes(e.target.value)}
          className="border border-line rounded px-2 py-1 text-[12px] bg-paper text-ink"
        />
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={monto}
          placeholder="Monto"
          onChange={e => setMonto(e.target.value)}
          className="border border-line rounded px-2 py-1 text-[12px] w-28 tabular-nums bg-paper text-ink"
        />
        <input
          type="text"
          value={nota}
          placeholder="Nota (opcional)"
          onChange={e => setNota(e.target.value)}
          className="border border-line rounded px-2 py-1 text-[12px] flex-1 min-w-[8rem] bg-paper text-ink"
        />
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="border border-ink rounded px-3 py-1 text-[12px] text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      {error && <p className="text-[11px] text-danger mt-1.5">{error}</p>}
    </div>
  )
}
