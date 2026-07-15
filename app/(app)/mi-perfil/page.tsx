import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MiPerfilClient } from '@/components/usuarios/MiPerfilClient'

export const dynamic = 'force-dynamic'

export default async function MiPerfilPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  return (
    <MiPerfilClient
      id={me.id}
      email={me.email}
      role={me.role}
      fullName={me.fullName}
      phone={me.phone}
      dni={me.dni}
      photoUrl={me.photoUrl}
    />
  )
}
