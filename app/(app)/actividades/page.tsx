import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth/current-user'
import { listAuditLog, getAuditActors, getAuditAnalytics } from '@/lib/audit/queries'
import { ActividadesClient } from '@/components/actividades/ActividadesClient'
import type { AuditActionGroup } from '@/lib/audit/types'

export const dynamic = 'force-dynamic'

const GROUPS: AuditActionGroup[] = ['created', 'updated', 'deleted', 'session', 'user']

interface PageProps {
  searchParams: Promise<{ actor?: string; from?: string; to?: string; group?: string; q?: string; page?: string; perPage?: string; view?: string }>
}

// Super-admin only.
export default async function ActividadesPage({ searchParams }: PageProps) {
  const admin = await requireSuperAdmin()
  if (!admin) redirect('/liquidacion')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const perPage = Number(sp.perPage) === 100 ? 100 : 50
  const group = GROUPS.includes(sp.group as AuditActionGroup) ? (sp.group as AuditActionGroup) : null

  // Activity can never be in the future: cap the date filters at today (AR time).
  // Computed server-side so the value is stable (no hydration mismatch) and any
  // future date already sitting in the URL gets clamped.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  const from = sp.from && sp.from > today ? today : (sp.from ?? '')
  const to   = sp.to   && sp.to   > today ? today : (sp.to   ?? '')

  const view = sp.view === 'panel' ? 'panel' : 'lista'
  const commonFilters = {
    actorId: sp.actor || null,
    from:    from ? `${from}T00:00:00` : null,
    to:      to   ? `${to}T23:59:59`   : null,
    group,
    query:   sp.q || null,
  }

  const [res, actors, an] = await Promise.all([
    view === 'lista' ? listAuditLog({ ...commonFilters, page, pageSize: perPage }) : Promise.resolve(null),
    getAuditActors(),
    view === 'panel' ? getAuditAnalytics(commonFilters) : Promise.resolve(null),
  ])

  const err = (res && !res.ok && res.error) || (an && !an.ok && an.error) || null

  return (
    <>
      {err && (
        <div className="mb-4 text-[12.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {err} {err.includes('SERVICE_ROLE') ? '' : '(revisa que la migracion 05-audit-log.sql este aplicada).'}
        </div>
      )}
      <ActividadesClient
        view={view}
        analytics={an?.analytics ?? null}
        entries={res?.entries ?? []}
        refs={res?.refs ?? {}}
        total={res?.total ?? 0}
        pageSize={res?.pageSize ?? 50}
        page={page}
        actors={actors}
        today={today}
        filters={{ actor: sp.actor ?? '', from, to, group: sp.group ?? '', q: sp.q ?? '' }}
      />
    </>
  )
}
