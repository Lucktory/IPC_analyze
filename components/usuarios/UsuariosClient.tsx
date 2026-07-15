'use client'

// ============================================================================
// UsuariosClient — super-admin user management (list + create / edit / delete),
// including the employee photo. All mutations go through the role-gated server
// actions; this component only collects input and reflects the result.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUsuario, updateUsuario, deleteUsuario, setUsuarioPhoto, removeUsuarioPhoto,
} from '@/lib/usuarios/actions'
import { ROLE_LABEL, type UsuarioRow, type UsuarioRole } from '@/lib/usuarios/types'
import { Avatar } from './Avatar'
import { resizeImageToFile } from './resizeImage'

interface Props {
  initialUsuarios: UsuarioRow[]
  currentUserId:   string
}

interface FormState {
  email:    string
  password: string
  fullName: string
  phone:    string
  dni:      string
  role:     UsuarioRole
  active:   boolean
}

const emptyForm = (): FormState => ({
  email: '', password: '', fullName: '', phone: '', dni: '', role: 'user', active: true,
})

export function UsuariosClient({ initialUsuarios, currentUserId }: Props) {
  const [mode, setMode]    = useState<'create' | 'edit' | null>(null)
  const [editingId, setId] = useState<string | null>(null)
  const [form, setForm]    = useState<FormState>(emptyForm())
  const [error, setError]  = useState<string | null>(null)
  const [pending, startTx] = useTransition()
  // Photo modal state.
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhoto, setExisting]    = useState<string | null>(null)
  const [removePhoto, setRemovePhoto]   = useState(false)
  const router = useRouter()

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))
  const shownPhoto = photoPreview ?? (removePhoto ? null : existingPhoto)

  function resetPhoto(existing: string | null) {
    setPhotoFile(null); setPhotoPreview(null); setExisting(existing); setRemovePhoto(false)
  }
  function openCreate() {
    setError(null); setId(null); setForm(emptyForm()); resetPhoto(null); setMode('create')
  }
  function openEdit(u: UsuarioRow) {
    setError(null); setId(u.id); setMode('edit'); resetPhoto(u.photoUrl)
    setForm({
      email: u.email, password: '', fullName: u.fullName ?? '', phone: u.phone ?? '',
      dni: u.dni ?? '', role: u.role, active: u.active,
    })
  }
  function close() { if (!pending) setMode(null) }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return }
    try {
      const small = await resizeImageToFile(f)
      setPhotoFile(small); setPhotoPreview(URL.createObjectURL(small)); setRemovePhoto(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.')
    }
  }
  function clearPhoto() {
    setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true)
  }

  function submit() {
    setError(null)
    startTx(async () => {
      if (mode === 'create') {
        const res = await createUsuario({
          email: form.email, password: form.password, fullName: form.fullName,
          phone: form.phone, dni: form.dni, role: form.role,
        })
        if (!res.ok) { setError(res.error); return }
        if (res.id && photoFile) {
          const fd = new FormData(); fd.append('photo', photoFile)
          const pr = await setUsuarioPhoto(res.id, fd)
          if (!pr.ok) window.alert('Usuario creado, pero no se pudo subir la foto: ' + (pr.error ?? ''))
        }
      } else {
        const res = await updateUsuario(editingId!, {
          fullName: form.fullName, phone: form.phone, dni: form.dni,
          role: form.role, active: form.active, email: form.email,
          newPassword: form.password || undefined,
        })
        if (!res.ok) { setError(res.error); return }
        if (photoFile) {
          const fd = new FormData(); fd.append('photo', photoFile)
          const pr = await setUsuarioPhoto(editingId!, fd)
          if (!pr.ok) { setError(pr.error); return }
        } else if (removePhoto) {
          const pr = await removeUsuarioPhoto(editingId!)
          if (!pr.ok) { setError(pr.error); return }
        }
      }
      setMode(null)
      router.refresh()
    })
  }

  function del(u: UsuarioRow) {
    if (!window.confirm(`Eliminar al usuario ${u.email}? Esta accion no se puede deshacer.`)) return
    setError(null)
    startTx(async () => {
      const res = await deleteUsuario(u.id)
      if (!res.ok) { window.alert(res.error ?? 'No se pudo eliminar.'); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[22px] text-ink">Usuarios</h1>
          <p className="text-[13px] text-slate mt-0.5">Alta, baja y edicion de los usuarios del sistema.</p>
        </div>
        <button type="button" onClick={openCreate}
          className="px-3 py-2 rounded bg-ink text-paper text-[13px] font-medium hover:opacity-90 transition-opacity">
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-paper border border-line rounded overflow-x-auto">
        <table className="w-full text-[13px] border-collapse min-w-[760px]">
          <thead className="bg-cream-2 text-[10.5px] uppercase tracking-wider text-slate-dark">
            <tr className="border-b border-line">
              <th className="text-left px-3 py-2 font-medium w-[52px]">Foto</th>
              <th className="text-left px-3 py-2 font-medium">Nombre</th>
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Telefono</th>
              <th className="text-left px-3 py-2 font-medium">Rol</th>
              <th className="text-center px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {initialUsuarios.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate italic">Sin usuarios.</td></tr>
            )}
            {initialUsuarios.map(u => (
              <tr key={u.id} className="border-b border-line last:border-b-0 hover:bg-cream/40">
                <td className="px-3 py-2"><Avatar url={u.photoUrl} name={u.fullName || u.email} size={32} /></td>
                <td className="px-3 py-2 text-ink">
                  {u.fullName || <span className="text-slate italic">Sin nombre</span>}
                  {u.id === currentUserId && <span className="ml-1.5 text-[10px] text-info">(vos)</span>}
                </td>
                <td className="px-3 py-2 text-slate-dark">{u.email}</td>
                <td className="px-3 py-2 text-slate-dark">{u.phone || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                    u.role === 'super_admin' ? 'bg-info/15 text-info' : 'bg-cream-2 text-slate-dark'
                  }`}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {u.active
                    ? <span className="text-[11px] text-success font-medium">Activo</span>
                    : <span className="text-[11px] text-slate">Inactivo</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => openEdit(u)}
                    className="px-2 py-1 rounded border border-line text-[11.5px] text-slate-dark hover:bg-cream-2 transition-colors">
                    Editar
                  </button>
                  <button type="button" onClick={() => del(u)} disabled={pending || u.id === currentUserId}
                    title={u.id === currentUserId ? 'No podes eliminar tu propia cuenta' : 'Eliminar'}
                    className="ml-1.5 px-2 py-1 rounded border border-line text-[11.5px] text-danger hover:bg-danger/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
          <button type="button" aria-label="Cerrar" onClick={close} className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
          <div className="relative bg-paper border border-line rounded shadow-xl w-full max-w-[480px] max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-3 border-b border-line sticky top-0 bg-paper">
              <h2 className="font-display text-[15px] font-medium text-ink">
                {mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
              </h2>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Photo */}
              <div className="flex items-center gap-3">
                <Avatar url={shownPhoto} name={form.fullName || form.email} size={56} />
                <div className="flex flex-col gap-1.5">
                  <label className="px-2.5 py-1.5 rounded border border-line text-[12px] text-slate-dark hover:bg-cream-2 cursor-pointer transition-colors inline-block">
                    {shownPhoto ? 'Cambiar foto' : 'Subir foto'}
                    <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                  </label>
                  {shownPhoto && (
                    <button type="button" onClick={clearPhoto}
                      className="text-[11px] text-danger hover:underline text-left">Quitar foto</button>
                  )}
                </div>
              </div>

              <Field label="Nombre completo">
                <input type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)} className="ipt" placeholder="Nombre y apellido" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="ipt" placeholder="usuario@example.com" />
              </Field>
              <Field label={mode === 'create' ? 'Contrasena' : 'Nueva contrasena (opcional)'}>
                <input type="text" value={form.password} onChange={e => set('password', e.target.value)} className="ipt"
                  placeholder={mode === 'create' ? 'Minimo 6 caracteres' : 'Dejar vacio para no cambiar'} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefono"><input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} className="ipt" /></Field>
                <Field label="DNI"><input type="text" value={form.dni} onChange={e => set('dni', e.target.value)} className="ipt" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rol">
                  <select value={form.role} onChange={e => set('role', e.target.value as UsuarioRole)} className="ipt">
                    <option value="user">Usuario</option>
                    <option value="super_admin">Administrador</option>
                  </select>
                </Field>
                {mode === 'edit' && (
                  <Field label="Estado">
                    <select value={form.active ? '1' : '0'} onChange={e => set('active', e.target.value === '1')} className="ipt">
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </Field>
                )}
              </div>

              {error && <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>}
            </div>

            <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2 bg-cream-2 sticky bottom-0">
              <button type="button" onClick={close} disabled={pending}
                className="px-3 py-1.5 rounded border border-line text-[12px] text-slate-dark hover:bg-cream-2 transition-colors">Cancelar</button>
              <button type="button" onClick={submit} disabled={pending}
                className="px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity">
                {pending ? 'Guardando...' : (mode === 'create' ? 'Crear usuario' : 'Guardar cambios')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.ipt{width:100%;height:2.25rem;padding:0 .5rem;border:1px solid rgb(var(--color-line));border-radius:.25rem;background:rgb(var(--color-paper));font-size:13px;outline:none}.ipt:focus{border-color:rgb(var(--color-info))}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-slate-dark block mb-1">{label}</span>
      {children}
    </label>
  )
}
