import { AppShell } from '@/components/shell/AppShell'
import { createSupabaseServer } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <AppShell userEmail={user?.email ?? null}>
      {children}
    </AppShell>
  )
}
