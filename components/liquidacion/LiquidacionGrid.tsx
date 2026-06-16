// ============================================================================
// LiquidacionGrid — the wide spreadsheet-style table for /liquidacion.
//
// Mirrors Alejandro's current Excel column structure EXACTLY (19 cols, same
// order). The 20th column (ESTADO) is our addition for the borrador→enviada
// →pagada workflow that doesn't exist in her Excel.
//
// Column order (matches her sheet left → right):
//   1  OBSERVACIÓN              [sticky]
//   2  LFA                      [sticky]
//   3  FECHA BANCO              [sticky]
//   4  PROPIETARIO              [sticky]
//   5  EXPENSAS
//   6  INQUILINO
//   7  PCT
//   8  CONTRATO (vigencia)
//   9  DEUDA
//   10 PERÍODO
//   11 INGRESOS
//   12 TRANSFERENCIA
//   13 OTROS
//   14 DÍA TRANSFERENCIA
//   15 ADMI
//   16 ADM GALICIA
//   17 ADM FRANCÉS 50/9
//   18 ADM FRANCÉS 51/6
//   19 ESTADO (our addition — workflow status dot)
//
// Three visual rules carry forward:
//   • Default "gris tenue" — value cells start in text-slate; flip to text-ink
//     only when the linked action is complete (fecha banco / día transf set).
//   • Light orange bg on the INGRESOS cell when the contract's next rent
//     adjustment is within 30 days (inline aviso de aumento).
//   • Cobro state vs. transferencia state — see comments below.
// ============================================================================

import Link from 'next/link'
import type { LiquidacionGridRow, LiquidacionStatus } from '@/lib/liquidacion/queries'
import type { LandlordOption } from '@/lib/landlord/queries'
import type { TenantOption } from '@/lib/tenant/queries'
import { fmtMoney } from '@/lib/format'
import { InlineDateCell } from './InlineDateCell'
import { InlineObservacionCell } from './InlineObservacionCell'
import { InlineLandlordCell } from './InlineLandlordCell'
import { InlineTenantCell } from './InlineTenantCell'
import {
  EditableLfaCell,
  EditableExpensasCell,
  EditableCommissionPctCell,
  EditableVigenciaCell,
  EditableTransactionCell,
  EditableStatusCell,
} from './EditableCells'
import { LiquidarYEnviarButton } from './LiquidarYEnviarButton'
import { InlineIngresosCell } from './InlineIngresosCell'

interface Props {
  rows:            LiquidacionGridRow[]
  period:          string
  landlordOptions: LandlordOption[]
  tenantOptions:   TenantOption[]
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

// ── Column widths (in px). Sticky-left runs from col 1 → 4 (OBS, LFA,
//    FECHA BANCO, PROPIETARIO) to mirror Excel "freeze through column E"
//    behaviour. Left offsets are cumulative sums.
const W = {
  obs: 140, lfa: 50, fbanco: 70, prop: 150,
  expensas: 80, inq: 150,
  pct: 55, contrato: 115, deuda: 80, periodo: 70,
  ingresos: 95, transf: 105, otros: 80, diatransf: 70,
  admi: 90, galicia: 85, fr509: 85, fr516: 85,
  estado: 55,
  // Column 20: Mail — per-row "Liquidar y enviar" action button.
  // Alejandro: "faltaría agregarle al final liquidar contrato y mandarle el mail."
  mail: 75,
}
const STICKY_LEFTS = {
  obs:    0,
  lfa:    W.obs,
  fbanco: W.obs + W.lfa,
  prop:   W.obs + W.lfa + W.fbanco,
}

function fmtVigencia(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const fmt = (s: string | null) => {
    if (!s) return '—'
    // YYYY-MM-DD → DD/MM/YY
    return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

function fmtPeriodo(p: string): string {
  // YYYY-MM-01 → MM/YYYY
  if (!p || p.length < 7) return '—'
  return `${p.slice(5, 7)}/${p.slice(0, 4)}`
}

/** Human-readable formula tooltip for the Transferencia cell. */
function buildTransferenciaTooltip(r: LiquidacionGridRow): string {
  const adj = r.adjustmentAmount ?? 0
  const computed = Math.max(0, r.ingresos - r.admi - r.otros + adj)
  const parts = [
    `Transferencia = Ingresos − ADMI − Otros${adj !== 0 ? ' + Ajuste' : ''}`,
    `= ${fmtMoney(r.ingresos)} − ${fmtMoney(r.admi)} − ${fmtMoney(r.otros)}${adj !== 0 ? ` + ${fmtMoney(adj)}` : ''}`,
    `= ${fmtMoney(computed)}`,
  ]
  if (r.diaTransf && Math.abs(r.transferencia - computed) > 1) {
    parts.push(`Valor registrado en banco: ${fmtMoney(r.transferencia)}`)
  }
  return parts.join('\n')
}

export function LiquidacionGrid({ rows, period, landlordOptions, tenantOptions }: Props) {
  if (rows.length === 0) {
    return (
      <section className="bg-paper border border-line p-6 text-center">
        <p className="text-[13px] text-slate">No hay contratos activos para este período.</p>
      </section>
    )
  }

  const tableMinWidth =
    W.obs + W.lfa + W.fbanco + W.prop + W.expensas + W.inq + W.pct + W.contrato +
    W.deuda + W.periodo + W.ingresos + W.transf + W.otros + W.diatransf +
    W.admi + W.galicia + W.fr509 + W.fr516 + W.estado + W.mail

  return (
    <section className="bg-white border border-gray-300 overflow-hidden h-full flex flex-col">
      {/* The ONLY scrolling area on /liquidacion. The page itself doesn't
          scroll — only this container does. Both scrollbars (horizontal at
          the bottom, vertical at the right) live here. The header row is
          sticky-top inside this container, and the sticky-left columns
          form a frozen freeze-panes corner. */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-[12px] border-collapse" style={{ minWidth: tableMinWidth }}>
          <thead className="bg-gray-100 text-[10px] uppercase tracking-wider text-gray-700 font-semibold">
            <tr className="border-b border-gray-300">
              {/* 1 */}<Th sticky left={STICKY_LEFTS.obs}    width={W.obs}>Observación</Th>
              {/* 2 */}<Th sticky left={STICKY_LEFTS.lfa}    width={W.lfa}    align="center">LFA</Th>
              {/* 3 */}<Th sticky left={STICKY_LEFTS.fbanco} width={W.fbanco} align="center">F. banco</Th>
              {/* 4 */}<Th sticky left={STICKY_LEFTS.prop}   width={W.prop}>Propietario</Th>
              {/* 5 */}<Th width={W.expensas} align="right">Expensas</Th>
              {/* 6 */}<Th width={W.inq}>Inquilino</Th>
              {/* 7 */}<Th width={W.pct}      align="right">Pct</Th>
              {/* 8 */}<Th width={W.contrato} align="center">Contrato</Th>
              {/* 9 */}<Th width={W.deuda}    align="right">Deuda</Th>
              {/* 10 */}<Th width={W.periodo}   align="center">Período</Th>
              {/* 11 */}<Th width={W.ingresos}  align="right">Ingresos</Th>
              {/* 12 */}<Th width={W.transf}    align="right">Transferencia</Th>
              {/* 13 */}<Th width={W.otros}     align="right">Otros</Th>
              {/* 14 */}<Th width={W.diatransf} align="center">D. transf</Th>
              {/* 15 */}<Th width={W.admi}      align="right">ADMI</Th>
              {/* 16 */}<Th width={W.galicia}   align="right">Galicia</Th>
              {/* 17 */}<Th width={W.fr509}     align="right">BBVA 50/9</Th>
              {/* 18 */}<Th width={W.fr516}     align="right">BBVA 51/6</Th>
              {/* 19 */}<Th width={W.estado}    align="center">Estado</Th>
              {/* 20 */}<Th width={W.mail}      align="center">Mail</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const cobrado     = !!r.fechaBanco
              const transferido = !!r.diaTransf
              // Excel-style alternating banding: pure white / very pale gray.
              // Recently-edited rows override the banding with a yellow tint
              // so the encargada can see what she just touched without the
              // table re-sorting under her (default sort stays alphabetical
              // by propietario per Alejandro's spec).
              const zebra       = r.wasRecentlyEdited
                ? 'bg-yellow-50'
                : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')
              // The aumento ≤30d highlight goes on the INGRESOS cell — soft
              // orange that doesn't dominate but is unmistakable on scan.
              const ingresosBg = r.hasUpcomingAdjustment
                ? { backgroundColor: 'rgba(243,156,18,0.12)' }
                : undefined

              return (
                <tr
                  key={`${r.contractId}-${r.landlordId}`}
                  className={`${zebra} hover:bg-blue-50 transition-colors border-b border-gray-200 [&:has([data-editing])]:bg-blue-100 [&:has([data-editing])]:ring-2 [&:has([data-editing])]:ring-info [&:has([data-editing])]:ring-inset`}
                >
                  {/* 1. OBSERVACIÓN — sticky */}
                  <Td sticky left={STICKY_LEFTS.obs} width={W.obs} bg={zebra}>
                    <InlineObservacionCell
                      contractId={r.contractId}
                      landlordId={r.landlordId}
                      period={r.periodo}
                      initialNotes={r.observacion}
                      initialAdjustment={r.adjustmentAmount}
                    />
                  </Td>

                  {/* 2. LFA — sticky, editable dropdown */}
                  <Td sticky left={STICKY_LEFTS.lfa} width={W.lfa} bg={zebra} align="center">
                    <EditableLfaCell contractId={r.contractId} value={r.lfa} />
                  </Td>

                  {/* 3. FECHA BANCO — sticky, click-to-edit (drives the RENT_IN cobro) */}
                  <Td sticky left={STICKY_LEFTS.fbanco} width={W.fbanco} bg={zebra} align="center">
                    <InlineDateCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="RENT_IN"
                      initialDate={r.fechaBanco}
                      defaultAmount={r.currentRent}
                    />
                  </Td>

                  {/* 4. PROPIETARIO — sticky, autocomplete + new-name alert */}
                  <Td sticky left={STICKY_LEFTS.prop} width={W.prop} bg={zebra}>
                    <InlineLandlordCell
                      contractId={r.contractId}
                      currentName={r.propietario}
                      options={landlordOptions}
                      hint={r.hasMultipleLandlords ? 'co-propiedad' : undefined}
                    />
                  </Td>

                  {/* 5. EXPENSAS — editable number */}
                  <Td width={W.expensas} align="right">
                    <EditableExpensasCell
                      contractId={r.contractId}
                      value={r.expensas}
                      cobrado={cobrado}
                    />
                  </Td>

                  {/* 6. INQUILINO — autocomplete + new-name alert + ↗ detail link */}
                  <Td width={W.inq}>
                    <div className="flex items-start gap-1">
                      <div className="flex-1 min-w-0">
                        <InlineTenantCell
                          contractId={r.contractId}
                          currentName={r.inquilino}
                          options={tenantOptions}
                        />
                      </div>
                      <Link
                        href={`/liquidacion/${r.contractId}?period=${period}`}
                        title="Abrir detalle del contrato"
                        className="text-slate hover:text-ink text-[11px] shrink-0 px-0.5"
                      >
                        ↗
                      </Link>
                    </div>
                  </Td>

                  {/* 7. PCT — editable; persists contracts.commission_pct */}
                  <Td width={W.pct} align="right">
                    <EditableCommissionPctCell
                      contractId={r.contractId}
                      value={r.pct}
                      cobrado={cobrado}
                    />
                  </Td>

                  {/* 8. CONTRATO (vigencia) — editable date range */}
                  <Td width={W.contrato} align="center">
                    <EditableVigenciaCell
                      contractId={r.contractId}
                      startDate={r.startDate}
                      endDate={r.endDate}
                    />
                  </Td>

                  {/* 9. DEUDA */}
                  <Td
                    width={W.deuda}
                    align="right"
                    title={r.deuda > 0
                      ? `Deuda = Alquiler − Ingresos = ${fmtMoney(r.currentRent)} − ${fmtMoney(r.ingresos)} = ${fmtMoney(r.deuda)}`
                      : 'Deuda = 0 (cobro completo o por completar)'}
                  >
                    <span className={`tabular-nums ${r.deuda > 0 ? 'text-danger font-medium' : 'text-slate/60'}`}>
                      {r.deuda > 0 ? fmtMoney(r.deuda) : '—'}
                    </span>
                  </Td>

                  {/* 10. PERÍODO */}
                  <Td width={W.periodo} align="center">
                    <span className="tabular-nums text-slate-dark text-[11px]">
                      {fmtPeriodo(r.periodo)}
                    </span>
                  </Td>

                  {/* 11. INGRESOS — dynamic breakdown popover (Phase 6).
                       Click opens the per-concept line editor: alquiler,
                       expensas, recupero ABL/gas/agua/luz/etc. Sum is
                       shown in the cell; orange tint on aumento próximo. */}
                  <Td width={W.ingresos} align="right">
                    <InlineIngresosCell
                      contractId={r.contractId}
                      period={r.periodo}
                      lines={r.ingresosLines}
                      total={r.ingresos}
                      cobrado={cobrado}
                      upcomingAdjustment={r.hasUpcomingAdjustment && r.daysUntilAdjustment != null
                        ? { days: r.daysUntilAdjustment }
                        : null}
                    />
                  </Td>

                  {/* 12. TRANSFERENCIA — editable; persists LANDLORD_PAYOUT */}
                  <Td width={W.transf} align="right">
                    <EditableTransactionCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="LANDLORD_PAYOUT"
                      value={r.transferencia}
                      cobrado={transferido}
                      label={`Transferencia ${fmtPeriodo(r.periodo)}`}
                    />
                  </Td>

                  {/* 13. OTROS — editable; persists OTHER_OUT */}
                  <Td width={W.otros} align="right">
                    <EditableTransactionCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="OTHER_OUT"
                      value={r.otros}
                      cobrado={transferido}
                      label={`Otros descuentos ${fmtPeriodo(r.periodo)}`}
                    />
                  </Td>

                  {/* 14. DÍA TRANSFERENCIA — click-to-edit (drives LANDLORD_PAYOUT) */}
                  <Td width={W.diatransf} align="center">
                    <InlineDateCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="LANDLORD_PAYOUT"
                      initialDate={r.diaTransf}
                      defaultAmount={Math.max(0, r.transferencia)}
                    />
                  </Td>

                  {/* 15. ADMI (total comisión = Galicia + BBVA 50/9 + BBVA 51/6) */}
                  <Td
                    width={W.admi}
                    align="right"
                    title={r.admi > 0
                      ? `ADMI = Galicia + BBVA 50/9 + BBVA 51/6 = ${fmtMoney(r.admGalicia)} + ${fmtMoney(r.admFrances509)} + ${fmtMoney(r.admFrances516)} = ${fmtMoney(r.admi)}`
                      : 'ADMI = comisión total. Aún sin COMMISSION_OUT en el período.'}
                  >
                    <span className={`tabular-nums ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admi)}
                    </span>
                  </Td>

                  {/* 16-18. ADM destinations — each one validates against the
                       total commission expected for the period: ingresos × pct.
                       Single destination > expected total triggers a confirm. */}

                  {/* 16-18. ADM destinations: labels are now plain text. The
                       destination marker (ADM_GALICIA / ADM_FRANCES_50_9 /
                       ADM_FRANCES_51_6) is appended automatically by
                       upsertCellTransaction at INSERT time — preventing the
                       double-suffix bug that came from labels containing the
                       destination code already. */}
                  {/* 16. ADM GALICIA */}
                  <Td width={W.galicia} align="right">
                    <EditableTransactionCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="COMMISSION_OUT"
                      destination="ADM_GALICIA"
                      value={r.admGalicia}
                      cobrado={transferido}
                      label="Comisión administración"
                      maxPlausibleComm={r.ingresos > 0 ? r.ingresos * (r.pct || 0) / 100 : 0}
                    />
                  </Td>

                  {/* 17. ADM FRANCÉS 50/9 */}
                  <Td width={W.fr509} align="right">
                    <EditableTransactionCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="COMMISSION_OUT"
                      destination="ADM_FRANCES_50_9"
                      value={r.admFrances509}
                      cobrado={transferido}
                      label="Comisión administración"
                      maxPlausibleComm={r.ingresos > 0 ? r.ingresos * (r.pct || 0) / 100 : 0}
                    />
                  </Td>

                  {/* 18. ADM FRANCÉS 51/6 */}
                  <Td width={W.fr516} align="right">
                    <EditableTransactionCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="COMMISSION_OUT"
                      destination="ADM_FRANCES_51_6"
                      value={r.admFrances516}
                      cobrado={transferido}
                      label="Comisión administración"
                      maxPlausibleComm={r.ingresos > 0 ? r.ingresos * (r.pct || 0) / 100 : 0}
                    />
                  </Td>

                  {/* 19. ESTADO — click cycles borrador → enviada → pagada → borrador */}
                  <Td width={W.estado} align="center">
                    <EditableStatusCell
                      contractId={r.contractId}
                      landlordId={r.landlordId}
                      period={r.periodo}
                      status={r.status}
                    />
                  </Td>

                  {/* 20. MAIL — Liquidar y enviar mail (per Alejandro's spec).
                       Hidden when the liquidación is already paid. Opens a
                       confirm modal with the prepared email; sending happens
                       via mailto: in the encargada's own mail client. */}
                  <Td width={W.mail} align="center">
                    <LiquidarYEnviarButton
                      contractId={r.contractId}
                      landlordId={r.landlordId}
                      period={r.periodo}
                      landlordName={r.propietario}
                      landlordEmail={r.propietarioEmail}
                      status={r.status}
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
  // EVERY header cell is sticky-top so the column titles stay visible during
  // vertical scroll inside the confined grid viewport. Cells that are ALSO
  // sticky-left (Observación / LFA / F. banco / Propietario) get an extra
  // left offset and a higher z-index so they form the "frozen corner" of
  // the freeze-panes layout.
  const stickyStyle: React.CSSProperties = sticky
    ? { position: 'sticky', top: 0, left, zIndex: 30, backgroundColor: '#f3f4f6' /* gray-100 */ }
    : { position: 'sticky', top: 0,        zIndex: 20, backgroundColor: '#f3f4f6' }
  return (
    <th
      style={{ width, minWidth: width, ...stickyStyle }}
      className={`px-2 py-1.5 border-r border-gray-300 ${alignCls}`}
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
      className={`px-2 py-1 border-r border-gray-200 ${alignCls} ${sticky ? bg ?? '' : ''}`}
      title={title}
    >
      {children}
    </td>
  )
}
