import { createSupabaseServer } from '@/lib/supabase/server'
import type { UsuarioRole } from '@/lib/usuarios/types'

// ============================================================================
// Current-user + role helpers. SERVER ONLY (uses cookies via createSupabaseServer).
// Import from server components and server actions, never from client code.
//
// Role is read from the `usuarios` profile table. If that table doesn't exist
// yet (migration 04 not applied) or the row is missing, we default to 'user'
// so the app keeps working — the Usuarios admin surface simply stays hidden.
// ============================================================================

export interface CurrentUser {
  id:       string
  email:    string | null
  role:     UsuarioRole
  fullName: string | null
  phone:    string | null
  dni:      string | null
  photoUrl: string | null
  active:   boolean
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // RLS lets a user read their own row; a missing table/row falls back to 'user'.
  const { data: profile } = await supabase
    .from('usuarios')
    .select('email, full_name, phone, dni, photo_url, role, active')
    .eq('id', user.id)
    .maybeSingle()

  const p = profile as {
    email: string | null; full_name: string | null; phone: string | null
    dni: string | null; photo_url: string | null; role: string | null; active: boolean | null
  } | null

  return {
    id:       user.id,
    email:    user.email ?? p?.email ?? null,
    role:     (p?.role === 'super_admin' ? 'super_admin' : 'user'),
    fullName: p?.full_name ?? null,
    phone:    p?.phone ?? null,
    dni:      p?.dni ?? null,
    photoUrl: p?.photo_url ?? null,
    active:   p?.active ?? true,
  }
}

/** Returns the current user only when they are a super admin, else null. */
export async function requireSuperAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'super_admin') return null
  return user
}
