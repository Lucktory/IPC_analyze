'use client'

// ============================================================================
// ActividadesClient — the audit-log viewer (Who / Fecha / Accion / Detalles /
// IP). Filters drive the URL (searchParams), the server re-queries. Rows expand
// to a before/after diff. Design modeled on the approved dark-SaaS mockup.
// ============================================================================

import { Fragment, useEffect, useState } from 'react'
import { useProgressRouter } from '@/components/shell/NavProgress'
import { Avatar } from '@/components/usuarios/Avatar'
import { actionMeta, entityLabel, summarize, diffRows, displayValue, type Tone } from '@/lib/audit/format'
import type { AuditEntry, AuditActor } from '@/lib/audit/types'

interface Props {
  entries:  AuditEntry[]
  refs:     Record<string, string>
  total:    number
  pageSize: number
  page:     number
  actors:   AuditActor[]
  /** Today (YYYY-MM-DD, AR time) — date filters can never go past it. */
  today:    string
  filters:  { actor: string; from: string; to: string; group: string; q: string }
}

const GROUP_OPTIONS = [
  { value: '',        label: 'Todos' },
  { value: 'created', label: 'Creaciones' },
  { value: 'updated', label: 'Ediciones' },
  { value: 'deleted', label: 'Eliminaciones' },
  { value: 'session', label: 'Sesiones' },
  { value: 'user',    label: 'Usuarios' },
]

const TONE_BADGE: Record<Tone, string> = {
  success: 'bg-success/15 text-success',
  info:    'bg-info/15 text-info',
  danger:  'bg-danger/15 text-danger',
  neutral: 'bg-cream-2 text-slate-dark',
}
const INPUT = 'h-10 px-3 rounded-lg border border-line bg-cream/60 text-[13px] text-ink outline-none focus:border-info transition-colors'

export function ActividadesClient({ entries, refs, total, pageSize, page, actors, today, filters }: Props) {
  // Shared navigator: drives the global loading line while the server fetches.
  const { navigate } = useProgressRouter()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [q, setQ] = useState(filters.q)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function go(overrides: Partial<{ actor: string; from: string; to: string; group: string; q: string; page: number }>) {
    const cur = { actor: filters.actor, from: filters.from, to: filters.to, group: filters.group, q, page: 1, ...overrides }
    const p = new URLSearchParams()
    if (cur.actor) p.set('actor', cur.actor)
    if (cur.from)  p.set('from', cur.from)
    if (cur.to)    p.set('to', cur.to)
    if (cur.group) p.set('group', cur.group)
    if (cur.q)     p.set('q', cur.q)
    if (cur.page > 1) p.set('page', String(cur.page))
    navigate(`/actividades?${p.toString()}`)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <div className="bg-paper border border-line rounded-xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-line">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center"><IconClock /></span>
          <div>
            <h1 className="font-display text-[19px] font-semibold text-ink">Actividades</h1>
            <p className="text-[13px] text-slate">Historial de acciones realizadas en el sistema.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-line flex flex-wrap items-end gap-3">
        <Labeled label="Usuario">
          <select value={filters.actor} onChange={e => go({ actor: e.target.value })} className={INPUT + ' min-w-[190px]'}>
            <option value="">Todos los usuarios</option>
            {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Labeled>
        <Labeled label="Desde">
          <input type="date" value={filters.from} max={filters.to || today}
            onChange={e => go({ from: e.target.value })} className={INPUT} />
        </Labeled>
        <Labeled label="Hasta">
          <input type="date" value={filters.to} min={filters.from || undefined} max={today}
            onChange={e => go({ to: e.target.value })} className={INPUT} />
        </Labeled>
        <Labeled label="Tipo de accion">
          <select value={filters.group} onChange={e => go({ group: e.target.value })} className={INPUT + ' min-w-[150px]'}>
            {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Labeled>
        <Labeled label="Buscar" grow>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate"><IconSearch /></span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') go({ q }) }}
              placeholder="Buscar por entidad, ID, descripcion..."
              className={INPUT + ' w-full pl-8'}
            />
          </div>
        </Labeled>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse min-w-[900px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate">
              <th className="text-left  font-medium px-6 py-3">Usuario</th>
              <th className="text-left  font-medium px-6 py-3">Fecha y hora</th>
              <th className="text-left  font-medium px-6 py-3">Accion</th>
              <th className="text-left  font-medium px-6 py-3">Entidad / Detalles</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate italic">Sin actividades para estos filtros.</td></tr>
            )}
            {entries.map(e => {
              const meta = actionMeta(e.action)
              const rows = diffRows(e)
              const chip = e.action === 'update' && rows.length > 0 ? rows[0] : null
              const isOpen = expanded === e.id
              const name = e.actorName || (e.actorEmail ? e.actorEmail.split('@')[0] : 'Sistema')
              return (
                <Fragment key={e.id}>
                  <tr className={`border-t border-line ${isOpen ? 'bg-cream-2/40' : 'hover:bg-cream-2/40'} transition-colors`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar url={e.actorPhotoUrl} name={name} size={36} />
                        <div className="min-w-0">
                          <div className="text-ink font-medium truncate">{name}</div>
                          <div className="text-slate text-[11.5px] truncate">{e.actorEmail ?? '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-ink">{fmtDateTime(e.occurredAt)}</div>
                      <div className="text-slate text-[11.5px]">{mounted ? relTime(e.occurredAt) : ''}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${TONE_BADGE[meta.tone]}`}>
                        <ActionIcon tone={meta.tone} /> {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate shrink-0"><IconDoc /></span>
                        <div className="min-w-0">
                          <div className="text-ink font-medium truncate">{entityLabel(e, refs)}</div>
                          <div className="text-slate text-[11.5px] truncate">{summarize(e)}</div>
                        </div>
                        {chip && (
                          <span className="ml-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cream-2 text-[11.5px] whitespace-nowrap">
                            <span className="text-slate-dark">{displayValue(chip.before, refs)}</span>
                            <span className="text-slate">→</span>
                            <span className="text-success font-medium">{displayValue(chip.after, refs)}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {rows.length > 0 && (
                        <button type="button" onClick={() => setExpanded(isOpen ? null : e.id)}
                          className="text-slate hover:text-ink transition-colors" title="Ver detalle">
                          <span className={`inline-block transition-transform ${isOpen ? 'rotate-180' : ''}`}><IconChevronDown /></span>
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && rows.length > 0 && (
                    <tr className="bg-cream-2/40 border-t border-line">
                      <td colSpan={5} className="px-6 pb-4 pt-1">
                        <div className="rounded-lg border border-line overflow-hidden">
                          <table className="w-full text-[12.5px]">
                            <thead className="bg-cream/50 text-[10.5px] uppercase tracking-wider text-slate">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium w-[26%]">Campo</th>
                                <th className="text-left px-3 py-2 font-medium">Antes</th>
                                <th className="px-3 py-2 w-10 text-center font-medium">→</th>
                                <th className="text-left px-3 py-2 font-medium">Despues</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => {
                                const beforeEmpty = r.before === null || r.before === undefined || r.before === ''
                                const afterEmpty = r.after === null || r.after === undefined || r.after === ''
                                return (
                                  <tr key={r.field} className="border-t border-line align-top">
                                    <td className="px-3 py-2 text-slate-dark">{r.label}</td>
                                    <td className="px-3 py-2">
                                      {beforeEmpty
                                        ? <span className="text-slate italic">Sin valor</span>
                                        : <span className="text-ink">{displayValue(r.before, refs)}</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center text-slate">→</td>
                                    <td className="px-3 py-2">
                                      {afterEmpty
                                        ? <span className="text-slate italic">Sin valor</span>
                                        : <span className="inline-block px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">{displayValue(r.after, refs)}</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-line flex-wrap">
        <span className="text-[12.5px] text-slate">Mostrando {from} a {to} de {total} actividades</span>
        <div className="flex items-center gap-1.5">
          <PagerBtn disabled={page <= 1} onClick={() => go({ page: page - 1 })}><IconChevronLeft /></PagerBtn>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? <span key={`e${i}`} className="px-1 text-slate">...</span>
            : <button key={p} type="button" onClick={() => go({ page: p as number })}
                className={`min-w-8 h-8 px-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                  p === page ? 'bg-info text-white' : 'border border-line text-slate-dark hover:bg-cream-2'}`}>{p}</button>
          )}
          <PagerBtn disabled={page >= totalPages} onClick={() => go({ page: page + 1 })}><IconChevronRight /></PagerBtn>
        </div>
      </div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function Labeled({ label, grow, children }: { label: string; grow?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${grow ? 'flex-1 min-w-[220px]' : ''}`}>
      <span className="text-[11px] text-slate-dark block mb-1">{label}</span>
      {children}
    </label>
  )
}

function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(iso))
  } catch { return iso }
}
function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'hace instantes'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'ayer' : `hace ${d} dias`
}
function pageNumbers(page: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | string)[] = [1]
  const lo = Math.max(2, page - 1), hi = Math.min(total - 1, page + 1)
  if (lo > 2) out.push('...')
  for (let p = lo; p <= hi; p++) out.push(p)
  if (hi < total - 1) out.push('...')
  out.push(total)
  return out
}

function PagerBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-line text-slate-dark hover:bg-cream-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      {children}
    </button>
  )
}

const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconClock() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 1.5" /></svg> }
function IconSearch() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4" /></svg> }
function IconDoc() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M5 3h7l3 3v11H5z" /><path d="M12 3v3h3" /></svg> }
function IconChevronDown() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M5 8l5 5 5-5" /></svg> }
function IconChevronLeft() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M12 5l-5 5 5 5" /></svg> }
function IconChevronRight() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M8 5l5 5-5 5" /></svg> }
function ActionIcon({ tone }: { tone: Tone }) {
  if (tone === 'success') return <svg viewBox="0 0 20 20" {...sv} className="w-3.5 h-3.5"><path d="M5 10l3 3 7-7" /></svg>
  if (tone === 'info')    return <svg viewBox="0 0 20 20" {...sv} className="w-3.5 h-3.5"><path d="M13 4l3 3-8.5 8.5L4 16l.5-3.5z" /></svg>
  if (tone === 'danger')  return <svg viewBox="0 0 20 20" {...sv} className="w-3.5 h-3.5"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" /></svg>
  return <svg viewBox="0 0 20 20" {...sv} className="w-3.5 h-3.5"><path d="M8 4H4v12h4M11 7l3 3-3 3M14 10H7" /></svg>
}
