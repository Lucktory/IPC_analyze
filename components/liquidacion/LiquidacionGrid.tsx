// ============================================================================
// LiquidacionGrid — the wide spreadsheet-style table for /liquidacion.
//
// Mirrors Alejandro's current Excel column structure (19 cols, same order)
// so the encargada feels at home. Three visual rules:
//
//   1. Default "gris tenue" — every value cell starts in text-slate.
//      Only when the linked action is complete does it flip to text-ink.
//
//   2. Light orange bg on INGRESOS cell when the contract's next rent
//      adjustment is within 30 days (the inline aviso de aumento).
//
//   3. Cobro state: when FECHA BANCO has a value, INGRESOS / EXPENSAS /
//      DEUDA all read as "cobrado" (dark gray).
//      Transferencia state: when DIA TRANSF has a value, TRANSFERENCIA /
//      OTROS / ADMI all read as "transferido" (dark gray).
//
// Read-only in this first version — click a row to open the detail page,
// which has the embudo + status workflow + breakdown already built. Inline
// editing of FECHA BANCO / DIA TRANSF / OBSERVACION will land next.
// ============================================================================

import Link from 'next/link'
import type { LiquidacionGridRow, LiquidacionStatus } from '@/lib/liquidacion/queries'
import { fmtMoney } from '@/lib/format'
import { InlineDateCell } from './InlineDateCell'
import { InlineObservacionCell } from './InlineObservacionCell'

interface Props {
  rows:    LiquidacionGridRow[]
  period:  string
}

const STATUS_DOT: Record<LiquidacionStatus, string> = {
  draft: 'bg-slate',
  sent:  'bg-success',
  paid:  'bg-info',
}

function fmtMoneyOr(n: number | null | undefined): string {
  return n != null && n !== 0 ? fmtMoney(n) : '—'
}

/** Tailwind class for a value cell. `done = true` switches gris-tenue to ink. */
function cellTextClass(done: boolean): string {
  return done ? 'text-ink' : 'text-slate'
}

/** Human-readable formula tooltip for the Transferencia cell. Hover-only —
 *  helps the encargada (or the auditor) see how the value was computed. */
function buildTransferenciaTooltip(r: LiquidacionGridRow): string {
  const adj = r.adjustmentAmount ?? 0
  const computed = Math.max(0, r.ingresos - r.admi - r.otros + adj)
  const parts = [
    `Transferencia = Ingresos − ADMI − Otros${adj !== 0 ? ' + Ajuste' : ''}`,
    `= ${fmtMoney(r.ingresos)} − ${fmtMoney(r.admi)} − ${fmtMoney(r.otros)}${adj !== 0 ? ` + ${fmtMoney(adj)}` : ''}`,
    `= ${fmtMoney(computed)}`,
  ]
  // If the actual LANDLORD_PAYOUT differs from the computed value, note the override
  if (r.diaTransf && Math.abs(r.transferencia - computed) > 1) {
    parts.push(`Valor registrado en banco: ${fmtMoney(r.transferencia)}`)
  }
  return parts.join('\n')
}

export function LiquidacionGrid({ rows, period }: Props) {
  if (rows.length === 0) {
    return (
      <section className="bg-paper border border-line rounded shadow-card p-10 text-center">
        <p className="text-[14px] text-slate">No hay contratos activos para este período.</p>
      </section>
    )
  }

  return (
    <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-display text-[15px] font-medium text-ink">Liquidación por contrato</h2>
        <p className="text-[12px] text-slate mt-0.5">
          {rows.length} contratos · scroll horizontal para ver todas las columnas
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse min-w-[1860px]">
          <thead className="bg-cream-2/60 text-[10px] uppercase tracking-wider text-slate-dark font-medium">
            <tr className="border-b border-line">
              {/* Sticky-left identity columns. background must be opaque so
                  data behind them stays hidden during horizontal scroll. */}
              <Th sticky left={0}    width={80}>LFA</Th>
              <Th sticky left={80}   width={170}>Inquilino</Th>
              <Th sticky left={250}  width={170}>Propietario</Th>

              <Th width={70}  align="right">Pct</Th>
              <Th width={90}  align="right">Alquiler</Th>
              <Th width={80}  align="right">Expensas</Th>
              <Th width={70}  align="center">F. banco</Th>
              <Th width={100} align="right">Ingresos</Th>
              <Th width={80}  align="right">Deuda</Th>
              <Th width={70}  align="center">D. transf</Th>
              <Th width={110} align="right">Transferencia</Th>
              <Th width={80}  align="right">Otros</Th>
              <Th width={90}  align="right">ADMI</Th>
              <Th width={90}  align="right">Galicia</Th>
              <Th width={90}  align="right">BBVA 50/9</Th>
              <Th width={90}  align="right">BBVA 51/6</Th>
              <Th width={110}>Observación</Th>
              <Th width={60}  align="center">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const cobrado     = !!r.fechaBanco
              const transferido = !!r.diaTransf
              const zebra       = idx % 2 === 0 ? 'bg-cream/30' : 'bg-paper'
              // The aumento ≤30d highlight goes on the Alquiler cell — a soft
              // orange that doesn't dominate but is unmistakable on scan.
              const alquilerBg = r.hasUpcomingAdjustment
                ? { backgroundColor: 'rgba(243,156,18,0.12)' }
                : undefined

              return (
                <tr
                  key={`${r.contractId}-${r.landlordId}`}
                  className={`${zebra} hover:bg-cream-2 transition-colors border-b border-line/30`}
                >
                  {/* Sticky-left identity */}
                  <Td sticky left={0}   width={80}  bg={zebra}>
                    <span className={r.lfa ? 'text-ink font-medium' : 'text-slate'}>
                      {r.lfa ?? '—'}
                    </span>
                  </Td>
                  <Td sticky left={80}  width={170} bg={zebra}>
                    <Link href={`/liquidacion/${r.contractId}?period=${period}`} className="text-ink font-medium hover:underline truncate block">
                      {r.inquilino}
                    </Link>
                    {r.hasMultipleLandlords && (
                      <span className="text-[9px] text-slate">co-propiedad</span>
                    )}
                  </Td>
                  <Td sticky left={250} width={170} bg={zebra}>
                    <span className="text-slate-dark truncate block">{r.propietario}</span>
                  </Td>

                  {/* Pct (effective commission %) — formula on hover */}
                  <Td
                    width={70}
                    align="right"
                    title={r.ingresos > 0
                      ? `Pct = ADMI / Ingresos × 100 = ${fmtMoney(r.admi)} / ${fmtMoney(r.ingresos)} × 100 = ${r.pct.toFixed(2)}%`
                      : undefined}
                  >
                    <span className={cellTextClass(cobrado)}>
                      {r.ingresos > 0 ? `${r.pct.toFixed(1)}%` : '—'}
                    </span>
                  </Td>

                  {/* Alquiler — base rent, gets the orange highlight when aumento próximo */}
                  <Td
                    width={90}
                    align="right"
                    style={alquilerBg}
                    title={r.hasUpcomingAdjustment
                      ? `Alquiler actual: ${fmtMoney(r.currentRent)} · ⚠ Aumento en ${r.daysUntilAdjustment} días`
                      : `Alquiler actual: ${fmtMoney(r.currentRent)} (contrato.current_rent)`}
                  >
                    <span className={`tabular-nums ${cellTextClass(cobrado)}`}>
                      {fmtMoney(r.currentRent)}
                    </span>
                  </Td>

                  <Td width={80} align="right">
                    <span className={`tabular-nums ${cellTextClass(cobrado)}`}>
                      {fmtMoneyOr(r.expensas)}
                    </span>
                  </Td>

                  {/* Fecha banco — click to record cobro (creates/updates RENT_IN) */}
                  <Td width={70} align="center">
                    <InlineDateCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="RENT_IN"
                      initialDate={r.fechaBanco}
                      defaultAmount={r.currentRent}
                    />
                  </Td>

                  <Td
                    width={100}
                    align="right"
                    title={r.ingresos > 0
                      ? `Ingresos = suma de cobros del período (RENT_IN + EXPENSAS_IN + recuperos) = ${fmtMoney(r.ingresos)}`
                      : 'Ingresos = aún sin cobros registrados en el período'}
                  >
                    <span className={`tabular-nums font-medium ${cellTextClass(cobrado)}`}>
                      {r.ingresos > 0 ? fmtMoney(r.ingresos) : '—'}
                    </span>
                  </Td>

                  <Td
                    width={80}
                    align="right"
                    title={r.deuda > 0
                      ? `Deuda = Alquiler − Ingresos = ${fmtMoney(r.currentRent)} − ${fmtMoney(r.ingresos)} = ${fmtMoney(r.deuda)}`
                      : 'Deuda = 0 (cobro completo o por completar)'}
                  >
                    <span className={`tabular-nums ${r.deuda > 0 ? 'text-danger font-medium' : 'text-slate/60'}`}>
                      {r.deuda > 0 ? fmtMoney(r.deuda) : '—'}
                    </span>
                  </Td>

                  {/* Día transferencia — click to record LANDLORD_PAYOUT */}
                  <Td width={70} align="center">
                    <InlineDateCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="LANDLORD_PAYOUT"
                      initialDate={r.diaTransf}
                      defaultAmount={Math.max(0, r.transferencia)}
                    />
                  </Td>

                  <Td
                    width={110}
                    align="right"
                    title={r.transferencia > 0
                      ? buildTransferenciaTooltip(r)
                      : 'Transferencia = Ingresos − ADMI − Otros (+ ajuste). Aún sin valor mientras no haya ingresos.'}
                  >
                    <span className={`tabular-nums font-medium ${cellTextClass(transferido)}`}>
                      {r.transferencia > 0 ? fmtMoney(r.transferencia) : '—'}
                    </span>
                  </Td>

                  <Td width={80} align="right">
                    <span className={`tabular-nums ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.otros)}
                    </span>
                  </Td>

                  {/* ADMI total + the three destination splits */}
                  <Td
                    width={90}
                    align="right"
                    title={r.admi > 0
                      ? `ADMI = Galicia + BBVA 50/9 + BBVA 51/6 = ${fmtMoney(r.admGalicia)} + ${fmtMoney(r.admFrances509)} + ${fmtMoney(r.admFrances516)} = ${fmtMoney(r.admi)}`
                      : 'ADMI = comisión total. Aún sin COMMISSION_OUT en el período.'}
                  >
                    <span className={`tabular-nums ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admi)}
                    </span>
                  </Td>
                  <Td
                    width={90}
                    align="right"
                    title={r.admGalicia > 0
                      ? `Comisión cobrada en cuenta ADM Galicia: ${fmtMoney(r.admGalicia)}`
                      : 'Sin comisión clasificada como ADM_GALICIA'}
                  >
                    <span className={`tabular-nums text-[11px] ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admGalicia)}
                    </span>
                  </Td>
                  <Td
                    width={90}
                    align="right"
                    title={r.admFrances509 > 0
                      ? `Comisión cobrada en BBVA Francés 50/9: ${fmtMoney(r.admFrances509)}`
                      : 'Sin comisión clasificada como ADM_FRANCES_50_9'}
                  >
                    <span className={`tabular-nums text-[11px] ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admFrances509)}
                    </span>
                  </Td>
                  <Td
                    width={90}
                    align="right"
                    title={r.admFrances516 > 0
                      ? `Comisión cobrada en BBVA Francés 51/6: ${fmtMoney(r.admFrances516)}`
                      : 'Sin comisión clasificada como ADM_FRANCES_51_6'}
                  >
                    <span className={`tabular-nums text-[11px] ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admFrances516)}
                    </span>
                  </Td>

                  {/* Observaciones — click to edit notes + signed adjustment */}
                  <Td width={110}>
                    <InlineObservacionCell
                      contractId={r.contractId}
                      landlordId={r.landlordId}
                      period={r.periodo}
                      initialNotes={r.observacion}
                      initialAdjustment={r.adjustmentAmount}
                    />
                  </Td>

                  {/* Estado liquidación — small dot */}
                  <Td width={60} align="center">
                    <span
                      title={r.status}
                      className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[r.status]}`}
                    />
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Th / Td primitives — handle sticky-left positioning + width consistency
// ────────────────────────────────────────────────────────────────────────────

interface ThProps {
  children: React.ReactNode
  width:    number
  sticky?:  boolean
  left?:    number
  align?:   'left' | 'right' | 'center'
}

function Th({ children, width, sticky, left, align = 'left' }: ThProps) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const stickyStyle: React.CSSProperties = sticky
    ? { position: 'sticky', left, zIndex: 20, backgroundColor: 'rgb(var(--color-cream-2))' }
    : {}
  return (
    <th
      style={{ width, minWidth: width, ...stickyStyle }}
      className={`px-2 py-2 border-r border-line/40 ${alignCls}`}
    >
      {children}
    </th>
  )
}

interface TdProps {
  children: React.ReactNode
  width:    number
  align?:   'left' | 'right' | 'center'
  sticky?:  boolean
  left?:    number
  bg?:      string
  title?:   string
  style?:   React.CSSProperties
}

function Td({ children, width, align = 'left', sticky, left, bg, title, style }: TdProps) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const stickyStyle: React.CSSProperties = sticky
    ? { position: 'sticky', left, zIndex: 10 }
    : {}
  return (
    <td
      style={{ width, minWidth: width, ...stickyStyle, ...style }}
      className={`px-2 py-1.5 border-r border-line/30 ${alignCls} ${sticky ? bg ?? '' : ''}`}
      title={title}
    >
      {children}
    </td>
  )
}

