// ============================================================================
// instrumentation.ts — Next.js runtime hook for capturing server errors.
//
// In production, Next.js wraps errors thrown during Server Component render
// and strips the message before exposing them to error.tsx. This is the
// "Application error … Digest: 1866531952" page Alejandro keeps hitting
// on /liquidacion — useful for security, useless for debugging.
//
// The `onRequestError` hook fires INSIDE the runtime, before stripping, with
// the full Error object intact. We push a verbose console.error so the
// message + stack land in Vercel's runtime logs (Dashboard → Logs → Runtime
// Logs). The log line is prefixed with the digest so we can match it to
// whatever the user sees in the browser.
//
// Wrapped in try/catch so a logging failure can never escalate into a
// second error and confuse the user further.
// ============================================================================

export async function register() {
  // No-op for now — placeholder so Next.js loads this file's onRequestError.
}

export async function onRequestError(
  error: { digest?: string } & Error,
  request: {
    path:    string
    method:  string
    headers: Record<string, string | string[]>
  },
  context: {
    routerKind:        'Pages Router' | 'App Router'
    routePath:         string
    routeType:         'render' | 'route' | 'action' | 'middleware'
    renderSource?:     'react-server-components' | 'react-server-components-payload' | 'server-rendering'
    revalidateReason?: 'on-demand' | 'stale' | undefined
    renderType:        'dynamic' | 'dynamic-resume'
  },
) {
  try {
    // Use a distinctive prefix so Vercel log search can find these instantly.
    // The digest is the bridge between Alejandro's screenshot and our log.
    const digest = (error as any)?.digest ?? '(no digest)'
    const message = error?.message ?? String(error)
    const stack   = error?.stack ?? '(no stack)'

    console.error(
      `\n[LIQUIDACION_ERROR] digest=${digest} path=${request.path} routeType=${context.routeType} renderSource=${context.renderSource ?? 'n/a'}\n` +
      `[LIQUIDACION_ERROR] message: ${message}\n` +
      `[LIQUIDACION_ERROR] stack:\n${stack}\n`,
    )
  } catch {
    // best-effort; never throw from the error hook
  }
}
