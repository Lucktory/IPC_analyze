import { AppShell } from '@/components/shell/AppShell'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getPendingCount } from '@/lib/pending/queries'

// ISR for every page under the (app) group. 60s window between Supabase
// fetches; mutation server actions still call revalidatePath for instant
// invalidation. Per-page values override this if needed.
export const revalidate = 60

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
