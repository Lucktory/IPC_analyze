'use client'

// ============================================================================
// SelladoEditor — cargar el sellado del contrato y descontarle al propietario
// la parte que le toca.
//
// Alejandro, 2026-09-17: "Cada vez que se hace un contrato nuevo habia que
// sellarlo, la mitad la tenia que pagar el propietario y la mitad el inquilino.
// Pero ahora sale una ley que lo derogaron para las viviendas, pero no para los
// contratos comerciales, por eso cualquier contrato comercial va a tener un
// sellado."
//
// Se carga el TOTAL del sellado y el porcentaje del propietario, que viene en 50
// porque es lo normal ("es muy raro, muy muy raro que haya un caso que no sea
// mitad y mitad"). Aplicar carga la mitad del dueño como descuento del periodo,
// y de ahi sale en su rendicion como "SELLADO PROPIETARIO", igual que en la hoja
// que viene armando la oficina a mano.
//
// La mitad del INQUILINO no entra aca. Alejandro: al inquilino se le da un
// recibo hecho a mano cuando viene con los pagos, y ahi va su parte. La
// rendicion es del propietario y solo lleva lo de el.
//
// El campo se muestra en todos los contratos, no solo en los 10 comerciales: un
// contrato de vivienda firmado antes de la derogacion puede tener sellado
// pendiente, y esconderselo seria taparlo justo donde hace falta.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateContractSellado, applyContractSellado } from '@/lib/contract/inline-field-actions'
import { fmtMoney } from '@/lib/format'

interface Props {
  contractId: string
  total:      number | null
  /** Porcentaje que paga el propietario. 50 salvo excepcion. */
  landlordPct: number
  /** Periodo en el que ya se aplico, o null si sigue pendiente. */
  appliedAt:  string | null
  /** Periodo visible — es donde se carga el descuento al aplicar. */
  period:     string
}

export function SelladoEditor({ contractId, total, landlordPct, appliedAt, period }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [open, setOpen]     = useState(false)
  const [totalDraft, setTotalDraft] = useState(total != null ? String(total) : '')
  const [pctDraft, setPctDraft]     = useState(String(landlordPct || 50))

  const parsedTotal = totalDraft.trim() === '' ? null : Number(totalDraft.replace(',', '.'))
  const parsedPct   = Number(pctDraft.replace(',', '.'))
  const share = parsedTotal != null && isFinite(parsedTotal) && isFinite(parsedPct)
    ? Math.round(parsedTotal * (parsedPct / 100) * 100) / 100
    : null

  function save() {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const res = await updateContractSellado(contractId, parsedTotal, parsedPct)
      if (!res.ok) { setError(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  function apply() {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const res = await applyContractSellado(contractId, period)
      if (!res.ok) { setError(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-ink hover:underline text-right"
      >
        {total != null && total > 0 ? (
          <>
            {fmtMoney(total)}
            <span className="text-[10.5px] text-slate ml-1">
              · dueño {landlordPct}%
              {appliedAt ? ' · aplicado' : ' · sin aplicar'}
            </span>
          </>
        ) : (
          <span className="text-slate">Cargar</span>
        )}
      </button>
    )
  }

  return (
    <div className="w-56 space-y-2">
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-slate block mb-0.5">
          Sellado total (las dos partes)
        </span>
        <input
          autoFocus
          inputMode="decimal"
          value={totalDraft}
          onChange={e => setTotalDraft(e.target.value)}
          placeholder="0"
          className="w-full h-8 px-2 rounded border border-line bg-paper text-[12.5px] tabular-nums outline-none focus:border-info"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-slate block mb-0.5">
          Parte del propietario (%)
        </span>
        <input
          inputMode="decimal"
          value={pctDraft}
          onChange={e => setPctDraft(e.target.value)}
          className="w-full h-8 px-2 rounded border border-line bg-paper text-[12.5px] tabular-nums outline-none focus:border-info"
        />
      </label>

      {share != null && share > 0 && (
        <p className="text-[11px] text-slate-dark">
          Al propietario se le descuentan{' '}
          <strong className="text-ink tabular-nums">{fmtMoney(share, 2)}</strong>
        </p>
      )}
      {/* La del inquilino se cobra aparte, con el recibo a mano. Decirlo aca
          evita que alguien cargue la mitad en vez del total. */}
      <p className="text-[10px] text-slate italic leading-snug">
        Cargá el sellado completo. La mitad del inquilino no entra en la rendición:
        esa se le cobra aparte.
      </p>

      {error && <p className="text-[11px] text-danger">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-2 py-1 rounded bg-ink text-paper text-[11.5px] font-medium disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={pending || !(share != null && share > 0)}
          title="Carga la parte del propietario como descuento de este período"
          className="px-2 py-1 rounded border border-line text-[11.5px] text-slate-dark hover:bg-cream-2 disabled:opacity-50"
        >
          {appliedAt ? 'Volver a aplicar' : 'Aplicar'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={pending}
          className="text-[11.5px] text-slate hover:text-ink ml-auto"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
