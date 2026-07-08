import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(request: NextRequest) {
  // Dev mode without Supabase configured: skip auth so the UI is browsable.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
    // Run on every request except static assets and Next.js internals.
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
