'use client'

// ============================================================================
// Error boundary for /liquidacion. Without this, any runtime error in the
// page or server component falls through to Next.js's default error page —
// which shows only the cryptic digest (e.g. "Digest: 1866531952") with no
// hint about what actually broke. That's how Alejandro saw the page right
// after the Phase 9 deploy: a wall of black text, no actionable info, and
// no recovery path other than reloading.
//
// This boundary catches anything that throws during render of the
// /liquidacion route segment and shows:
//   • The error message (so we can debug from the user's screenshot)
//   • The digest (so we can correlate with Vercel server logs)
//   • A "Reintentar" button that calls reset() — Next.js's official
//     way to re-run the server component without a full reload.
//   • A safe link back to /pendientes so the user is never stranded.
//
// Per the project's coding rule: every function wrapped in try/catch where
// failure is possible. Here the render itself is the boundary, so the
// try/catch wrapping happens inside the reset handler instead.
// ============================================================================

import Link from 'next/link'
import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LiquidacionError({ error, reset }: Props) {
  // Surface the error to the browser console too — useful when the user
  // has DevTools open. Wrapped in try/catch so a logging failure can never
  // mask the original error.
  useEffect(() => {
    try {
      console.error('[/liquidacion] render error:', error)
    } catch {
      // ignore — best-effort logging
    }
  }, [error])

  function handleReset() {
    try {
      reset()
    } catch (err) {
      // Fallback: if reset throws (Next.js bug, etc.), do a hard reload.
      try { window.location.reload() } catch { /* ignore */ }
    }
  }

  return (
    <section className="bg-paper border border-danger/30 rounded p-4 sm:p-6 max-w-2xl mx-auto mt-6">
      <div className="flex items-start gap-3">
        <span className="text-[24px] leading-none shrink-0" aria-hidden>⚠</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[15px] font-medium text-ink mb-1">
            No se pudo cargar la planilla
          </h1>
          <p className="text-[12.5px] text-slate-dark leading-snug mb-3">
            Ocurrió un error al armar la liquidación del período. Probá refrescar.
            Si el problema persiste, mostrale este mensaje al equipo técnico.
          </p>

          <pre className="bg-cream-2 border border-line/60 rounded px-3 py-2 text-[11px] text-ink whitespace-pre-wrap break-words mb-3 max-h-48 overflow-auto">
            {error.message || 'Error desconocido'}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-ink text-paper rounded text-[12px] font-medium hover:opacity-90 transition-opacity"
            >
              Reintentar
            </button>
            <Link
              href="/pendientes"
              className="px-3 py-1.5 border border-line rounded text-[12px] text-slate-dark font-medium hover:bg-cream-2 transition-colors"
            >
              Ir a Pendientes
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
