'use client'

// ============================================================================
// InlineSelectCell — click-to-edit cell for fixed-option fields (e.g. LFA).
//
// Click cell → small popover with the options as a tight list. Click an
// option → instant commit (optimistic). Esc closes without saving.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useFloatingPopover } from './useFloatingPopover'

interface Option { value: string; label: string }

interface Props {
  value:    string | null
  options:  Option[]
  /** Save handler — `value` is null when the encargada picks the empty row. */
  onSave:   (value: string | null) => Promise<{ ok: boolean; error?: string | null }>
  /** Tailwind classes for the read-only display. */
  displayClassName?: string
  /** Tooltip on the read-only display. */
  title?:   string
}

export function InlineSelectCell({ value, options, onSave, displayClassName, title }: Props) {
  const [open, setOpen]               = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [pending, setPending]         = useState(false)
  const [optimistic, setOptimistic]   = useState<string | null | undefined>(undefined)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router    = useRouter()

  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 140 })

  const shown = optimistic === undefined ? value : optimistic

  function pick(next: string | null) {
    if (next === value) {
      setOpen(false)
      return
    }
    setOptimistic(next)
    setOpen(false)
    setPending(true)
    onSave(next)
      .then(res => {
        if (!res.ok) {
          setOptimistic(undefined)
          setError(res.error ?? 'Error al guardar')
        } else {
          router.refresh()
        }
      })
      .finally(() => setPending(false))
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={title}
        className={`w-full text-center px-0 hover:bg-blue-50 transition-colors ${displayClassName ?? 'text-slate-dark'} ${pending ? 'opacity-60' : ''}`}
      >
        {shown ?? '—'}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>

      {open && rect && createPortal(
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />

          <ul
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg py-0.5"
          >
            <li
              onClick={() => pick(null)}
              className="px-3 py-1.5 text-[12.5px] text-gray-500 italic cursor-pointer hover:bg-gray-50"
            >
              — Limpiar
            </li>
            {options.map(o => (
              <li
                key={o.value}
                onClick={() => pick(o.value)}
                className={`px-3 py-1.5 text-[12.5px] cursor-pointer ${o.value === shown ? 'bg-info/10 text-ink font-medium' : 'text-slate-dark hover:bg-gray-50'}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </>,
        document.body,
      )}
    </>
  )
}
