'use client'

// ============================================================================
// MiPerfilClient — any logged-in user views / edits their OWN profile (name,
// phone, dni, photo) and changes their OWN password. Never touches role/active
// or other users.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateMyProfile, changeMyPassword, setUsuarioPhoto, removeUsuarioPhoto,
} from '@/lib/usuarios/actions'
import { ROLE_LABEL, type UsuarioRole } from '@/lib/usuarios/types'
import { Avatar } from './Avatar'

interface Props {
  id:       string
  email:    string | null
  role:     UsuarioRole
  fullName: string | null
  phone:    string | null
  dni:      string | null
  photoUrl: string | null
}

export function MiPerfilClient({ id, email, role, fullName, phone, dni, photoUrl }: Props) {
  const [name, setName] = useState(fullName ?? '')
  const [tel, setTel]   = useState(phone ?? '')
  const [doc, setDoc]   = useState(dni ?? '')
  const [pass, setPass] = useState('')
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto]   = useState(false)
  const [msg, setMsg]         = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [passMsg, setPassMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTx]    = useTransition()
  const router = useRouter()

  const shownPhoto = photoPreview ?? (removePhoto ? null : photoUrl)

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); setRemovePhoto(false)
  }
  function clearPhoto() { setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true) }

  function saveProfile() {
    setMsg(null)
    startTx(async () => {
      const res = await updateMyProfile({ fullName: name, phone: tel, dni: doc })
      if (!res.ok) { setMsg({ kind: 'err', text: res.error ?? 'Error al guardar.' }); return }
      if (photoFile) {
        const fd = new FormData(); fd.append('photo', photoFile)
        const pr = await setUsuarioPhoto(id, fd)
        if (!pr.ok) { setMsg({ kind: 'err', text: pr.error ?? 'Error al subir la foto.' }); return }
      } else if (removePhoto) {
        const pr = await removeUsuarioPhoto(id)
        if (!pr.ok) { setMsg({ kind: 'err', text: pr.error ?? 'Error al quitar la foto.' }); return }
      }
      setMsg({ kind: 'ok', text: 'Datos guardados.' })
      setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(false)
      router.refresh()
    })
  }

  function savePassword() {
    setPassMsg(null)
    startTx(async () => {
      const res = await changeMyPassword(pass)
      if (!res.ok) { setPassMsg({ kind: 'err', text: res.error ?? 'Error al cambiar la contrasena.' }); return }
      setPass('')
      setPassMsg({ kind: 'ok', text: 'Contrasena actualizada.' })
    })
  }

  return (
    <div className="max-w-[560px] space-y-5">
      <div>
        <h1 className="font-display text-[22px] text-ink">Mi perfil</h1>
        <p className="text-[13px] text-slate mt-0.5">Tus datos personales y tu contrasena.</p>
      </div>

      <div className="bg-paper border border-line rounded p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 pb-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-dark">Cuenta</span>
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
            role === 'super_admin' ? 'bg-info/15 text-info' : 'bg-cream-2 text-slate-dark'
          }`}>{ROLE_LABEL[role]}</span>
        </div>

        {/* Photo */}
        <div className="flex items-center gap-3 pb-1">
          <Avatar url={shownPhoto} name={name || email} size={56} />
          <div className="flex flex-col gap-1.5">
            <label className="px-2.5 py-1.5 rounded border border-line text-[12px] text-slate-dark hover:bg-cream-2 cursor-pointer transition-colors inline-block">
              {shownPhoto ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
            </label>
            {shownPhoto && (
              <button type="button" onClick={clearPhoto} className="text-[11px] text-danger hover:underline text-left">Quitar foto</button>
            )}
          </div>
        </div>

        <Field label="Email (no editable)">
          <input type="email" value={email ?? ''} disabled className="ipt opacity-70" />
        </Field>
        <Field label="Nombre completo">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="ipt" placeholder="Nombre y apellido" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono"><input type="text" value={tel} onChange={e => setTel(e.target.value)} className="ipt" /></Field>
          <Field label="DNI"><input type="text" value={doc} onChange={e => setDoc(e.target.value)} className="ipt" /></Field>
        </div>
        {msg && (
          <div className={`text-[11.5px] rounded px-3 py-2 border ${
            msg.kind === 'ok' ? 'text-success bg-success/10 border-success/30' : 'text-danger bg-danger/10 border-danger/30'
          }`}>{msg.text}</div>
        )}
        <div className="flex justify-end pt-1">
          <button type="button" onClick={saveProfile} disabled={pending}
            className="px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity">
            {pending ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>
      </div>

      <div className="bg-paper border border-line rounded p-5 space-y-3">
        <span className="text-[10px] uppercase tracking-wider text-slate-dark block">Cambiar contrasena</span>
        <Field label="Nueva contrasena">
          <input type="text" value={pass} onChange={e => setPass(e.target.value)} className="ipt" placeholder="Minimo 6 caracteres" />
        </Field>
        {passMsg && (
          <div className={`text-[11.5px] rounded px-3 py-2 border ${
            passMsg.kind === 'ok' ? 'text-success bg-success/10 border-success/30' : 'text-danger bg-danger/10 border-danger/30'
          }`}>{passMsg.text}</div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={savePassword} disabled={pending || !pass}
            className="px-3 py-1.5 rounded border border-line text-[12px] text-slate-dark hover:bg-cream-2 disabled:opacity-50 transition-colors">
            Cambiar contrasena
          </button>
        </div>
      </div>

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
