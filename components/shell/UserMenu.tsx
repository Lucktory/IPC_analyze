'use client'

// Click-anywhere-to-dismiss dropdown for the logged-in user: "Mi perfil"
// (opens the profile modal) + "Cerrar sesion". The profile modal hosts the
// shared ProfileForm, so the user edits their data without leaving the page.

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { Avatar } from '@/components/usuarios/Avatar'
import { ProfileModal } from '@/components/usuarios/ProfileModal'
import { recordLogout } from '@/lib/audit/log'
import { type UsuarioRole } from '@/lib/usuarios/types'

interface UserMenuProps {
  email:     string | null
  name?:     string | null
  photoUrl?: string | null
  // Full profile for the "Mi perfil" modal. When userId is null (no session)
  // the Mi perfil item is hidden.
  userId?:   string | null
  role?:     UsuarioRole
  phone?:    string | null
  dni?:      string | null
}

export function UserMenu({
  email, name = null, photoUrl = null,
  userId = null, role = 'user', phone = null, dni = null,
}: UserMenuProps) {
  const [open, setOpen]               = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signingOut, setSigningOut]   = useState(false)
  const router       = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  // Display name = real name, then the email local-part; fallback for dev mode.
  const displayName = name?.trim() || (email ? email.split('@')[0] : 'Sesión')

  // Click outside to close the dropdown.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    // Record the logout while the session still resolves the actor.
    try { await recordLogout() } catch { /* ignore */ }
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative self-center">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-line cursor-pointer hover:bg-cream-2/50 rounded-r transition-colors py-1 pr-2"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar url={photoUrl} name={displayName} size={32} fallbackClassName="bg-ink text-paper font-display font-semibold" />
        <div className="hidden md:flex flex-col leading-tight text-left">
          <span className="text-[13px] font-medium text-ink truncate max-w-[200px]">{displayName}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate">{email ? 'Sesión activa' : 'Sin sesión'}</span>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 bg-paper border border-line rounded shadow-cardHover overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[11px] text-slate uppercase tracking-wider">Sesión iniciada como</p>
            <p className="text-[13px] text-ink font-medium truncate mt-0.5">{email ?? '—'}</p>
          </div>

          {userId && (
            <button
              type="button"
              onClick={() => { setOpen(false); setProfileOpen(true) }}
              className="w-full px-4 py-2.5 text-left text-[13px] text-slate-dark hover:bg-cream-2 transition-colors flex items-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              Mi perfil
            </button>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full px-4 py-2.5 text-left text-[13px] text-slate-dark hover:bg-cream-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-t border-line"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      )}

      {/* Mi perfil modal — shared, portal-rendered. */}
      {userId && (
        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          id={userId}
          email={email}
          role={role}
          fullName={name}
          phone={phone}
          dni={dni}
          photoUrl={photoUrl}
        />
      )}
    </div>
  )
}
