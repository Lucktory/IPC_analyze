import Link from 'next/link'
import { getPendientesDigest, type PendienteItem, type Severity, type StreamType } from '@/lib/pending/digest'
import { fmtMoney } from '@/lib/format'

// Always-dynamic — pendientes change every minute, never serve from cache.
export const dynamic     = 'force-dynamic'
export const fetchCache  = 'force-no-store'

interface PageProps {
  searchParams: Promise<{ severity?: string; type?: string }>
}

const SEVERITY_ORDER: Severity[] = ['urgente', 'importante', 'proximo', 'aviso']

const SEVERITY_META: Record<Severity, { label: string; icon: string; dot: string; banner: string; ringActive: string }> = {
  urgente:    { label: 'Urgente — acción hoy',      icon: '🔴', dot: 'bg-danger',  banner: 'bg-danger/10 border-danger/30 text-ink',     ringActive: 'ring-danger'  },
  importante: { label: 'Importante — esta semana',  icon: '🟡', dot: 'bg-warn',    banner: 'bg-warn/10 border-warn/30 text-ink',         ringActive: 'ring-warn'    },
  proximo:    { label: 'Próximo — próximas semanas',icon: '🟠', dot: 'bg-info/60', banner: 'bg-info/10 border-info/30 text-ink',         ringActive: 'ring-info'    },
  aviso:      { label: 'Avisos — revisar cuando puedas', icon: '🔵', dot: 'bg-slate/50', banner: 'bg-slate/10 border-slate/30 text-ink', ringActive: 'ring-slate'   },
}

const TYPE_META: Record<StreamType, { label: string; emoji: string }> = {
  cobranza:   { label: 'Cobranza',   emoji: '💰' },
  aumento:    { label: 'Aumento',    emoji: '📈' },
  validacion: { label: 'Validación', emoji: '⚠️'  },
  workflow:   { label: 'Workflow',   emoji: '📤' },
  contrato:   { label: 'Contrato',   emoji: '📄' },
  datos:      { label: 'Datos',      emoji: '🗂️' },
}

export default async function PendientesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const severityFilter: Severity | null =
    sp.severity === 'urgente' || sp.severity === 'importante' || sp.severity === 'proximo' || sp.severity === 'aviso'
      ? sp.severity : null
  const typeFilter: StreamType | null =
    sp.type === 'cobranza' || sp.type === 'aumento' || sp.type === 'validacion' ||
    sp.type === 'workflow' || sp.type === 'contrato' || sp.type === 'datos'
      ? sp.type : null

  const { items, counts, period } = await getPendientesDigest()

  const filtered = items.filter(it =>
    (!severityFilter || it.severity === severityFilter) &&
    (!typeFilter     || it.type     === typeFilter)
  )

  // Group filtered items by severity for the accordion sections.
  const grouped: Record<Severity, PendienteItem[]> = {
    urgente: [], importante: [], proximo: [], aviso: [],
  }
  for (const item of filtered) grouped[item.severity].push(item)

  function linkWith(overrides: Partial<{ severity: Severity | null; type: StreamType | null }>) {
    const merged = { severity: severityFilter, type: typeFilter, ...overrides }
    const qs = new URLSearchParams()
    if (merged.severity) qs.set('severity', merged.severity)
    if (merged.type)     qs.set('type', merged.type)
    return qs.size > 0 ? `/pendientes?${qs.toString()}` : '/pendientes'
  }

  return (
    <>
      <div className="flex-none">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Pendientes</strong>
            {' · '}
            <span className="text-slate">{counts.total} {counts.total === 1 ? 'acción' : 'acciones'} requieren atención · período {periodLabel(period)}</span>
          </p>
        </div>

        {/* ─── Severity KPI strip — click any chip to filter ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-3">
          {SEVERITY_ORDER.map(sev => {
            const meta = SEVERITY_META[sev]
            const active = severityFilter === sev
            return (
              <Link
                key={sev}
                href={linkWith({ severity: active ? null : sev })}
                className={`flex items-center justify-between gap-2 border rounded px-3 py-2 transition-all hover:bg-cream-2 ${meta.banner} ${active ? `ring-2 ${meta.ringActive} ring-inset` : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} aria-hidden />
                  <span className="text-[11px] uppercase tracking-wider font-medium truncate">{meta.label.split('—')[0].trim()}</span>
                </div>
                <span className="font-display text-[18px] tabular-nums text-ink shrink-0">{counts[sev]}</span>
              </Link>
            )
          })}
        </div>

        {/* ─── Type filter pills ─── */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] pb-2">
          <span className="label-cap text-slate shrink-0">Tipo</span>
          <TypePill href={linkWith({ type: null })} label="Todos" active={!typeFilter} />
          {(Object.keys(TYPE_META) as StreamType[]).map(t => {
            const cnt = items.filter(i =>
              (!severityFilter || i.severity === severityFilter) && i.type === t
            ).length
            if (cnt === 0 && typeFilter !== t) return null
            return (
              <TypePill
                key={t}
                href={linkWith({ type: typeFilter === t ? null : t })}
                label={`${TYPE_META[t].emoji} ${TYPE_META[t].label}`}
                count={cnt}
                active={typeFilter === t}
              />
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto mt-2 space-y-4 pb-8">
        {SEVERITY_ORDER.map(sev => {
          const list = grouped[sev]
          if (list.length === 0) return null
          const meta = SEVERITY_META[sev]
          return (
            <section key={sev} className="bg-paper border border-line rounded overflow-hidden">
              <div className={`px-4 py-2 border-b border-line flex items-center justify-between ${meta.banner}`}>
                <h2 className="font-display text-[14px] font-medium flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </h2>
                <span className="text-[11px] text-slate-dark tabular-nums">{list.length} {list.length === 1 ? 'ítem' : 'ítems'}</span>
              </div>
              <ul>
                {list.map(item => <PendienteRow key={item.id} item={item} period={period} />)}
              </ul>
            </section>
          )
        })}

        {filtered.length === 0 && (
          <div className="bg-paper border border-line rounded p-10 text-center">
            <p className="text-[14px] text-slate">
              {counts.total === 0
                ? 'Todo al día — sin pendientes.'
                : `Sin pendientes${severityFilter ? ` de severidad "${severityFilter}"` : ''}${typeFilter ? ` de tipo "${typeFilter}"` : ''}.`}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function PendienteRow({ item, period }: { item: PendienteItem; period: string }) {
  const typeMeta = TYPE_META[item.type]
  // Suggested action wiring:
  //   • cobranza + tenant phone → WhatsApp deep link
  //   • everything else → "Ver fila" jump to the planilla
  const isCobranzaWithPhone = item.type === 'cobranza' && item.tenantPhone
  const whatsappHref = isCobranzaWithPhone
    ? buildWhatsappHref(item.tenantPhone!, buildCobranzaTemplate(item))
    : null

  const verFilaHref = `/liquidacion?period=${period}&highlight=${item.contractId}`

  return (
    <li className="px-4 py-2 border-b border-line/40 last:border-b-0 flex items-center gap-3 hover:bg-cream-2/50 transition-colors">
      <span className="text-[15px] shrink-0" aria-hidden>{typeMeta.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-ink leading-snug">
          <strong className="font-medium">{item.tenantName}</strong>
          <span className="text-slate"> · prop. </span>
          <span className="text-slate-dark">{item.landlordName}</span>
        </p>
        <p className="text-[11.5px] text-slate-dark mt-0.5 leading-snug">
          <strong className="text-ink">{item.title}</strong>
          {' — '}
          {item.detail}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.amount != null && item.amount > 0 && (
          <span className="text-[12px] tabular-nums text-slate-dark">{fmtMoney(item.amount)}</span>
        )}
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Mandar recordatorio por WhatsApp"
            className="px-2 py-1 rounded bg-success text-paper text-[11px] font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1"
          >
            📱 WhatsApp
          </a>
        )}
        <Link
          href={verFilaHref}
          className="px-2 py-1 rounded border border-line text-slate-dark text-[11px] font-medium hover:bg-cream-2 transition-colors"
        >
          Ver fila →
        </Link>
      </div>
    </li>
  )
}

function TypePill({ href, label, count, active }: { href: string; label: string; count?: number; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors shrink-0',
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      <span>{label}</span>
      {count != null && (
        <span className={`inline-flex items-center justify-center text-[9px] font-medium tabular-nums px-1 rounded ${active ? 'bg-paper/15 text-paper' : 'bg-line/60 text-slate-dark'}`}>
          {count}
        </span>
      )}
    </Link>
  )
}

function periodLabel(p: string): string {
  if (!p || p.length < 7) return p
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const [y, m] = p.split('-')
  return `${months[+m - 1]} ${y}`
}

// ────────────────────────────────────────────────────────────────────────────
// WhatsApp helpers — uses wa.me deep link (no Business API needed). The
// encargada confirms the send inside WhatsApp itself, respecting the saved
// communication-model rule (drafting automated, sending decision = hers).
// ────────────────────────────────────────────────────────────────────────────

function buildWhatsappHref(phone: string, body: string): string {
  // Strip everything except digits and the leading +.
  const cleaned = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(body)}`
}

function buildCobranzaTemplate(item: PendienteItem): string {
  const lines = [
    `Hola ${item.tenantName}, te escribo de la administración.`,
    '',
    `Te quería recordar que ${item.detail.toLowerCase()}.`,
    '',
    `Cualquier consulta quedamos a disposición.`,
    `Saludos.`,
  ]
  return lines.join('\n')
}
