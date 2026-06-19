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
//   11 ALQUILER       (Phase 9C — was INGRESOS; now RENT_IN only)
//   12 EXTRAS         (Phase 9C — recuperos + signed adjustment, +/- coloring)
//   13 TRANSFERENCIA
//   14 OTROS
//   15 DÍA TRANSFERENCIA
//   16 ADMI
//   17 ADM GALICIA
//   18 ADM FRANCÉS 50/9
//   19 ADM FRANCÉS 51/6
//   20 ESTADO  (workflow status dot)
//   21 MAIL    (Liquidar y enviar)
//   22 CHECK   (Phase 7A validation badge)
//
// Three visual rules carry forward:
//   • Default "gris tenue" — value cells start in text-slate; flip to text-ink
//     only when the linked action is complete (fecha banco / día transf set).
//   • Light orange bg on the INGRESOS cell when the contract's next rent
//     adjustment is within 30 days (inline aviso de aumento).
//   • Cobro state vs. transferencia state — see comments below.
// ============================================================================

import Link from 'next/link'
import type { LiquidacionGridRow, LiquidacionStatus, LiquidacionGridTotals } from '@/lib/liquidacion/queries'
import type { LandlordOption } from '@/lib/landlord/queries'
import type { TenantOption } from '@/lib/tenant/queries'
import { fmtMoney } from '@/lib/format'
import { InlineDateCell } from './InlineDateCell'
import { InlineObservacionCell } from './InlineObservacionCell'
import { InlineParticipantsCell } from './InlineParticipantsCell'
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
import { InlineIvaToggleCell } from './InlineIvaToggleCell'
import { InlineMovimientosCell } from './InlineMovimientosCell'
import { ValidationBadgeCell } from './ValidationBadgeCell'
import { highestSeverity } from '@/lib/liquidacion/validations'
import {
  CONTRACT_EXPIRY_ROW_CLASSES,
  ALQUILER_AUMENTO_CELL_CLASS,
  CADENCE_SHORT,
  CADENCE_FULL,
} from '@/lib/liquidacion/thresholds'

interface Props {
  rows:            LiquidacionGridRow[]
  /** Phase 9B: column sums rendered as a sticky footer row. */
  totals:          LiquidacionGridTotals
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

/**
 * Translate translucent validation-tint classes into their fully opaque
 * Tailwind equivalents for use on sticky-left cells. The <tr> keeps its
 * 10%-alpha tint so non-sticky cells look unchanged, but the sticky <td>
 * needs a SOLID background — otherwise horizontally-scrolled cells bleed
 * through the sticky column and produce overlapping text.
 *
 *   bg-danger/10  →  bg-red-50      (visually matches over white paper)
 *   bg-warn/10    →  bg-orange-50   (same idea for warnings)
 *   anything else →  passed through (already solid: bg-white, bg-gray-50, bg-yellow-50)
 */
function solidifyForSticky(zebra: string): string {
  if (zebra === 'bg-danger/10') return 'bg-red-50'
  if (zebra === 'bg-warn/10')   return 'bg-orange-50'
  return zebra
}

// ── Column widths (in px). Sticky-left runs from col 1 → 4 (OBS, LFA,
//    FECHA BANCO, PROPIETARIO) to mirror Excel "freeze through column E"
//    behaviour. Left offsets are cumulative sums.
const W = {
  obs: 140, lfa: 50, fbanco: 70, prop: 150,
  expensas: 80, inq: 150,
  pct: 55,
  // Phase 10 — Cadence column. Short codes (Mens/Bim/Trim/Cuat/Sem/An)
  // keep the width tight; full label is shown in the tooltip together
  // with the next adjustment date.
  cadencia: 60,
  contrato: 115, deuda: 80, periodo: 70,
  // Phase 9C: ingresos column split into alquiler (RENT_IN only) and
  // extras (recuperos + signed adjustment). Keeping legacy `ingresos`
  // unused in the new layout but preserved for any old code paths.
  alquiler: 95, extras: 85,
  ingresos: 95, transf: 105, otros: 80,
  // Movs. — net of every transaction on the contract+period (IN - OUT).
  // Two-line label: amount on top, "N mov." underneath. Click opens the
  // editable Movimientos modal with Fecha/Mov./Monto/Razón columns.
  movim: 90,
  diatransf: 70,
  admi: 90,
  // IVA — embedded inside ADMI when contract.commission_includes_iva = true
  // (RI invoicer). Shows the 21% slice so the encargada can read the
  // breakdown matching the receipts ("ADM 9% + IVA = $100.188"). Renders
  // a muted dash for Monotributo contracts where no IVA applies.
  iva: 80,
  galicia: 85, fr509: 85, fr516: 85,
  estado: 55,
  // Column 20: Mail — per-row "Liquidar y enviar" action button.
  // Alejandro: "faltaría agregarle al final liquidar contrato y mandarle el mail."
  mail: 75,
  // Column 21: Check — per-row validation badge (Phase 7A).
  // Green ✓ if all checks pass; yellow / red count badge if there are
  // warnings / errors. Click → popover with the issue details.
  check: 55,
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

// ── Pago column helpers ────────────────────────────────────────────────────
// Per-row countdown until rent due date. Replaces the old "06/2026" column
// (same on every row, redundant with the page header).
function renderPaymentCell(r: LiquidacionGridRow, cobrado: boolean) {
  // Already paid this period.
  if (cobrado) {
    return <span className="text-[11px] text-success font-medium">✓ cobrado</span>
  }
  // Contract not active in this period.
  if (r.daysUntilPayment == null) {
    return <span className="text-[11px] text-slate/50">—</span>
  }
  const days = r.daysUntilPayment
  if (days > 0) {
    return (
      <span className="text-[11px] text-slate-dark tabular-nums">
        en {days} {days === 1 ? 'día' : 'días'}
      </span>
    )
  }
  if (days === 0) {
    return <span className="text-[11px] text-warn font-medium">vence hoy</span>
  }
  // days < 0 → overdue. Red and bold so it's unmistakable on scan.
  const overdue = Math.abs(days)
  return (
    <span className="text-[11px] text-danger font-medium tabular-nums">
      vencido {overdue} {overdue === 1 ? 'día' : 'días'}
    </span>
  )
}

function renderPaymentTooltip(r: LiquidacionGridRow): string {
  if (!r.dueDateIso) {
    return 'El contrato no está activo en este período.'
  }
  const [y, m, d] = r.dueDateIso.split('-')
  const dueLabel  = `${d}/${m}/${y}`
  const parts = [`Vence ${dueLabel}`, `Día de pago configurado: ${r.paymentDay}`]
  if (r.daysUntilPayment != null) {
    if (r.daysUntilPayment > 0)       parts.push(`Faltan ${r.daysUntilPayment} días`)
    else if (r.daysUntilPayment === 0) parts.push('Vence hoy')
    else                              parts.push(`Vencido hace ${Math.abs(r.daysUntilPayment)} días`)
  }
  return parts.join('\n')
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

export function LiquidacionGrid({ rows, totals, period, landlordOptions, tenantOptions }: Props) {
  if (rows.length === 0) {
    return (
      <section className="bg-paper border border-line p-6 text-center">
        <p className="text-[13px] text-slate">No hay contratos activos para este período.</p>
      </section>
    )
  }

  const tableMinWidth =
    W.obs + W.lfa + W.fbanco + W.prop + W.expensas + W.inq + W.pct + W.cadencia +
    W.contrato + W.deuda + W.periodo + W.alquiler + W.extras + W.transf + W.otros +
    W.movim + W.diatransf + W.admi + W.iva + W.galicia + W.fr509 + W.fr516 + W.estado + W.mail + W.check

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
              {/* 8 — Phase 10: Cadencia (aumento frequency) */}
              <Th width={W.cadencia} align="center">Cadencia</Th>
              {/* 9 */}<Th width={W.contrato} align="center">Contrato</Th>
              {/* 9 */}<Th width={W.deuda}    align="right">Deuda</Th>
              {/* 10 */}<Th width={W.periodo}   align="center">Pago</Th>
              {/* 11 */}<Th width={W.alquiler}  align="right">Alquiler</Th>
              {/* 12 */}<Th width={W.extras}    align="right">Extras</Th>
              {/* 12 */}<Th width={W.transf}    align="right">Transferencia</Th>
              {/* 13 */}<Th width={W.otros}     align="right">Otros</Th>
              {/* 13b */}<Th width={W.movim}    align="right">Movs.</Th>
              {/* 14 */}<Th width={W.diatransf} align="center">D. transf</Th>
              {/* 15 */}<Th width={W.admi}      align="right">ADMI</Th>
              {/* 15b */}<Th width={W.iva}      align="right">IVA</Th>
              {/* 16 */}<Th width={W.galicia}   align="right">Galicia</Th>
              {/* 17 */}<Th width={W.fr509}     align="right">BBVA 50/9</Th>
              {/* 18 */}<Th width={W.fr516}     align="right">BBVA 51/6</Th>
              {/* 19 */}<Th width={W.estado}    align="center">Estado</Th>
              {/* 20 */}<Th width={W.mail}      align="center">Mail</Th>
              {/* 21 */}<Th width={W.check}     align="center">Check</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              // Defensive: guard against any row that's somehow missing
              // fields we added in recent phases (validationIssues, the
              // Phase 9A tier, the Phase 9C splits). A single undefined
              // access would crash the whole grid render and surface as
              // the cryptic "Application error / Digest: …" page in
              // production. Default to safe values so a bad row is just
              // muted, not catastrophic.
              if (!r) return null
              const issues          = r.validationIssues ?? []
              const cobrado         = !!r.fechaBanco
              const transferido     = !!r.diaTransf
              const expiryStatus    = r.expiryRowStatus ?? 'normal'
              const expiryClass     = CONTRACT_EXPIRY_ROW_CLASSES[expiryStatus] ?? ''
              const aumentoClass    = r.periodHasAumento ? ALQUILER_AUMENTO_CELL_CLASS : ''
              const alquilerSum     = Number.isFinite(r.alquilerSum) ? r.alquilerSum : 0
              const extrasSum       = Number.isFinite(r.extrasSum)   ? r.extrasSum   : 0

              // Row background priority (high → low):
              //   1. Validation ERROR        → pale red tint   (most urgent)
              //   2. Validation WARNING      → pale orange tint
              //   3. Recently edited         → pale yellow tint
              //   4. Excel-style zebra       → white / very pale gray alternating
              //
              // Contract expiry tint is NOT on the row — it lives on the
              // Contrato cell (see `expiryClass` applied to <Td> below).
              // Alejandro's voice 2026-06-19: "el color vaya cambiando en
              // la columna de donde dice cuándo empieza y cuándo termina
              // el contrato." Moving it cell-side also removes the priority
              // conflict where validation tints used to mask the blues.
              //
              // Editing focus (`[&:has([data-editing])]:bg-blue-100` further
              // down) overrides all of these — clicking into a cell wins
              // visually regardless of validation state.
              const severity = highestSeverity(issues)
              const zebra = severity === 'error'
                ? 'bg-danger/10'
                : severity === 'warning'
                  ? 'bg-warn/10'
                  : r.wasRecentlyEdited
                    ? 'bg-yellow-50'
                    : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')

              // Sticky cells need an OPAQUE background so scrolling cells
              // don't bleed through. The <tr> keeps the translucent zebra
              // for the rest of the row; only the four sticky <td>s get the
              // solidified variant. See solidifyForSticky() at top of file.
              const zebraStickyBg = solidifyForSticky(zebra)

              return (
                <tr
                  key={`${r.contractId}-${r.landlordId}`}
                  data-contract-id={r.contractId}
                  className={`${zebra} hover:bg-blue-50 transition-colors border-b border-gray-200 [&:has([data-editing])]:bg-blue-100 [&:has([data-editing])]:ring-2 [&:has([data-editing])]:ring-info [&:has([data-editing])]:ring-inset`}
                >
                  {/* 1. OBSERVACIÓN — sticky */}
                  <Td sticky left={STICKY_LEFTS.obs} width={W.obs} bg={zebraStickyBg}>
                    <InlineObservacionCell
                      contractId={r.contractId}
                      landlordId={r.landlordId}
                      period={r.periodo}
                      initialNotes={r.observacion}
                      initialAdjustment={r.adjustmentAmount}
                    />
                  </Td>

                  {/* 2. LFA — sticky, editable dropdown */}
                  <Td sticky left={STICKY_LEFTS.lfa} width={W.lfa} bg={zebraStickyBg} align="center">
                    <EditableLfaCell contractId={r.contractId} value={r.lfa} />
                  </Td>

                  {/* 3. FECHA BANCO — sticky, click-to-edit (drives the RENT_IN cobro) */}
                  <Td sticky left={STICKY_LEFTS.fbanco} width={W.fbanco} bg={zebraStickyBg} align="center">
                    <InlineDateCell
                      contractId={r.contractId}
                      period={r.periodo}
                      typeCode="RENT_IN"
                      initialDate={r.fechaBanco}
                      defaultAmount={r.currentRent}
                    />
                  </Td>

                  {/* 4. PROPIETARIOS — sticky, multi-owner editor (Phase 11).
                       Reads all co-owners + their % from r.landlordsList.
                       Click → popover with chip-x 10s delete + Σ% pill. */}
                  <Td sticky left={STICKY_LEFTS.prop} width={W.prop} bg={zebraStickyBg}>
                    <InlineParticipantsCell
                      kind="landlord"
                      contractId={r.contractId}
                      initial={r.landlordsList.map(l => ({ id: l.id, name: l.name, pct: l.ownershipPct }))}
                      options={landlordOptions}
                      isOrphan={r.isOrphan && r.landlordsList.length === 0}
                      orphanReason={r.orphanReason}
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

                  {/* 6. INQUILINOS — multi-tenant editor (Phase 11) + ↗ to detail */}
                  <Td width={W.inq}>
                    <div className="flex items-start gap-1">
                      <div className="flex-1 min-w-0">
                        <InlineParticipantsCell
                          kind="tenant"
                          contractId={r.contractId}
                          initial={r.tenantsList.map(t => ({ id: t.id, name: t.name, pct: t.sharePct }))}
                          options={tenantOptions}
                          isOrphan={r.isOrphan && r.tenantsList.length === 0}
                          orphanReason={r.orphanReason}
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

                  {/* 8. CADENCIA — Phase 10. Read-only, derived from
                       contracts.cadence. Short code in the cell, full
                       label + next adjustment date in the tooltip. */}
                  {(() => {
                    const cad      = r.cadence ?? null
                    const short    = cad ? (CADENCE_SHORT[cad] ?? cad) : '—'
                    const fullLbl  = cad ? (CADENCE_FULL[cad]  ?? cad) : 'Sin cadencia configurada'
                    const tipParts: string[] = [fullLbl]
                    if (r.nextAdjustmentDateIso) {
                      const [yy, mm, dd] = r.nextAdjustmentDateIso.split('-')
                      tipParts.push(`Próximo aumento: ${dd}/${mm}/${yy}`)
                    }
                    if (r.daysUntilAdjustment != null && r.daysUntilAdjustment >= 0) {
                      tipParts.push(`(en ${r.daysUntilAdjustment} día${r.daysUntilAdjustment === 1 ? '' : 's'})`)
                    }
                    return (
                      <Td
                        width={W.cadencia}
                        align="center"
                        title={tipParts.join('\n')}
                      >
                        <span className={`text-[11px] ${cad ? 'text-ink' : 'text-slate/50'}`}>
                          {short}
                        </span>
                      </Td>
                    )
                  })()}

                  {/* 9. CONTRATO (vigencia) — editable date range.
                       2026-06-19: expiry tint lives HERE, on this cell.
                       Alejandro's voice: "el color vaya cambiando en la
                       columna de donde dice cuándo empieza y cuándo termina
                       el contrato." Celeste = next month, azul oscuro =
                       this month, red = expired. Validation row tints
                       (error / warning) coexist on the row independently. */}
                  <Td
                    width={W.contrato}
                    align="center"
                    className={expiryClass}
                    title={
                      expiryStatus === 'expired'
                        ? `Contrato vencido hace ${Math.abs(r.daysUntilContractEnd ?? 0)} días — hablar con el inquilino`
                        : expiryStatus === 'this_month'
                          ? `Vence este mes${r.daysUntilContractEnd != null ? ` (en ${r.daysUntilContractEnd} días)` : ''} — preparar renovación o rescisión`
                          : expiryStatus === 'next_month'
                            ? `Vence el mes que viene${r.daysUntilContractEnd != null ? ` (en ${r.daysUntilContractEnd} días)` : ''} — empezar la conversación de renovación`
                            : undefined
                    }
                  >
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

                  {/* 10. PAGO — countdown until the contract's payment_day
                       for this period. "✓ cobrado" when the rent has already
                       been deposited (r.fechaBanco is set). Replaces the
                       redundant "06/2026" period cell (same value every row,
                       already shown in the page header). */}
                  <Td
                    width={W.periodo}
                    align="center"
                    title={renderPaymentTooltip(r)}
                  >
                    {renderPaymentCell(r, cobrado)}
                  </Td>

                  {/* 11. ALQUILER — Phase 9C, RENT_IN-only popover.
                       Alejandro: "figura a simple vista cuál es el alquiler."
                       Persistent light-blue tint when this period contains a
                       rent-adjustment date (r.periodHasAumento). The tint
                       stays after cobro is registered — that's the visual
                       confirmation the cobro arrived WITH the increase.
                       Class lives in lib/liquidacion/thresholds.ts. */}
                  {(() => {
                    // Expected target shown in light gray when nothing has been
                    // collected yet. When includesAbl=true the target adds the
                    // recurring ABL surcharge so the encargada sees the real
                    // cobro figure she should be expecting from the tenant.
                    const expectedTarget = r.currentRent + (r.includesAbl ? r.ablAmount : 0)
                    const ablTooltip = r.includesAbl && r.ablAmount > 0
                      ? `Esperado: ${fmtMoney(r.currentRent)} alquiler + ${fmtMoney(r.ablAmount)} ABL = ${fmtMoney(expectedTarget)}`
                      : null
                    const aumentoTooltip = r.periodHasAumento
                      ? 'Este período tuvo un aumento aplicado — confirmá que el cobro vino con el nuevo monto.'
                      : null
                    const buttonTitle = [aumentoTooltip, ablTooltip].filter(Boolean).join(' · ') || undefined
                    return (
                      <Td width={W.alquiler} align="right">
                        <InlineIngresosCell
                          contractId={r.contractId}
                          period={r.periodo}
                          lines={r.ingresosLines}
                          total={alquilerSum}
                          cobrado={cobrado}
                          upcomingAdjustment={r.hasUpcomingAdjustment && r.daysUntilAdjustment != null
                            ? { days: r.daysUntilAdjustment }
                            : null}
                          onlyTypes={['RENT_IN']}
                          defaultNewLineType="RENT_IN"
                          popoverTitle="Alquiler — Sólo cobros de RENT_IN"
                          cellBgClass={aumentoClass}
                          buttonTitle={buttonTitle}
                          // Show the expected target when no RENT_IN has
                          // landed yet. Target = current_rent + ABL when the
                          // contract has the ABL surcharge enabled. Text color
                          // falls back to the cell's cobrado=false light-slate,
                          // so light-gray = unpaid, dark = paid (same visual
                          // code as every other amount cell). Per Alejandro
                          // 2026-06-18 + 2026-06-19 voices.
                          displayOverride={alquilerSum === 0 && expectedTarget > 0
                            ? (
                              <span className="tabular-nums">
                                {fmtMoney(expectedTarget)}
                                {r.includesAbl && r.ablAmount > 0 && (
                                  <span className="block text-[9px] text-slate normal-case font-normal">
                                    incluye ABL
                                  </span>
                                )}
                              </span>
                            )
                            : undefined}
                        />
                      </Td>
                    )
                  })()}

                  {/* 12. EXTRAS — Phase 9C, everything except RENT_IN.
                       Recuperos (ABL/gas/etc.) + signed adjustment from
                       Observación. Can be POSITIVE (tenant overpaid /
                       recuperos) or NEGATIVE (discount in adjustment).
                       Adjustment editing still lives in Observación; the
                       Extras display value just MIRRORS the math. */}
                  <Td width={W.extras} align="right">
                    <InlineIngresosCell
                      contractId={r.contractId}
                      period={r.periodo}
                      lines={r.ingresosLines}
                      total={extrasSum}
                      cobrado={cobrado}
                      excludeTypes={['RENT_IN']}
                      defaultNewLineType="RECUPERO_ABL_IN"
                      popoverTitle="Extras — Recuperos del período (sin alquiler)"
                      cellBgClass={
                        extrasSum > 0
                          ? 'text-success'
                          : extrasSum < 0
                            ? 'text-danger'
                            : ''
                      }
                      displayOverride={
                        // Pre-rendered server-side so we never pass a
                        // function across the RSC boundary — that throws
                        // an opaque "Server Components render" error
                        // whose message is stripped in production builds.
                        // Show the +/- sign explicitly so the encargada
                        // sees instantly whether the extras line is a
                        // recupero (+) or a discount (-).
                        extrasSum === 0
                          ? <span className="text-gray-400">—</span>
                          : <>{extrasSum > 0 ? '+' : ''}{fmtMoney(extrasSum)}</>
                      }
                      buttonTitle={
                        extrasSum > 0
                          ? 'Recuperos cobrados — click para ver / editar'
                          : extrasSum < 0
                            ? 'Hay un descuento (ajuste negativo) — editar en Observación'
                            : 'Click para registrar un recupero (ABL, gas, etc.)'
                      }
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

                  {/* 13b. MOVS. — click opens the per-contract cashflow modal. */}
                  <Td width={W.movim} align="right">
                    <InlineMovimientosCell
                      contractId={r.contractId}
                      period={r.periodo}
                      totalIn={r.movimientosTotalIn}
                      totalOut={r.movimientosTotalOut}
                      count={r.movimientosCount}
                      contractLabel={`${r.propietario} · Inquilino: ${r.inquilino}`}
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
                    title={(() => {
                      if (r.admi <= 0) return 'ADMI = comisión total. Aún sin COMMISSION_OUT en el período.'
                      const ivaSuffix = r.commissionIncludesIva
                        ? `\nIncluye IVA 21%: ${fmtMoney(r.iva)} sobre neto ${fmtMoney(r.admi - r.iva)}`
                        : '\nSin IVA (administrador Monotributo).'
                      return `ADMI = Galicia + BBVA 50/9 + BBVA 51/6 = ${fmtMoney(r.admGalicia)} + ${fmtMoney(r.admFrances509)} + ${fmtMoney(r.admFrances516)} = ${fmtMoney(r.admi)}.${ivaSuffix}`
                    })()}
                  >
                    <span className={`tabular-nums ${cellTextClass(transferido)}`}>
                      {fmtMoneyOr(r.admi)}
                    </span>
                  </Td>

                  {/* 15b. IVA — embedded inside ADMI for RI-invoiced contracts.
                       Click to toggle commission_includes_iva on the contract.
                       Derived as admi × 0.21 / 1.21 when the flag is on so the
                       encargada sees the slice without re-doing the math. */}
                  <Td width={W.iva} align="right">
                    <InlineIvaToggleCell
                      contractId={r.contractId}
                      includesIva={r.commissionIncludesIva}
                      ivaAmount={r.iva}
                      adminNet={r.admi - r.iva}
                      amountClassName={cellTextClass(transferido)}
                    />
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

                  {/* 21. CHECK — per-row validation badge (Phase 7A).
                       Green ✓ if all 7 cross-cell checks pass. Yellow/red
                       count badge if there are warnings/errors. Click →
                       popover with each issue's message, expected, actual,
                       and difference. */}
                  <Td width={W.check} align="center">
                    <ValidationBadgeCell issues={issues} />
                  </Td>
                </tr>
              )
            })}
          </tbody>

          {/* Phase 9B: sticky-bottom footer with column sums. Alejandro:
              "al fin de la columna poner el monto que da de suma total."
              Each <Tf> tracks its column's width so the total lines up
              exactly under the data. Empty cells render blank. */}
          <tfoot className="bg-gray-100 text-[11px] font-medium text-ink">
            <tr className="border-t-2 border-gray-300">
              <Tf sticky left={STICKY_LEFTS.obs}    width={W.obs}    align="left">TOTAL</Tf>
              <Tf sticky left={STICKY_LEFTS.lfa}    width={W.lfa}    align="center" />
              <Tf sticky left={STICKY_LEFTS.fbanco} width={W.fbanco} align="center" />
              <Tf sticky left={STICKY_LEFTS.prop}   width={W.prop}   align="right">{`${rows.length} contratos`}</Tf>
              <Tf width={W.expensas}  align="right" tabular>{footerMoney(totals.expensas)}</Tf>
              <Tf width={W.inq}                         />
              <Tf width={W.pct}       align="right"     />
              <Tf width={W.cadencia}  align="center"    />
              <Tf width={W.contrato}  align="center"    />
              <Tf width={W.deuda}     align="right" tabular>{footerMoney(totals.deuda)}</Tf>
              <Tf width={W.periodo}   align="center"    />
              <Tf width={W.alquiler}  align="right" tabular>{footerMoney(totals.alquiler)}</Tf>
              <Tf width={W.extras}    align="right" tabular>{footerMoney(totals.extras)}</Tf>
              <Tf width={W.transf}    align="right" tabular>{footerMoney(totals.transferencia)}</Tf>
              <Tf width={W.otros}     align="right" tabular>{footerMoney(totals.otros)}</Tf>
              <Tf width={W.movim}     align="right"    />
              <Tf width={W.diatransf} align="center"    />
              <Tf width={W.admi}      align="right" tabular>{footerMoney(totals.admi)}</Tf>
              <Tf width={W.iva}       align="right" tabular>{footerMoney(totals.iva)}</Tf>
              <Tf width={W.galicia}   align="right" tabular>{footerMoney(totals.admGalicia)}</Tf>
              <Tf width={W.fr509}     align="right" tabular>{footerMoney(totals.admFrances509)}</Tf>
              <Tf width={W.fr516}     align="right" tabular>{footerMoney(totals.admFrances516)}</Tf>
              <Tf width={W.estado}    align="center"    />
              <Tf width={W.mail}      align="center"    />
              <Tf width={W.check}     align="center"    />
            </tr>
          </tfoot>
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
  children:   React.ReactNode
  width:      number
  align?:     'left' | 'right' | 'center'
  sticky?:    boolean
  left?:      number
  bg?:        string
  title?:     string
  style?:     React.CSSProperties
  /** Extra Tailwind classes merged after the defaults — used for the
   *  Phase 9A Contrato tier tint and Phase 9C +/- coloring. */
  className?: string
}

function Td({ children, width, align = 'left', sticky, left, bg, title, style, className = '' }: TdProps) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const stickyStyle: React.CSSProperties = sticky
    ? { position: 'sticky', left, zIndex: 10 }
    : {}
  return (
    <td
      style={{ width, minWidth: width, ...stickyStyle, ...style }}
      className={`px-2 py-1 border-r border-gray-200 ${alignCls} ${sticky ? bg ?? '' : ''} ${className}`}
      title={title}
    >
      {children}
    </td>
  )
}

// ── Phase 9B: footer-cell primitive ────────────────────────────────────────
//
// Same width / sticky semantics as Td but with a fixed bg (so vertical
// sticky doesn't bleed) and bottom: 0 sticky positioning so the totals
// row stays glued to the bottom of the scroll viewport. Numeric cells
// receive `tabular` to align columns of money exactly under their data.

interface TfProps {
  children?: React.ReactNode
  width:     number
  align?:    'left' | 'right' | 'center'
  sticky?:   boolean
  left?:     number
  tabular?:  boolean
}

function Tf({ children, width, align = 'left', sticky, left, tabular }: TfProps) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  // Stick to the bottom of the scroll viewport always. Sticky-left cells
  // (Observación / LFA / F. banco / Propietario) ALSO stick to the left
  // to form the frozen freeze-panes corner that matches the header.
  const stickyStyle: React.CSSProperties = sticky
    ? { position: 'sticky', bottom: 0, left, zIndex: 25, backgroundColor: '#f3f4f6' }
    : { position: 'sticky', bottom: 0,        zIndex: 15, backgroundColor: '#f3f4f6' }
  return (
    <td
      style={{ width, minWidth: width, ...stickyStyle }}
      className={`px-2 py-1.5 border-r border-gray-300 border-t-2 border-t-gray-400 ${alignCls} ${tabular ? 'tabular-nums' : ''}`}
    >
      {children}
    </td>
  )
}

/** Display zero as a muted "—" in the footer so the row isn't a wall of
 *  $0 noise. Any non-zero value uses the standard money formatter. */
function footerMoney(n: number): React.ReactNode {
  if (n === 0) return <span className="text-gray-400">—</span>
  return fmtMoney(n)
}
