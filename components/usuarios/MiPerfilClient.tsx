'use client'

// ============================================================================
// MiPerfilClient — the /mi-perfil page. Now just page chrome around the shared
// ProfileForm (the same form the topbar "Mi perfil" modal uses).
// ============================================================================

import { ProfileForm } from './ProfileForm'
import { type UsuarioRole } from '@/lib/usuarios/types'

interface Props {
  id: string; email: string | null; role: UsuarioRole
  fullName: string | null; phone: string | null; dni: string | null; photoUrl: string | null
}

export function MiPerfilClient(props: Props) {
  return (
    <div className="max-w-[640px] space-y-5">
      <div>
        <h1 className="font-display text-[22px] font-semibold text-ink">Mi perfil</h1>
        <p className="text-[13px] text-slate mt-0.5">Tus datos personales y tu contrasena.</p>
      </div>
      <div className="bg-paper border border-line rounded-xl shadow-card p-6">
        <ProfileForm {...props} />
      </div>
    </div>
  )
}
