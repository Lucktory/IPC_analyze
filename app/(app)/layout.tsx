import { AppShell } from '@/components/shell/AppShell'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getPendingCount } from '@/lib/pending/queries'

// Always-fresh: the bell badge in the topbar pulls from getPendingCount(),
// and a stale 60-second cache made the bell show an outdated number even
// after the underlying data changed. Switched from ISR (revalidate=60)
// to force-dynamic so the count is recomputed on every navigation. The
// digest itself is fast (single SQL query + in-memory aggregation).
export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const [{ data: { user } }, pendingCount] = await Promise.all([
    supabase.auth.getUser(),
    getPendingCount(),
  ])
  return (
    <AppShell userEmail={user?.email ?? null} pendingCount={pendingCount}>
      {children}
    </AppShell>
  )
}
