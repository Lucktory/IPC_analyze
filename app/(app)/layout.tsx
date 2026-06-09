import { AppShell } from '@/components/shell/AppShell'
import { createSupabaseServer } from '@/lib/supabase/server'

// ISR for every page under the (app) group. 60s window between Supabase
// fetches; mutation server actions still call revalidatePath for instant
// invalidation. Per-page values override this if needed.
export const revalidate = 60

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <AppShell userEmail={user?.email ?? null}>
      {children}
    </AppShell>
  )
}
