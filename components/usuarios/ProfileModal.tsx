'use client'

// ============================================================================
// ProfileModal — the "Mi perfil" editor as a controlled modal. Hosts the
// shared ProfileForm. Rendered through a portal to document.body so it always
// covers the viewport (the sidebar's translate-x transform would otherwise
// trap a plain `fixed` overlay inside the 240px rail). Reused by the topbar
// avatar menu AND the sidebar footer.
// ============================================================================

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ProfileForm } from './ProfileForm'
import { type UsuarioRole } from '@/lib/usuarios/types'

interface Props {
  open:     boolean
  onClose:  () => void
  id:       string
  email:    string | null
  role:     UsuarioRole
  fullName: string | null
  phone:    string | null
  dni:      string | null
  photoUrl: string | null
}

export function ProfileModal({ open, onClose, id, email, role, fullName, phone, dni, photoUrl }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" />
      <div className="relative bg-paper border border-line rounded-xl shadow-xl w-full max-w-[560px] max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 flex items-center justify-between border-b border-line sticky top-0 bg-paper z-10">
          <h2 className="font-display text-[16px] font-semibold text-ink">Mi perfil</h2>
          <button type="button" onClick={onClose} className="text-slate hover:text-ink transition-colors p-1">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">
          <ProfileForm id={id} email={email} role={role} fullName={fullName} phone={phone} dni={dni} photoUrl={photoUrl} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
