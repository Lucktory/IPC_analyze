'use client'

// ============================================================================
// UsuariosClient — super-admin user management (list + create / edit / delete
// + photo). Visual design modeled on the approved dark-SaaS mockup, built with
// the app's theme tokens so it adapts to light/dark. All mutations go through
// the role-gated server actions.
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
  email: string; password: string; fullName: string
  phone: string; dni: string; role: UsuarioRole; active: boolean
}

const emptyForm = (): FormState => ({
  email: '', password: '', fullName: '', phone: '', dni: '', role: 'user', active: true,
})

const PAGE_SIZE = 8
const INPUT = 'w-full h-10 px-3 rounded-lg border border-line bg-cream/60 text-[13.5px] text-ink placeholder:text-slate outline-none focus:border-info focus:bg-paper transition-colors'

export function UsuariosClient({ initialUsuarios, currentUserId }: Props) {
  const [mode, setMode]    = useState<'create' | 'edit' | null>(null)
  const [editingId, setId] = useState<string | null>(null)
  const [form, setForm]    = useState<FormState>(emptyForm())
  const [error, setError]  = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [pending, startTx] = useTransition()
  // Photo modal state.
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhoto, setExisting]    = useState<string | null>(null)
  const [removePhoto, setRemovePhoto]   = useState(false)
  // List state.
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [page, setPage] = useState(1)
  const router = useRouter()

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))
  const shownPhoto = photoPreview ?? (removePhoto ? null : existingPhoto)

  const filtered = query.trim()
    ? initialUsuarios.filter(u =>
        (u.fullName ?? '').toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase()))
    : initialUsuarios
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cur = Math.min(page, totalPages)
  const start = (cur - 1) * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)
  const from = filtered.length ? start + 1 : 0
  const to = Math.min(start + PAGE_SIZE, filtered.length)

  function resetPhoto(existing: string | null) {
    setPhotoFile(null); setPhotoPreview(null); setExisting(existing); setRemovePhoto(false)
  }
  function openCreate() {
    setError(null); setShowPass(false); setId(null); setForm(emptyForm()); resetPhoto(null); setMode('create')
  }
  function openEdit(u: UsuarioRow) {
    setError(null); setShowPass(false); setId(u.id); setMode('edit'); resetPhoto(u.photoUrl)
    setForm({ email: u.email, password: '', fullName: u.fullName ?? '', phone: u.phone ?? '', dni: u.dni ?? '', role: u.role, active: u.active })
  }
  function close() { if (!pending) setMode(null) }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('El archivo debe ser una imagen.'); return }
    try {
      const small = await resizeImageToFile(f)
      setPhotoFile(small); setPhotoPreview(URL.createObjectURL(small)); setRemovePhoto(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.') }
  }
  function clearPhoto() { setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true) }

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
      setMode(null); router.refresh()
    })
  }

  function del(u: UsuarioRow) {
    if (!window.confirm(`Eliminar al usuario ${u.email}? Esta accion no se puede deshacer.`)) return
    startTx(async () => {
      const res = await deleteUsuario(u.id)
      if (!res.ok) { window.alert(res.error ?? 'No se pudo eliminar.'); return }
      router.refresh()
    })
  }

  return (
    <div className="bg-paper border border-line rounded-xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap border-b border-line">
        <div>
          <h1 className="font-display text-[19px] font-semibold text-ink">
            Usuarios <span className="text-slate font-normal">({filtered.length})</span>
          </h1>
          <p className="text-[13px] text-slate mt-0.5">Administra los usuarios del sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowSearch(s => !s)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-line text-slate-dark text-[13px] font-medium hover:bg-cream-2 transition-colors">
            <IconFilter /> Filtros
          </button>
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-info text-white text-[13px] font-medium hover:opacity-90 transition-opacity shadow-sm">
            <IconPlus /> Nuevo usuario
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="px-6 py-3 border-b border-line">
          <input autoFocus value={query} onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre o email..." className={INPUT + ' max-w-[360px]'} />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px] border-collapse min-w-[760px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate">
              <th className="text-left font-medium px-6 py-3">Usuario</th>
              <th className="text-left font-medium px-6 py-3">Email</th>
              <th className="text-left font-medium px-6 py-3">Rol</th>
              <th className="text-left font-medium px-6 py-3">Estado</th>
              <th className="text-right font-medium px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate italic">Sin usuarios.</td></tr>
            )}
            {rows.map(u => (
              <tr key={u.id} className="border-t border-line hover:bg-cream-2/50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar url={u.photoUrl} name={u.fullName || u.email} size={38} />
                    <span className="font-medium text-ink">
                      {u.fullName || <span className="text-slate italic font-normal">Sin nombre</span>}
                      {u.id === currentUserId && <span className="ml-1.5 text-[10px] text-info align-middle">(vos)</span>}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-slate-dark">{u.email}</td>
                <td className="px-6 py-3"><RolePill role={u.role} /></td>
                <td className="px-6 py-3"><StatusBadge active={u.active} /></td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => openEdit(u)} title="Editar"
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line text-slate-dark hover:text-info hover:border-info/40 transition-colors">
                      <IconEdit />
                    </button>
                    <button type="button" onClick={() => del(u)} disabled={pending || u.id === currentUserId}
                      title={u.id === currentUserId ? 'No podes eliminar tu propia cuenta' : 'Eliminar'}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line text-danger hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <IconTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <div className="px-6 py-4 flex items-center justify-between gap-3 border-t border-line flex-wrap">
        <span className="text-[12.5px] text-slate">{from}-{to} de {filtered.length}</span>
        <div className="flex items-center gap-1.5">
          <PagerBtn disabled={cur <= 1} onClick={() => setPage(cur - 1)}><IconChevronLeft /></PagerBtn>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`min-w-8 h-8 px-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                p === cur ? 'bg-info text-white' : 'border border-line text-slate-dark hover:bg-cream-2'
              }`}>{p}</button>
          ))}
          <PagerBtn disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}><IconChevronRight /></PagerBtn>
        </div>
      </div>

      {/* Modal */}
      {mode && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
          <button type="button" aria-label="Cerrar" onClick={close} className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" />
          <div className="relative bg-paper border border-line rounded-xl shadow-xl w-full max-w-[600px] max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 flex items-center justify-between border-b border-line sticky top-0 bg-paper z-10">
              <h2 className="font-display text-[16px] font-semibold text-ink">
                {mode === 'create' ? 'Crear nuevo usuario' : 'Editar usuario'}
              </h2>
              <button type="button" onClick={close} className="text-slate hover:text-ink transition-colors p-1"><IconX /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Photo uploader */}
              <div className="flex flex-col items-center gap-2">
                <label className="relative cursor-pointer">
                  <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                  {shownPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shownPhoto} alt="" className="w-24 h-24 rounded-full object-cover border border-line" />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-line bg-cream-2/40 flex items-center justify-center">
                      <IconCamera className="w-7 h-7 text-info" />
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-info flex items-center justify-center border-[3px] border-paper">
                    <IconPlus className="w-3.5 h-3.5 text-white" />
                  </span>
                </label>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-ink">Subir foto</p>
                  <p className="text-[11px] text-slate">JPG, PNG o GIF.</p>
                  {shownPhoto && (
                    <button type="button" onClick={clearPhoto} className="text-[11px] text-danger hover:underline mt-0.5">Quitar foto</button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                <Field label="Nombre completo">
                  <input value={form.fullName} onChange={e => set('fullName', e.target.value)} className={INPUT} placeholder="Ej. Andres Martinez" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={INPUT} placeholder="ejemplo@empresa.com" />
                </Field>
                <Field label="Telefono">
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} className={INPUT} placeholder="Opcional" />
                </Field>
                <Field label="DNI">
                  <input value={form.dni} onChange={e => set('dni', e.target.value)} className={INPUT} placeholder="Opcional" />
                </Field>
                <Field label="Rol">
                  <select value={form.role} onChange={e => set('role', e.target.value as UsuarioRole)} className={INPUT}>
                    <option value="user">Usuario</option>
                    <option value="super_admin">Administrador</option>
                  </select>
                </Field>
                <Field label={mode === 'create' ? 'Contrasena' : 'Nueva contrasena (opcional)'}>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                      className={INPUT + ' pr-10'} placeholder={mode === 'create' ? 'Minimo 6 caracteres' : 'Dejar vacio'} />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink transition-colors">
                      {showPass ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </Field>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 pt-1">
                <Toggle on={form.active} onChange={v => set('active', v)} />
                <div>
                  <p className="text-[13px] font-medium text-ink">Usuario activo</p>
                  <p className="text-[11.5px] text-slate">El usuario podra acceder al sistema.</p>
                </div>
              </div>

              {error && <div className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>}
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-2.5 border-t border-line sticky bottom-0 bg-paper">
              <button type="button" onClick={close} disabled={pending}
                className="px-4 py-2.5 rounded-lg border border-line text-[13px] font-medium text-slate-dark hover:bg-cream-2 transition-colors">Cancelar</button>
              <button type="button" onClick={submit} disabled={pending}
                className="px-4 py-2.5 rounded-lg bg-info text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm">
                {pending ? 'Guardando...' : (mode === 'create' ? 'Crear usuario' : 'Guardar cambios')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── small pieces ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-slate-dark block mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function RolePill({ role }: { role: UsuarioRole }) {
  return role === 'super_admin'
    ? <span className="inline-block px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-info/15 text-info">{ROLE_LABEL.super_admin}</span>
    : <span className="inline-block px-2.5 py-1 rounded-full text-[11.5px] font-medium border border-line text-slate-dark">{ROLE_LABEL.user}</span>
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-success' : 'bg-slate'}`} />
      <span className={active ? 'text-success' : 'text-slate'}>{active ? 'Activo' : 'Inactivo'}</span>
    </span>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-info' : 'bg-slate/40'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${on ? 'translate-x-[19px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}

function PagerBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-line text-slate-dark hover:bg-cream-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      {children}
    </button>
  )
}

// ── icons ────────────────────────────────────────────────────────────────────
const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconPlus({ className = 'w-4 h-4' }: { className?: string }) { return <svg viewBox="0 0 20 20" {...sv} className={className}><path d="M10 4v12M4 10h12" /></svg> }
function IconFilter() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M3 5h14M6 10h8M8 15h4" /></svg> }
function IconEdit() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M13.5 4.5l2 2L7 15l-3 1 1-3 8.5-8.5z" /></svg> }
function IconTrash() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" /></svg> }
function IconCamera({ className = 'w-6 h-6' }: { className?: string }) { return <svg viewBox="0 0 24 24" {...sv} className={className}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg> }
function IconEye() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" /><circle cx="10" cy="10" r="2.2" /></svg> }
function IconEyeOff() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M3 3l14 14M8 8a2.5 2.5 0 003.5 3.5M6 6C3.5 7.5 2 10 2 10s3 5 8 5c1.4 0 2.7-.4 3.8-1M11 5.2C10.7 5.1 10.3 5 10 5c-.3 0-.7 0-1 .1" /></svg> }
function IconX() { return <svg viewBox="0 0 20 20" {...sv} className="w-5 h-5"><path d="M5 5l10 10M15 5L5 15" /></svg> }
function IconChevronLeft() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M12 5l-5 5 5 5" /></svg> }
function IconChevronRight() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M8 5l5 5-5 5" /></svg> }
