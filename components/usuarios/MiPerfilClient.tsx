'use client'

// ============================================================================
// MiPerfilClient — any logged-in user edits their OWN profile (name, phone,
// dni, photo) and password. Styled to match the Usuarios admin design.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateMyProfile, changeMyPassword, setUsuarioPhoto, removeUsuarioPhoto,
} from '@/lib/usuarios/actions'
import { ROLE_LABEL, type UsuarioRole } from '@/lib/usuarios/types'
import { resizeImageToFile } from './resizeImage'

interface Props {
  id: string; email: string | null; role: UsuarioRole
  fullName: string | null; phone: string | null; dni: string | null; photoUrl: string | null
}

const INPUT = 'w-full h-10 px-3 rounded-lg border border-line bg-cream/60 text-[13.5px] text-ink placeholder:text-slate outline-none focus:border-info focus:bg-paper transition-colors'

export function MiPerfilClient({ id, email, role, fullName, phone, dni, photoUrl }: Props) {
  const [name, setName] = useState(fullName ?? '')
  const [tel, setTel]   = useState(phone ?? '')
  const [doc, setDoc]   = useState(dni ?? '')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto]   = useState(false)
  const [msg, setMsg]         = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [passMsg, setPassMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTx]    = useTransition()
  const router = useRouter()

  const shownPhoto = photoPreview ?? (removePhoto ? null : photoUrl)

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setMsg({ kind: 'err', text: 'El archivo debe ser una imagen.' }); return }
    try {
      const small = await resizeImageToFile(f)
      setPhotoFile(small); setPhotoPreview(URL.createObjectURL(small)); setRemovePhoto(false)
    } catch (err) { setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'No se pudo procesar la imagen.' }) }
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
    <div className="max-w-[640px] space-y-5">
      <div>
        <h1 className="font-display text-[22px] font-semibold text-ink">Mi perfil</h1>
        <p className="text-[13px] text-slate mt-0.5">Tus datos personales y tu contrasena.</p>
      </div>

      {/* Profile card */}
      <div className="bg-paper border border-line rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-line">
          <span className="text-[12px] uppercase tracking-wider text-slate">Cuenta</span>
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11.5px] font-medium ${
            role === 'super_admin' ? 'bg-info/15 text-info' : 'border border-line text-slate-dark'
          }`}>{ROLE_LABEL[role]}</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer shrink-0">
              <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
              {shownPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownPhoto} alt="" className="w-20 h-20 rounded-full object-cover border border-line" />
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-line bg-cream-2/40 flex items-center justify-center">
                  <IconCamera />
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-info flex items-center justify-center border-[3px] border-paper">
                <IconPlus />
              </span>
            </label>
            <div>
              <p className="text-[13px] font-medium text-ink">{shownPhoto ? 'Cambiar foto' : 'Subir foto'}</p>
              <p className="text-[11.5px] text-slate">JPG, PNG o GIF.</p>
              {shownPhoto && <button type="button" onClick={clearPhoto} className="text-[11px] text-danger hover:underline mt-0.5">Quitar foto</button>}
            </div>
          </div>

          <Field label="Email (no editable)">
            <input type="email" value={email ?? ''} disabled className={INPUT + ' opacity-60'} />
          </Field>
          <Field label="Nombre completo">
            <input value={name} onChange={e => setName(e.target.value)} className={INPUT} placeholder="Nombre y apellido" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefono"><input value={tel} onChange={e => setTel(e.target.value)} className={INPUT} /></Field>
            <Field label="DNI"><input value={doc} onChange={e => setDoc(e.target.value)} className={INPUT} /></Field>
          </div>

          {msg && (
            <div className={`text-[12px] rounded-lg px-3 py-2 border ${
              msg.kind === 'ok' ? 'text-success bg-success/10 border-success/30' : 'text-danger bg-danger/10 border-danger/30'
            }`}>{msg.text}</div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={saveProfile} disabled={pending}
              className="px-4 py-2.5 rounded-lg bg-info text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm">
              {pending ? 'Guardando...' : 'Guardar datos'}
            </button>
          </div>
        </div>
      </div>

      {/* Password card */}
      <div className="bg-paper border border-line rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <span className="text-[12px] uppercase tracking-wider text-slate">Cambiar contrasena</span>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Nueva contrasena">
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)}
                className={INPUT + ' pr-10'} placeholder="Minimo 6 caracteres" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink transition-colors">
                {showPass ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </Field>
          {passMsg && (
            <div className={`text-[12px] rounded-lg px-3 py-2 border ${
              passMsg.kind === 'ok' ? 'text-success bg-success/10 border-success/30' : 'text-danger bg-danger/10 border-danger/30'
            }`}>{passMsg.text}</div>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={savePassword} disabled={pending || !pass}
              className="px-4 py-2.5 rounded-lg border border-line text-[13px] font-medium text-slate-dark hover:bg-cream-2 disabled:opacity-50 transition-colors">
              Cambiar contrasena
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-slate-dark block mb-1.5">{label}</span>
      {children}
    </label>
  )
}

const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconCamera() { return <svg viewBox="0 0 24 24" {...sv} className="w-6 h-6 text-info"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg> }
function IconPlus() { return <svg viewBox="0 0 20 20" {...sv} className="w-3.5 h-3.5 text-white"><path d="M10 4v12M4 10h12" /></svg> }
function IconEye() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" /><circle cx="10" cy="10" r="2.2" /></svg> }
function IconEyeOff() { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M3 3l14 14M8 8a2.5 2.5 0 003.5 3.5M6 6C3.5 7.5 2 10 2 10s3 5 8 5c1.4 0 2.7-.4 3.8-1" /></svg> }
