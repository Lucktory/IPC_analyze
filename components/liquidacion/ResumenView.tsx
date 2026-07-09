// ============================================================================
// ResumenView — period-wide aggregate of the embudo. Derived from the SAME
// `LiquidacionGridRow[]` the grid uses so the totals can't drift from the
// per-row data shown above.
//
//   TOTAL COBRADO  ──►  COMISIÓN  ──►  OTROS  ──►  TRANSFERIDO AL PROPIETARIO
//
// Visual: four KPI tiles + a horizontal stacked bar that shows the
// proportion of each slice against TOTAL COBRADO.
// ============================================================================

import type { LiquidacionGridRow } from '@/lib/liquidacion/queries'
import type { HonorariosPeriod } from '@/lib/contract/events-bulk'
import { periodLabel } from '@/lib/period'
import { fmtMoney } from '@/lib/format'

interface Props {
  rows:       LiquidacionGridRow[]
  period:     string
  honorarios: HonorariosPeriod
}

export function ResumenView({ rows, period, honorarios }: Props) {
  const totalIngresos     = rows.reduce((s, r) => s + r.ingresos,      0)
  const totalAdmi         = rows.reduce((s, r) => s + r.admi,          0)
  const totalOtros        = rows.reduce((s, r) => s + r.otros,         0)
  const totalTransferido  = Math.max(0, totalIngresos - totalAdmi - totalOtros)
  const cobrados          = rows.filter(r => !!r.fechaBanco).length
  const transferidos      = rows.filter(r => !!r.diaTransf).length

  // Status counts — gives the encargada a snapshot of where the workflow is
  const byStatus = { draft: 0, sent: 0, paid: 0 }
  for (const r of rows) byStatus[r.status]++

  const pct = (n: number) => totalIngresos > 0 ? (n / totalIngresos) * 100 : 0
  const pctAdmi   = pct(totalAdmi)
  const pctOtros  = pct(totalOtros)
  const pctNeto   = pct(totalTransferido)

  if (rows.length === 0) {
    return (
      <section className="bg-paper border border-line rounded shadow-card p-10 text-center">
        <p className="text-[14px] text-slate">No hay contratos activos para este período.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {/* ── Four-tile embudo summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile
          label="Total cobrado"
          value={fmtMoney(totalIngresos)}
          hint={`${cobrados} de ${rows.length} contratos con cobro registrado`}
          tone="ink"
        />
        <SummaryTile
          label="Comisión administración"
          value={fmtMoney(totalAdmi)}
          hint={`${pctAdmi.toFixed(1)}% efectivo sobre cobrado`}
          tone="success"
        />
        <SummaryTile
          label="Otros descuentos"
          value={fmtMoney(totalOtros)}
          hint={`${pctOtros.toFixed(1)}% de lo cobrado · expensas, ABL, servicios`}
          tone="warn"
        />
        <SummaryTile
          label="Transferido al propietario"
          value={fmtMoney(totalTransferido)}
          hint={`${pctNeto.toFixed(1)}% del cobrado · ${transferidos} transferencias hechas`}
          tone="info"
        />
      </div>

      {/* ── Ingresos de la inmobiliaria — administración (mensual) + honorarios (una vez) ── */}
      <div className="bg-paper border border-line border-l-2 border-l-info rounded shadow-card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-[15px] font-medium text-ink">Ingresos de la inmobiliaria</h2>
          <p className="text-[12px] text-slate">{periodLabel(period)}</p>
        </div>
        <dl className="space-y-2 text-[13px] max-w-[460px]">
          <div className="flex items-center justify-between">
            <dt className="text-slate">Administración (mensual)</dt>
            <dd className="tabular-nums text-ink">{fmtMoney(totalAdmi)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate">Honorarios (una vez · {honorarios.lines.length})</dt>
            <dd className="tabular-nums text-ink">{fmtMoney(honorarios.total)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2">
            <dt className="text-ink font-medium">Total ingreso inmobiliaria</dt>
            <dd className="tabular-nums text-info font-semibold">{fmtMoney(totalAdmi + honorarios.total)}</dd>
          </div>
        </dl>
        {honorarios.lines.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-line space-y-1 max-w-[460px]">
            {honorarios.lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-[11.5px]">
                <span className="text-slate-dark truncate min-w-0">
                  {l.contractNumber && <span className="tabular-nums text-slate">{l.contractNumber} · </span>}{l.description}
                </span>
                <span className="tabular-nums text-slate shrink-0">{fmtMoney(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate mt-3 italic">
          Los honorarios se cargan desde la celda Observaciones del contrato, en el mes de la renovación / contrato nuevo. No entran en la liquidación del dueño.
        </p>
      </div>

      {/* ── Horizontal stacked bar — proportional view of where the cobro went ── */}
      <div className="bg-paper border border-line rounded shadow-card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-[15px] font-medium text-ink">Distribución del cobro</h2>
          <p className="text-[12px] text-slate">{periodLabel(period)}</p>
        </div>
        {totalIngresos > 0 ? (
          <>
            <div className="h-7 w-full rounded overflow-hidden flex border border-line/60">
              <BarSeg widthPct={pctNeto}  className="bg-info"    title={`Transferido: ${fmtMoney(totalTransferido)} (${pctNeto.toFixed(1)}%)`} />
              <BarSeg widthPct={pctAdmi}  className="bg-success" title={`Comisión: ${fmtMoney(totalAdmi)} (${pctAdmi.toFixed(1)}%)`} />
              <BarSeg widthPct={pctOtros} className="bg-warn"    title={`Otros descuentos: ${fmtMoney(totalOtros)} (${pctOtros.toFixed(1)}%)`} />
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-[12px]">
              <Legend swatch="bg-info"    label="Transferido"           value={fmtMoney(totalTransferido)} pct={pctNeto} />
              <Legend swatch="bg-success" label="Comisión administración" value={fmtMoney(totalAdmi)} pct={pctAdmi} />
              <Legend swatch="bg-warn"    label="Otros descuentos"      value={fmtMoney(totalOtros)}   pct={pctOtros} />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-slate">Sin ingresos registrados aún en este período.</p>
        )}
      </div>

      {/* ── Status workflow snapshot ── */}
      <div className="bg-paper border border-line rounded shadow-card p-5">
        <h2 className="font-display text-[15px] font-medium text-ink mb-3">Estado de la liquidación</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatusTile label="Borrador" count={byStatus.draft} total={rows.length} dotClass="bg-slate" />
          <StatusTile label="Enviadas" count={byStatus.sent}  total={rows.length} dotClass="bg-success" />
          <StatusTile label="Pagadas"  count={byStatus.paid}  total={rows.length} dotClass="bg-info" />
        </div>
        <p className="text-[11px] text-slate mt-4">
          Flujo: <span className="font-medium">borrador → enviada → pagada</span>. La acción se confirma
          desde la grilla o desde el detalle de cada contrato.
        </p>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function SummaryTile({
  label, value, hint, tone,
}: {
  label: string
  value: string
  hint:  string
  tone:  'ink' | 'success' | 'warn' | 'info'
}) {
  const accent =
    tone === 'success' ? 'border-l-success' :
    tone === 'warn'    ? 'border-l-warn'    :
    tone === 'info'    ? 'border-l-info'    :
                         'border-l-ink'
  return (
    <div className={`bg-paper border border-line border-l-2 ${accent} rounded shadow-card p-4`}>
      <p className="label-cap text-slate">{label}</p>
      <p className="font-display text-[22px] text-ink mt-1 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate mt-1 leading-tight">{hint}</p>
    </div>
  )
}

function BarSeg({ widthPct, className, title }: { widthPct: number; className: string; title: string }) {
  if (widthPct <= 0) return null
  return (
    <div
      className={`${className} h-full transition-all`}
      style={{ width: `${widthPct}%` }}
      title={title}
    />
  )
}

function Legend({ swatch, label, value, pct }: { swatch: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${swatch}`} />
      <span className="text-slate-dark">{label}</span>
      <span className="text-ink font-medium tabular-nums">{value}</span>
      <span className="text-slate tabular-nums">({pct.toFixed(1)}%)</span>
    </div>
  )
}

function StatusTile({ label, count, total, dotClass }: { label: string; count: number; total: number; dotClass: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="border border-line rounded p-3 bg-cream/30">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
        <span className="text-[12px] text-slate-dark font-medium">{label}</span>
      </div>
      <p className="font-display text-[20px] text-ink mt-1 tabular-nums">{count}</p>
      <p className="text-[11px] text-slate tabular-nums">{pct.toFixed(0)}% del total</p>
    </div>
  )
}
