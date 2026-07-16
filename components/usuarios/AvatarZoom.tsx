'use client'

// ============================================================================
// AvatarZoom — the small Avatar, but clicking it (when there is a photo) opens
// a full-screen lightbox with the picture enlarged. Rendered through a portal
// so it sits above whatever table row or modal it lives inside. Built once,
// reused in the topbar profile modal and the Usuarios list. Avatars with only
// an initial (no photo) render as a plain, non-clickable Avatar.
// ============================================================================

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from './Avatar'

interface AvatarZoomProps {
  url: string | null
  name?: string | null
  size?: number
  fallbackClassName?: string
  /** Caption shown under the enlarged photo. Defaults to `name`. */
  caption?: string | null
}

export function AvatarZoom({ url, name, size = 38, fallbackClassName, caption }: AvatarZoomProps) {
  const [open, setOpen]       = useState(false)
  const [mounted, setMounted] = useState(false)

  // Portals need `document`; only render the overlay after mount.
  useEffect(() => { setMounted(true) }, [])

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // No photo -> nothing to enlarge; render the plain avatar untouched.
  if (!url) {
    return <Avatar url={url} name={name} size={size} fallbackClassName={fallbackClassName} />
  }

  const label = caption ?? name ?? ''

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title="Ver foto"
        aria-label="Ver foto ampliada"
        className="rounded-full cursor-zoom-in shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-info/60"
      >
        <Avatar url={url} name={name} size={size} fallbackClassName={fallbackClassName} />
      </button>

      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          // Black scrim on purpose (not a theme token): a photo lightbox reads
          // best on black in both light and dark, and white controls stay
          // legible regardless of the app theme.
          className="fixed inset-0 z-[1300] flex flex-col items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/10 text-white border border-white/25 hover:bg-white/20 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[80vh] rounded-2xl object-contain shadow-2xl select-none"
          />

          {label && (
            <p
              onClick={(e) => e.stopPropagation()}
              className="mt-4 text-[13.5px] font-medium text-white/90"
            >
              {label}
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
