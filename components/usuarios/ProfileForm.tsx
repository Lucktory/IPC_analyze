'use client'

// ============================================================================
// ProfileForm — the current user's profile editor, split into two tabs so the
// whole thing fits one phone screen (per the approved mobile mockup):
//
//   • Datos       — avatar (click to enlarge / camera badge to change),
//                   email (read-only), nombre, telefono + dni, "Guardar datos".
//   • Contrasena  — actual + nueva + confirmar, each with an eye toggle. The
//                   current password is verified server-side before the change.
//
// Shared by the topbar avatar menu and the sidebar footer (via ProfileModal),
// and by the /mi-perfil page.
// ============================================================================

import { useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { useRouter } from 'next/navigation'
import {
  updateMyProfile, changeMyPassword, setUsuarioPhoto, removeUsuarioPhoto,
} from '@/lib/usuarios/actions'
import { type UsuarioRole } from '@/lib/usuarios/types'
import { resizeImageToFile } from './resizeImage'
import { AvatarZoom } from './AvatarZoom'

interface Props {
  id: string; email: string | null; role: UsuarioRole
  fullName: string | null; phone: string | null; dni: string | null; photoUrl: string | null
}

const FIELD = 'w-full h-11 rounded-xl border border-line bg-cream/60 text-[13.5px] text-ink placeholder:text-slate outline-none focus:border-info focus:bg-paper transition-colors'

type Tab = 'datos' | 'password'

export function ProfileForm({ id, email, fullName, phone, dni, photoUrl }: Props) {
  const [tab, setTab] = useState<Tab>('datos')

  // Datos
  const [name, setName] = useState(fullName ?? '')
  const [tel, setTel]   = useState(phone ?? '')
  const [doc, setDoc]   = useState(dni ?? '')
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto]   = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Contrasena
  const [curPass, setCurPass]         = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confPass, setConfPass]       = useState('')
  const [showCur, setShowCur]         = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConf, setShowConf]       = useState(false)
  const [passMsg, setPassMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [pending, startTx] = useBusyTransition()
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
    if (newPass.length < 6) { setPassMsg({ kind: 'err', text: 'La nueva contrasena debe tener al menos 6 caracteres.' }); return }
    if (newPass !== confPass) { setPassMsg({ kind: 'err', text: 'Las contrasenas no coinciden.' }); return }
    startTx(async () => {
      const res = await changeMyPassword({ currentPassword: curPass, newPassword: newPass })
      if (!res.ok) { setPassMsg({ kind: 'err', text: res.error ?? 'Error al cambiar la contrasena.' }); return }
      setCurPass(''); setNewPass(''); setConfPass('')
      setPassMsg({ kind: 'ok', text: 'Contrasena actualizada.' })
    })
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-cream-2/60 border border-line mb-5">
        <TabButton active={tab === 'datos'}    onClick={() => setTab('datos')}    icon={<IconUser />}>Datos</TabButton>
        <TabButton active={tab === 'password'} onClick={() => setTab('password')} icon={<IconLock />}>Contrasena</TabButton>
      </div>

      {tab === 'datos' ? (
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              {shownPhoto ? (
                <AvatarZoom url={shownPhoto} name={name || email} size={92} caption={name || email} />
              ) : (
                <div className="w-[92px] h-[92px] rounded-full border-2 border-dashed border-line bg-cream-2/40 grid place-items-center">
                  <IconCamera className="w-7 h-7 text-info" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-info grid place-items-center border-[3px] border-paper cursor-pointer hover:opacity-90 transition-opacity" title="Cambiar foto">
                <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                <IconCamera className="w-3.5 h-3.5 text-white" />
              </label>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
              <span className="text-[13px] font-medium text-info hover:underline">Cambiar foto</span>
            </label>
            {shownPhoto && <button type="button" onClick={clearPhoto} className="text-[11px] text-danger hover:underline">Quitar foto</button>}
          </div>

          <Labeled label="Email">
            <IconField icon={<IconMail />}>
              <input type="email" value={email ?? ''} disabled placeholder="usuario@ejemplo.com" className={`${FIELD} pl-10 pr-3 opacity-60`} />
            </IconField>
          </Labeled>

          <Labeled label="Nombre completo">
            <IconField icon={<IconUser />}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre y apellido" className={`${FIELD} pl-10 pr-3`} />
            </IconField>
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Telefono">
              <IconField icon={<IconPhone />}>
                <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Opcional" className={`${FIELD} pl-10 pr-3`} />
              </IconField>
            </Labeled>
            <Labeled label="DNI">
              <IconField icon={<IconId />}>
                <input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Opcional" className={`${FIELD} pl-10 pr-3`} />
              </IconField>
            </Labeled>
          </div>

          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

          <button type="button" onClick={saveProfile} disabled={pending}
            className="w-full h-11 rounded-xl bg-info text-white text-[13.5px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity shadow-sm flex items-center justify-center gap-2">
            <IconSave /> {pending ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hero */}
          <div className="flex flex-col items-center text-center gap-1.5 pt-1 pb-1">
            <span className="w-14 h-14 rounded-2xl bg-info/15 grid place-items-center text-info">
              <IconLock className="w-6 h-6" />
            </span>
            <p className="text-[15px] font-semibold text-ink mt-1">Manten tu cuenta segura</p>
            <p className="text-[12px] text-slate max-w-[280px]">Usa una contrasena segura y cambiala periodicamente.</p>
          </div>

          <Labeled label="Contrasena actual">
            <PasswordInput value={curPass} onChange={setCurPass} show={showCur} onToggle={() => setShowCur(s => !s)} placeholder="Tu contrasena actual" autoComplete="current-password" />
          </Labeled>
          <Labeled label="Nueva contrasena">
            <PasswordInput value={newPass} onChange={setNewPass} show={showNew} onToggle={() => setShowNew(s => !s)} placeholder="Minimo 6 caracteres" autoComplete="new-password" />
          </Labeled>
          <Labeled label="Confirmar nueva contrasena">
            <PasswordInput value={confPass} onChange={setConfPass} show={showConf} onToggle={() => setShowConf(s => !s)} placeholder="Repeti la nueva contrasena" autoComplete="new-password" />
          </Labeled>

          {passMsg && <Notice kind={passMsg.kind}>{passMsg.text}</Notice>}

          <button type="button" onClick={savePassword} disabled={pending || !curPass || !newPass || !confPass}
            className="w-full h-11 rounded-xl border border-info/40 text-info text-[13.5px] font-semibold hover:bg-info/10 disabled:opacity-50 disabled:hover:bg-transparent transition-colors flex items-center justify-center gap-2">
            <IconLock className="w-4 h-4" /> {pending ? 'Guardando...' : 'Cambiar contrasena'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── pieces ──────────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 h-9 rounded-lg text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
        active ? 'bg-info/15 text-info ring-1 ring-inset ring-info/30' : 'text-slate hover:text-ink'
      }`}>
      <span className="w-4 h-4">{icon}</span>
      {children}
    </button>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] text-slate-dark block mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none w-4 h-4">{icon}</span>
      {children}
    </div>
  )
}

function PasswordInput({ value, onChange, show, onToggle, placeholder, autoComplete }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string; autoComplete?: string
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${FIELD} px-3 pr-10`}
      />
      <button type="button" onClick={onToggle} tabIndex={-1} aria-label={show ? 'Ocultar' : 'Mostrar'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink transition-colors">
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

function Notice({ kind, children }: { kind: 'ok' | 'err'; children: React.ReactNode }) {
  return (
    <div className={`text-[12px] rounded-lg px-3 py-2 border ${
      kind === 'ok' ? 'text-success bg-success/10 border-success/30' : 'text-danger bg-danger/10 border-danger/30'
    }`}>{children}</div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────
const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconUser()  { return <svg viewBox="0 0 20 20" {...sv} className="w-full h-full"><circle cx="10" cy="7" r="3" /><path d="M3.5 17 Q3.5 12.5 10 12.5 Q16.5 12.5 16.5 17" /></svg> }
function IconLock({ className = 'w-full h-full' }: { className?: string }) { return <svg viewBox="0 0 20 20" {...sv} className={className}><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9 V6.5 a3 3 0 0 1 6 0 V9" /></svg> }
function IconMail()  { return <svg viewBox="0 0 20 20" {...sv} className="w-full h-full"><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" /><path d="M3 5.5 L10 10.5 L17 5.5" /></svg> }
function IconPhone() { return <svg viewBox="0 0 20 20" {...sv} className="w-full h-full"><path d="M5 3 h3 l1.5 4 -2 1.5 a9 9 0 0 0 4 4 l1.5 -2 4 1.5 v3 a1.5 1.5 0 0 1 -1.5 1.5 A13 13 0 0 1 3.5 4.5 A1.5 1.5 0 0 1 5 3 Z" /></svg> }
function IconId()    { return <svg viewBox="0 0 20 20" {...sv} className="w-full h-full"><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" /><circle cx="7" cy="9.5" r="1.8" /><path d="M4.7 13.5 Q7 11.5 9.3 13.5" /><path d="M11.5 8 H15.5 M11.5 11 H15.5" /></svg> }
function IconCamera({ className = 'w-6 h-6' }: { className?: string }) { return <svg viewBox="0 0 24 24" {...sv} className={className}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg> }
function IconSave()  { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M4 3 h9 l3 3 v11 H4 Z" /><path d="M6.5 3 V7 H12 V3" /><rect x="7" y="11" width="6" height="4" /></svg> }
function IconEye()   { return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" /><circle cx="10" cy="10" r="2.2" /></svg> }
function IconEyeOff(){ return <svg viewBox="0 0 20 20" {...sv} className="w-4 h-4"><path d="M3 3l14 14M8 8a2.5 2.5 0 003.5 3.5M6 6C3.5 7.5 2 10 2 10s3 5 8 5c1.4 0 2.7-.4 3.8-1" /></svg> }
