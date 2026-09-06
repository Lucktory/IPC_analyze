import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // SECURITY (2026-09-05): this branch used to `return NextResponse.next()`
    // unconditionally, so a production deploy that was missing either env var
    // served the entire authenticated app to anonymous visitors — the auth gate
    // silently disabled by a configuration mistake, with no signal that it had
    // happened. In production we now fail CLOSED.
    //
    // A 503 rather than a redirect to /login: /login is itself matched by this
    // middleware, so redirecting there would loop, and the login page cannot
    // work without these vars anyway. Serving a plain error makes the
    // misconfiguration obvious instead of silently degrading to "no auth".
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'Configuracion incompleta: faltan las variables de entorno de Supabase.',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      )
    }
    // Local dev without Supabase configured: skip auth so the UI is browsable.
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLogin = request.nextUrl.pathname === '/login'

  // ── 1-hour hard session window ────────────────────────────────────────────
  // `session_active` is a non-secret marker cookie the login page sets with
  // max-age=3600. The browser drops it 1 hour after login, so an authenticated
  // request that no longer carries it means the hour has elapsed → clear the
  // Supabase auth cookies and force a fresh login (email + password). This is
  // independent of Supabase's own token lifetime / auto-refresh.
  if (user && !isLogin && !request.cookies.has('session_active')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-') && c.name.includes('auth-token')) {
        redirect.cookies.set(c.name, '', { maxAge: 0, path: '/' })
      }
    }
    return redirect
  }

  if (!user && !isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and the two real static
    // assets this app serves.
    //
    // SECURITY (2026-09-05): the previous pattern ended in `|.*\..*` — "exclude
    // any path containing a dot ANYWHERE". Every dynamic route here takes an
    // arbitrary string ([id] / [contractId]), so `/contratos/a.b` still matched
    // app/(app)/contratos/[id]/page.tsx while skipping this middleware, which is
    // the only authentication gate in the app. Because Next dispatches server
    // actions by the `Next-Action` header rather than per-route, that gave an
    // unauthenticated caller a path to every action bundled with the route.
    //
    // Exclusions are exact paths, NOT an extension allowlist: anchoring a list
    // like `\.(js|css|svg)$` would leave the same hole open to `/contratos/a.js`.
    // `_next/` covers both `_next/static` and `_next/image`.
    // `/watermark.svg` is referenced from app/globals.css (.bg-watermark) and
    // `/icon.svg` is the app icon; both must stay reachable while logged out.
    '/((?!_next/|favicon\\.ico$|icon\\.svg$|watermark\\.svg$).*)',
  ],
}
