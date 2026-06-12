import Link from 'next/link'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { Badge } from '@/components/ui/Badge'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { MarkAsSentButton } from '@/components/pending/MarkAsSentButton'
import {
  listPendingActions,
  CATEGORY_LABEL,
  CATEGORY_DESCRIPTION,
  type PendingCategory,
  type PendingRow,
} from '@/lib/pending/queries'
import { fmtMoney as fmt } from '@/lib/format'

interface PageProps {
  searchParams: Promise<{ tipo?: string }>
}

const CATEGORY_TONE: Record<PendingCategory, 'danger' | 'warn' | 'info'> = {
  cobranza:   'danger',
  aumento:    'warn',
  renovacion: 'info',
}

export default async function PendientesPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const filter = (sp.tipo as PendingCategory | undefined) ?? null

  const { rows, counts } = await listPendingActions()
  const filtered = filter ? rows.filter(r => r.category === filter) : rows

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Pendientes</strong> ·{' '}
            {filter
              ? `${filtered.length} ${CATEGORY_LABEL[filter].toLowerCase()}`
              : `${counts.total} acciones requieren tu atención`}
          </p>
          <p className="label-cap text-slate hidden sm:block">Datos en vivo</p>
        </div>

        {/* Category filter pills */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          <CategoryPill href="/pendientes"                 label="Todas"               count={counts.total}      active={!filter} />
          <CategoryPill href="/pendientes?tipo=cobranza"   label="Cobranza vencida"    count={counts.cobranza}   active={filter === 'cobranza'}   tone="danger" />
          <CategoryPill href="/pendientes?tipo=aumento"    label="Aviso de aumento"    count={counts.aumento}    active={filter === 'aumento'}    tone="warn" />
          <CategoryPill href="/pendientes?tipo=renovacion" label="Renovación"          count={counts.renovacion} active={filter === 'renovacion'} tone="info" />
        </div>
      </StickyHeader>

      {filter && (
        <p className="mt-4 text-[12px] text-slate-dark bg-cream-2/60 border border-line rounded px-3 py-2">
          {CATEGORY_DESCRIPTION[filter]}
        </p>
      )}

      <section className="mt-4 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Listado</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Cobranzas primero, luego por fecha de vencimiento. Tocá una fila para ir al contrato.
            </p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</p>
        </div>

        <div className="overflow-x-auto">
          {filtered.length > 0 ? (
            <table className="w-full text-[13px] min-w-[1040px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Tipo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Alquiler</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Plazo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Email disponible</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <Row key={`${r.contractId}-${r.category}`} r={r} odd={idx % 2 === 0} />
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">
                {filter
                  ? `Ninguna acción de tipo "${CATEGORY_LABEL[filter]}" pendiente.`
                  : 'Todo al día — sin acciones pendientes.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function Row({ r, odd }: { r: PendingRow; odd: boolean }) {
  const isPast = r.daysUntilDeadline < 0
  const plazoTxt = isPast
    ? `${Math.abs(r.daysUntilDeadline)} día${Math.abs(r.daysUntilDeadline) === 1 ? '' : 's'} atrasado`
    : `en ${r.daysUntilDeadline} día${r.daysUntilDeadline === 1 ? '' : 's'}`
  const plazoClass = isPast ? 'text-danger font-medium' : 'text-slate-dark'

  // Email availability — the row's purpose is to send an email, so flag missing
  const needsTenant   = r.category === 'cobranza' || r.category === 'aumento'
  const needsLandlord = r.category === 'renovacion' || r.category === 'aumento'

  const missing: string[] = []
  if (needsTenant   && !r.tenantEmail)   missing.push('inquilino')
  if (needsLandlord && !r.landlordEmail) missing.push('propietario')

  return (
    <ClickableRow
      href={`/contratos/${r.contractId}`}
      title={r.reason}
      className={`${odd ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}
    >
      <td className="px-4 py-1.5 border-r border-line/30">
        <Badge tone={CATEGORY_TONE[r.category]}>{CATEGORY_LABEL[r.category]}</Badge>
      </td>
      <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">{r.tenantName}</td>
      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{r.landlordName}</td>
      <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">
        {r.currentRent > 0 ? fmt(r.currentRent) : ''}
      </td>
      <td className={`px-4 py-1.5 border-r border-line/30 ${plazoClass}`}>{plazoTxt}</td>
      <td className="px-4 py-1.5 border-r border-line/30">
        {missing.length === 0 ? (
          <span className="text-success text-[12px]">✓ disponible</span>
        ) : (
          <span className="text-danger text-[12px]">
            falta email de {missing.join(' y ')}
          </span>
        )}
      </td>
      <td className="px-4 py-1.5 text-right">
        <MarkAsSentButton contractId={r.contractId} category={r.category} />
      </td>
    </ClickableRow>
  )
}

function CategoryPill({
  href, label, count, active, tone,
}: {
  href: string; label: string; count: number; active: boolean; tone?: 'danger' | 'warn' | 'info'
}) {
  const toneClass = !active && tone
    ? tone === 'danger' ? 'border-danger/30 text-danger'
    : tone === 'warn'   ? 'border-warn/40 text-warn'
    :                     'border-info/40 text-info'
    : ''
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors shrink-0',
        active
          ? 'bg-ink text-paper border-ink'
          : `bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30 ${toneClass}`,
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={[
        'inline-flex items-center justify-center text-[10px] font-medium tabular-nums px-1.5 rounded',
        active ? 'bg-paper/15 text-paper' : 'bg-line/60 text-slate-dark',
      ].join(' ')}>
        {count}
      </span>
    </Link>
  )
}
