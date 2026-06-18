// ============================================================================
// /pendientes — focused cashflow inbox (2026-06-18 redesign).
//
// Three categories, in priority order:
//   1. Pendiente transferencia — overdue cobro OR cobrado-but-not-transferido
//   2. Liquidación sin cerrar  — transferido but status != 'paid'
//   3. Cobranza próxima         — vence en ≤7 días, no cobro aún
//
// Each row links directly to /contratos/[id] (the action surface for
// everything: edit, register cobro, register transfer, mark paid). WhatsApp
// + Email icons sit on the right, pre-filling messages targeted at whoever
// the encargada needs to contact for that specific item (tenant vs landlord).
// ============================================================================

import Link from 'next/link'
import {
  getPendientesDigest,
  type PendienteItem,
  type PendienteCategory,
  type TransferenciaSubcase,
} from '@/lib/pending/digest'
import { fmtMoney } from '@/lib/format'
import { getCurrentPeriodLabel } from '@/lib/period'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { KPICard } from '@/components/ui/KPICard'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface PageProps {
  searchParams: Promise<{ categoria?: string }>
}

const CATEGORY_ORDER: PendienteCategory[] = [
  'pendiente_transferencia',
  'liquidacion_abierta',
  'cobranza_proxima',
]

const CATEGORY_META: Record<PendienteCategory, {
  label:    string
  sublabel: string
  dot:      string
  banner:   string
}> = {
  pendiente_transferencia: {
    label:    'Transferencia pendiente',
    sublabel: 'Falta cobro del inquilino o transferencia al propietario',
    dot:      'bg-danger',
    banner:   'bg-danger/10 border-danger/30 text-ink',
  },
  liquidacion_abierta: {
    label:    'Liquidación sin cerrar',
    sublabel: 'Transferencia hecha pero no marcada como pagada',
    dot:      'bg-warn',
    banner:   'bg-warn/10 border-warn/30 text-ink',
  },
  cobranza_proxima: {
    label:    'Cobranza próxima',
    sublabel: 'Alquiler vence en ≤7 días',
    dot:      'bg-info/60',
    banner:   'bg-info/10 border-info/30 text-ink',
  },
}

function isCategory(s: string | undefined): s is PendienteCategory {
  return s === 'pendiente_transferencia' || s === 'liquidacion_abierta' || s === 'cobranza_proxima'
}

export default async function PendientesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filter: PendienteCategory | null = isCategory(sp.categoria) ? sp.categoria : null

  let items: PendienteItem[] = []
  let counts = {
    pendiente_transferencia: 0,
    liquidacion_abierta:     0,
    cobranza_proxima:        0,
    total:                   0,
  }
  let runtimeError: string | null = null
  try {
    const digest = await getPendientesDigest()
    items  = digest.items
    counts = digest.counts
  } catch (err) {
    console.error('[/pendientes] getPendientesDigest threw:', err)
    runtimeError = err instanceof Error ? err.message : String(err)
  }

  const periodLabel = getCurrentPeriodLabel()
  const filtered    = filter ? items.filter(i => i.category === filter) : items

  // Group filtered items by category for the sections.
  const grouped: Record<PendienteCategory, PendienteItem[]> = {
    pendiente_transferencia: [],
    liquidacion_abierta:     [],
    cobranza_proxima:        [],
  }
  for (const item of filtered) grouped[item.category].push(item)

  function hrefForCategory(cat: PendienteCategory | null): string {
    if (!cat) return '/pendientes'
    return `/pendientes?categoria=${cat}`
  }

  const summaryBits: string[] = []
  if (filter) summaryBits.push(CATEGORY_META[filter].label)

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Pendientes</strong>
            {' · '}
            {filtered.length === counts.total
              ? `${counts.total} ${counts.total === 1 ? 'acción' : 'acciones'} · ${periodLabel}`
              : `${filtered.length} de ${counts.total} · ${periodLabel}`}
            {summaryBits.length > 0 && (
              <span className="text-slate"> · {summaryBits.join(' · ')}</span>
            )}
          </p>
        </div>

        <StickyKPIStrip cols={3}>
          <StickyKPIStripItem>
            <KPICard
              label="Transferencia pendiente"
              value={counts.pendiente_transferencia.toString()}
              delta="falta cobro o pago al propietario"
              deltaTone={counts.pendiente_transferencia > 0 ? 'negative' : 'neutral'}
              href={hrefForCategory('pendiente_transferencia')}
              clearHref={hrefForCategory(null)}
              active={filter === 'pendiente_transferencia'}
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Liquidación sin cerrar"
              value={counts.liquidacion_abierta.toString()}
              delta="transferida sin marcar pagada"
              deltaTone={counts.liquidacion_abierta > 0 ? 'negative' : 'neutral'}
              href={hrefForCategory('liquidacion_abierta')}
              clearHref={hrefForCategory(null)}
              active={filter === 'liquidacion_abierta'}
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Cobranza próxima"
              value={counts.cobranza_proxima.toString()}
              delta="vence en ≤7 días"
              deltaTone="neutral"
              href={hrefForCategory('cobranza_proxima')}
              clearHref={hrefForCategory(null)}
              active={filter === 'cobranza_proxima'}
            />
          </StickyKPIStripItem>
        </StickyKPIStrip>
      </StickyHeader>

      <div className="mt-4 space-y-4 pb-8">
        {runtimeError && (
          <div className="bg-danger/10 border border-danger/40 rounded p-3 text-[12px] text-ink">
            <p className="font-medium text-danger">⚠ No se pudo calcular el listado de pendientes.</p>
            <p className="text-slate-dark mt-1">{runtimeError}</p>
          </div>
        )}

        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat]
          if (list.length === 0) return null
          const meta = CATEGORY_META[cat]
          return (
            <section key={cat} className="bg-paper border border-line rounded shadow-card overflow-hidden">
              <div className={`px-4 py-2.5 border-b border-line flex items-center justify-between ${meta.banner}`}>
                <div>
                  <h2 className="font-display text-[14px] font-medium flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} aria-hidden />
                    {meta.label}
                  </h2>
                  <p className="text-[11px] text-slate mt-0.5">{meta.sublabel}</p>
                </div>
                <span className="text-[11px] text-slate-dark tabular-nums">
                  {list.length} {list.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              <ul>
                {list.map(item => <PendienteRow key={item.id} item={item} />)}
              </ul>
            </section>
          )
        })}

        {filtered.length === 0 && !runtimeError && (
          <div className="bg-paper border border-line rounded shadow-card p-10 text-center">
            <p className="text-[14px] text-slate">
              {counts.total === 0
                ? 'Todo al día — sin pendientes.'
                : `Sin pendientes en "${filter ? CATEGORY_META[filter].label : ''}".`}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function PendienteRow({ item }: { item: PendienteItem }) {
  // Pick contact target by category + sub-case:
  //   · cobranza_proxima           → tenant (gentle reminder)
  //   · pendiente_transferencia/A  → tenant (chase the cobro)
  //   · pendiente_transferencia/B  → landlord (announce upcoming transfer)
  //   · liquidacion_abierta        → landlord (confirm receipt)
  const target = pickContactTarget(item)
  const tmpl   = buildTemplate(item)

  const whatsappHref = target.phone
    ? `https://wa.me/${cleanPhone(target.phone)}?text=${encodeURIComponent(tmpl.body)}`
    : null
  // Gmail compose URL — works in any browser without an OS-level mail client
  // configured. Mirrors the handoff used by LiquidarYEnviarButton on
  // /liquidacion. mailto: would silently no-op on Windows when no default
  // mail program is set, which is exactly the bug this replaces.
  const mailHref = target.email
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(target.email)}&su=${encodeURIComponent(tmpl.subject)}&body=${encodeURIComponent(tmpl.body)}`
    : null

  const verContratoHref = `/contratos/${item.contractId}`

  // Sub-case badge for category 2 ("Falta cobro" vs "Falta transferencia")
  // so a quick scan tells the encargada which lane the row is in.
  const subcaseBadge = item.subcase === 'falta_cobro'
    ? { label: 'Falta cobro',         class: 'bg-danger/10 text-danger border-danger/30' }
    : item.subcase === 'falta_transferencia'
      ? { label: 'Falta transferencia', class: 'bg-warn/15 text-ink border-warn/40' }
      : null

  return (
    <li className="px-4 py-2.5 border-b border-line/40 last:border-b-0 flex items-center gap-3 hover:bg-cream-2/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-ink leading-snug flex items-center gap-2 flex-wrap">
          <strong className="font-medium">{item.tenantName}</strong>
          <span className="text-slate">· prop.</span>
          <span className="text-slate-dark">{item.landlordName}</span>
          {subcaseBadge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${subcaseBadge.class}`}>
              {subcaseBadge.label}
            </span>
          )}
        </p>
        <p className="text-[11.5px] text-slate-dark mt-0.5 leading-snug">{item.detail}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {item.amount != null && item.amount > 0 && (
          <span className="text-[12px] tabular-nums text-slate-dark mr-1">{fmtMoney(item.amount)}</span>
        )}

        {/* WhatsApp icon — muted when the relevant contact has no phone. */}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            title={`Mandar WhatsApp a ${target.label}`}
            style={{ backgroundColor: '#25D366' }}
            className="inline-flex items-center justify-center w-7 h-7 rounded text-white hover:opacity-90 transition-opacity"
          >
            <WhatsAppIcon size={14} title="" />
          </a>
        ) : (
          <span
            title={`Sin teléfono cargado para ${target.label}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            <WhatsAppIcon size={14} title="" />
          </span>
        )}

        {/* Email icon — opens Gmail compose in a new tab with the draft
            pre-filled. Same Gmail handoff as /liquidacion so behaviour
            is identical across pages. */}
        {mailHref ? (
          <a
            href={mailHref}
            target="_blank"
            rel="noopener noreferrer"
            title={`Mandar email a ${target.label} (abre Gmail en una pestaña nueva)`}
            className="inline-flex items-center justify-center w-7 h-7 rounded bg-ink text-paper text-[13px] hover:opacity-90 transition-opacity"
          >
            ✉
          </a>
        ) : (
          <span
            title={`Sin email cargado para ${target.label}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded bg-gray-100 text-gray-400 text-[13px] cursor-not-allowed"
          >
            ✉
          </span>
        )}

        <Link
          href={verContratoHref}
          title="Abrir la página del contrato"
          className="px-2 py-1 rounded border border-line text-slate-dark text-[11px] font-medium hover:bg-cream-2 transition-colors"
        >
          Ver contrato →
        </Link>
      </div>
    </li>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Contact targeting + message templates.
//
// Each category points at the right person to contact and produces a Spanish
// draft. WhatsApp and email reuse the same body; subject is email-only.
// Per the saved communication-model rule: drafting + recommendation are
// automated, the encargada decides the send inside her own mail/WhatsApp UI.
// ────────────────────────────────────────────────────────────────────────────

interface ContactTarget {
  /** Who we're addressing — used in the icon tooltips. */
  label: string
  /** Who the message is FROM the perspective of — drives the greeting. */
  name:  string
  phone: string | null
  email: string | null
}

function pickContactTarget(item: PendienteItem): ContactTarget {
  // Category 2b + Category 3 → contact the landlord.
  if (
    (item.category === 'pendiente_transferencia' && item.subcase === 'falta_transferencia') ||
    item.category === 'liquidacion_abierta'
  ) {
    return {
      label: 'el propietario',
      name:  item.landlordName,
      phone: null,                 // landlord phones aren't surfaced today
      email: item.landlordEmail,
    }
  }
  // Default (cat 1 and cat 2a) → contact the tenant.
  return {
    label: 'el inquilino',
    name:  item.tenantName,
    phone: item.tenantPhone,
    email: item.tenantEmail,
  }
}

interface MessageTemplate { subject: string; body: string }

function buildTemplate(item: PendienteItem): MessageTemplate {
  switch (item.category) {
    case 'cobranza_proxima': {
      const subject = 'Recordatorio de alquiler — Patagonia Propiedades'
      const body = [
        `Hola ${item.tenantName},`,
        '',
        `Te escribimos de Patagonia Propiedades. ${item.detail}`,
        '',
        `Si ya hiciste la transferencia, ignorá este mensaje. Cualquier consulta, quedamos a disposición.`,
        '',
        `Saludos.`,
      ].join('\n')
      return { subject, body }
    }
    case 'pendiente_transferencia':
      if (item.subcase === 'falta_cobro') {
        const subject = 'Alquiler vencido — Patagonia Propiedades'
        const body = [
          `Hola ${item.tenantName},`,
          '',
          `Te escribimos de Patagonia Propiedades. ${item.detail}`,
          '',
          `Te pedimos por favor regularizar el pago en cuanto puedas. Si ya hiciste la transferencia, pasanos el comprobante.`,
          '',
          `Saludos.`,
        ].join('\n')
        return { subject, body }
      }
      // falta_transferencia → addressing landlord
      {
        const subject = 'Cobro recibido — transferencia próxima'
        const body = [
          `Estimado/a ${item.landlordName},`,
          '',
          `Le informamos que ya recibimos el alquiler del período. ${item.detail}`,
          '',
          `En las próximas horas le acreditamos el saldo en su cuenta.`,
          '',
          `Saludos cordiales,`,
          `Patagonia Propiedades`,
        ].join('\n')
        return { subject, body }
      }
    case 'liquidacion_abierta': {
      const subject = 'Confirmación de liquidación'
      const body = [
        `Estimado/a ${item.landlordName},`,
        '',
        `Confirmamos que la transferencia por la liquidación del período fue realizada. ${item.detail}`,
        '',
        `Cualquier consulta, quedamos a disposición.`,
        '',
        `Saludos cordiales,`,
        `Patagonia Propiedades`,
      ].join('\n')
      return { subject, body }
    }
  }
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
}
