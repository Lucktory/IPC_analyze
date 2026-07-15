// ============================================================================
// Shared usuarios types. No 'use server' here so both server actions and
// client components can import these (a 'use server' module may only export
// async functions).
// ============================================================================

export type UsuarioRole = 'super_admin' | 'user'

export interface UsuarioRow {
  id:        string
  email:     string
  fullName:  string | null
  phone:     string | null
  dni:       string | null
  photoUrl:  string | null
  role:      UsuarioRole
  active:    boolean
  createdAt: string | null
}

export const ROLE_LABEL: Record<UsuarioRole, string> = {
  super_admin: 'Administrador',
  user:        'Usuario',
}
