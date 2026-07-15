import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth/current-user'
import { listUsuarios } from '@/lib/usuarios/actions'
import { UsuariosClient } from '@/components/usuarios/UsuariosClient'

export const dynamic = 'force-dynamic'

// Super-admin only. Non-admins are bounced to their daily view.
export default async function UsuariosPage() {
  const admin = await requireSuperAdmin()
  if (!admin) redirect('/liquidacion')

  const res = await listUsuarios()

  return (
    <>
      {!res.ok && (
        <div className="mb-4 text-[12.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {res.error} {res.error?.includes('SERVICE_ROLE')
            ? '' : '(revisa que la migracion 04-usuarios.sql este aplicada).'}
        </div>
      )}
      <UsuariosClient initialUsuarios={res.usuarios ?? []} currentUserId={admin.id} />
    </>
  )
}
