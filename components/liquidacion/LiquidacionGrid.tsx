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

interface Props {
  rows:    LiquidacionGridRow[]
  period:  string
}

const STATUS_DOT: Record<LiquidacionStatus, string> = {
  draft: 'bg-slate',
  sent:  'bg-success',
  paid:  'bg-info',
}

function fmtShortDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMoneyOr(n: number | null | undefined): string {
  return n != null && n !== 0 ? fmtMoney(n) : '—'
}

/** Tailwind class for a value cell. `done = true` switches gris-tenue to ink. */
function cellTextClass(done: boolean): string {
  return done ? 'text-ink' : 'text-slate'
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

                  {/* Pct (effective commission %) */}
                  <Td width={70} align="right">
                    <span className={cellTextClass(cobrado)}>
                      {r.ingresos > 0 ? `${r.pct.toFixed(1)}%` : '—'}
                    </span>
                  </Td>

                  {/* Alquiler — base rent, gets the orange highlight when aumento próximo */}
                  <Td width={90} align="right" style={alquilerBg} title={r.hasUpcomingAdjustment ? `Aumento en ${r.daysUntilAdjustment} días` : undefined}>
                    <span className={`tabular-nums ${cellTextClass(cobrado)}`}>
                      {fmtMoney(r.currentRent)}
                    </span>
                  </Td>

                  <Td width={80} align="right">
                    <span className={`tabular-nums ${cellTextClass(cobrado)}`}>
                      {fmtMoneyOr(r.expensas)}
                    </span>
                  </Td>

                  {/* Fecha banco — empty cell when no payment yet (the "estado" signal) */}
                  <Td width={70} align="center">
                    <span className={r.fechaBanco ? 'text-ink tabular-nums font-medium' : 'text-slate/60'}>
                      {r.fechaBanco ? fmtShortDate(r.fechaBanco) : '—'}
                    </span>
                  </Td>

                  <Td width={100} align="right">
                    <span className={`tabular-nums font-medium ${cellTextClass(cobrado)}`}>
                      {r.ingresos > 0 ? fmtMoney(r.ingresos) : '—'}
                    </span>
                  </Td>

                  <Td width={80} align="right">
                    <span className={`tabular-nums ${r.deuda > 0 ? 'text-danger font-medium' : 'text-slate/60'}`}>
                      {r.deuda > 0 ? fmtMoney(r.deuda) : '—'}
                    </span>
                  </Td>

                  {/* Día transferencia */}
                  <Td width={70} align="center">
                    <span className={r.diaTransf ? 'text-ink tabular-nums font-medium' : 'text-slate/60'}>
                      {r.diaTransf ? fmtShortDate(r.diaTransf) : '—'}
                    </span>
                  </Td>

                  <Td width={110} align="right">
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
                  <Td width={90} align="right">
                    <span className={`tabular-nums ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admi)}
                    </span>
                  </Td>
                  <Td width={90} align="right">
                    <span className={`tabular-nums text-[11px] ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admGalicia)}
                    </span>
                  </Td>
                  <Td width={90} align="right">
                    <span className={`tabular-nums text-[11px] ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admFrances509)}
                    </span>
                  </Td>
                  <Td width={90} align="right">
                    <span className={`tabular-nums text-[11px] ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admFrances516)}
                    </span>
                  </Td>

                  {/* Observaciones — notes + the signed adjustment if any */}
                  <Td width={110}>
                    <ObservacionCell observacion={r.observacion} adjustment={r.adjustmentAmount} />
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

function ObservacionCell({ observacion, adjustment }: { observacion: string | null; adjustment: number }) {
  const hasNote = !!observacion?.trim()
  const hasAdj  = adjustment !== 0
  if (!hasNote && !hasAdj) return <span className="text-slate/60">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      {hasNote && (
        <span className="text-slate-dark text-[11px] truncate" title={observacion ?? ''}>
          {observacion}
        </span>
      )}
      {hasAdj && (
        <span className={`text-[11px] tabular-nums font-medium ${adjustment > 0 ? 'text-success' : 'text-danger'}`}>
          {adjustment > 0 ? '+' : ''}{fmtMoney(adjustment)}
        </span>
      )}
    </div>
  )
}
