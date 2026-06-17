// ============================================================================
// EmptyGridDiagnostic — shown above the empty-state message on /liquidacion
// when the grid query returns 0 rows. Surfaces the actual DB counts so the
// encargada / dev can see WHY the table is empty without checking logs.
// ============================================================================

import type { GridDiagnostic } from '@/lib/liquidacion/queries'

interface Props {
  diagnostic: GridDiagnostic
}

export function EmptyGridDiagnostic({ diagnostic }: Props) {
  const d = diagnostic

  // Pick the most likely cause + a one-line tip so the user has a clear next
  // step instead of staring at zeros.
  let cause: string
  let tip:   string
  if (d.contractsTotal === 0) {
    cause = 'No hay contratos en la base de datos.'
    tip   = 'Tocá «+ Nuevo contrato» arriba para cargar el primero, o aplicá el seed desde Supabase si esperabas datos importados.'
  } else if (d.contractsActive === 0) {
    cause = `Hay ${d.contractsTotal} contratos pero ninguno está en estado «active».`
    tip   = 'Revisá la columna Estado en la lista de contratos — quizás están en borrador o rescindidos.'
  } else if (d.noLandlordJunction > 0 || d.noTenantJunction > 0) {
    cause = `Hay ${d.contractsActive} contratos activos pero ${d.noLandlordJunction} sin propietarios y ${d.noTenantJunction} sin inquilinos cargados.`
    tip   = 'Después del deploy esos contratos van a aparecer con tinte amarillo — abrí la celda Propietario/Inquilino y cargá los datos.'
  } else if (d.rowBuildError) {
    cause = `Hay ${d.contractsActive} contratos activos con junctions completas pero el armado de filas tiró un error.`
    tip   = `Causa: ${d.rowBuildError}${d.rowBuildErrorContract ? ` (contrato ${d.rowBuildErrorContract})` : ''}`
  } else if (d.gridSelectError) {
    cause = `La consulta principal del planilla (SELECT con joins) tiró un error de Supabase.`
    tip   = `Error: ${d.gridSelectError}`
  } else if (d.gridSelectRowCount === 0 && d.contractsActive > 0) {
    cause = `Hay ${d.contractsActive} contratos activos pero la consulta con joins devuelve 0 filas.`
    tip   = 'Las tablas contract_tenants o contract_landlords probablemente tienen RLS bloqueando lectura, o la PostgREST relationship está rota.'
  } else if (d.gridSelectRowCount != null && d.gridSelectRowCount > 0) {
    cause = `La consulta SELECT devuelve ${d.gridSelectRowCount} filas pero el armado falla silenciosamente.`
    tip   = 'Mirá el "primer contrato muestra" abajo y compará con LiquidacionGridRow para encontrar el campo faltante.'
  } else {
    cause = `Hay ${d.contractsActive} contratos activos con junctions completas pero la consulta del período no devolvió filas.`
    tip   = 'Posible problema de conexión a la base — revisá los logs de Vercel buscando «GRID_DIAGNOSTIC».'
  }

  const statusEntries = Object.entries(d.contractsByStatus).sort((a, b) => b[1] - a[1])

  return (
    <section className="bg-paper border border-warn/40 rounded shadow-card p-5 mb-3">
      <div className="flex items-start gap-3">
        <span className="text-[20px] leading-none mt-0.5" aria-hidden>ⓘ</span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-[14px] text-ink font-medium mb-1">Diagnóstico</p>
          <p className="text-[13px] text-slate-dark leading-snug mb-3">
            {cause}
          </p>
          <p className="text-[12px] text-slate mb-3 italic">{tip}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <Stat label="Contratos totales"      value={d.contractsTotal} />
            <Stat label="Activos"                value={d.contractsActive} tone={d.contractsActive > 0 ? 'success' : 'warn'} />
            <Stat label="Sin propietarios"       value={d.noLandlordJunction} tone={d.noLandlordJunction > 0 ? 'warn' : 'success'} />
            <Stat label="Sin inquilinos"         value={d.noTenantJunction}   tone={d.noTenantJunction   > 0 ? 'warn' : 'success'} />
          </div>

          {statusEntries.length > 0 && (
            <div className="mt-3">
              <p className="label-cap text-slate mb-1">Por estado</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-slate-dark">
                {statusEntries.map(([st, n]) => (
                  <span key={st} className="tabular-nums">
                    <span className="text-slate">{st}:</span> <strong className="text-ink">{n}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {d.lastFiveCreated.length > 0 && (
            <div className="mt-3">
              <p className="label-cap text-slate mb-1">Últimos 5 creados</p>
              <ul className="text-[11px] text-slate-dark space-y-0.5 font-mono">
                {d.lastFiveCreated.map(c => (
                  <li key={c.id} className="tabular-nums">
                    <span className="text-slate">{c.created_at.slice(0, 19).replace('T', ' ')}</span>
                    {' · '}
                    <span className="text-ink">{c.status}</span>
                    {' · '}
                    <span className="text-slate truncate">{c.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grid-select probe sample — what Supabase ACTUALLY returns to
              the grid query, so we can see if the join is alive or broken. */}
          {(d.gridSelectRowCount != null || d.gridSelectError) && (
            <div className="mt-3 pt-3 border-t border-line/40">
              <p className="label-cap text-slate mb-1">SELECT con joins (consulta real del planilla)</p>
              <p className="text-[11.5px] text-slate-dark">
                Devolvió: <strong>{d.gridSelectRowCount ?? '(error)'}</strong> filas
                {d.gridSelectError && (
                  <> · <span className="text-danger">error: {d.gridSelectError}</span></>
                )}
              </p>
              {d.gridSelectFirstSample && (
                <pre className="mt-2 p-2 bg-cream-2/60 rounded text-[11px] text-slate-dark overflow-auto max-h-72 leading-snug">
                  {JSON.stringify(d.gridSelectFirstSample, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warn' }) {
  const valueClass =
    tone === 'success' ? 'text-success' :
    tone === 'warn'    ? 'text-warn'    :
                         'text-ink'
  return (
    <div className="bg-cream-2/60 rounded p-2">
      <p className="label-cap text-slate">{label}</p>
      <p className={`text-[18px] font-display font-medium tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}
