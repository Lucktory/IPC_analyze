import { Suspense } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { NavProgressProvider } from '@/components/shell/NavProgress'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getPendingCount } from '@/lib/pending/digest'

// Always-fresh: the bell badge in the topbar pulls from getPendingCount(),
// and a stale 60-second cache made the bell show an outdated number even
// after the underlying data changed. Switched from ISR (revalidate=60)
// to force-dynamic so the count is recomputed on every navigation. The
// digest itself is fast (single SQL query + in-memory aggregation).
export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, pendingCount] = await Promise.all([
    getCurrentUser(),
    getPendingCount(),
  ])
  return (
    // NavProgressProvider reads the search params, so it sits behind Suspense.
    <Suspense fallback={null}>
      <NavProgressProvider>
        <AppShell
          userEmail={me?.email ?? null}
          userName={me?.fullName ?? null}
          userPhotoUrl={me?.photoUrl ?? null}
          userId={me?.id ?? null}
          userRole={me?.role ?? 'user'}
          userPhone={me?.phone ?? null}
          userDni={me?.dni ?? null}
          isSuperAdmin={me?.role === 'super_admin'}
          pendingCount={pendingCount}
        >
          {children}
        </AppShell>
      </NavProgressProvider>
    </Suspense>
  )
}
