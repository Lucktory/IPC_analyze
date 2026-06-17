// ============================================================================
// EntityCombo — autocomplete picker for landlords / tenants with an inline
// "+ Crear nuevo X" banner that surfaces when the typed name doesn't match.
//
// Portal-renders the dropdown to document.body so it escapes any scrollable
// modal context. The "Crear nuevo" banner sits inline directly under the
// input — never clipped by overflow.
// ============================================================================

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value:           string
  pickedId:        string | null
  onChange:        (text: string, pickedId: string | null) => void
  onRequestCreate: (name: string) => void
  options:         { id: string; name: string }[]
  entityLabel:     string
  placeholder:     string
  /** Tailwind class string forwarded to the underlying input. */
  inputClassName?: string
}

const DEFAULT_INPUT_CLASS =
  'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'

export function EntityCombo({
  value,
  pickedId,
  onChange,
  onRequestCreate,
  options,
  entityLabel,
  placeholder,
  inputClassName = DEFAULT_INPUT_CLASS,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = value.trim()
    ? options.filter(o => o.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : options.slice(0, 8)
  const exact = options.find(o => o.name.trim().toLowerCase() === value.trim().toLowerCase())
  const showCreateBanner = !exact && value.trim().length > 0 && !pickedId

  useEffect(() => {
    if (!open || !inputRef.current) return
    const compute = () => {
      const r = inputRef.current?.getBoundingClientRect()
      if (!r) return
      setRect({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width })
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => onChange(e.target.value, null)}
        placeholder={placeholder}
        className={`${inputClassName} ${pickedId ? 'border-success/60 bg-success/5' : ''}`}
      />
      {pickedId && (
        <span className="absolute right-2 top-2 text-[10px] text-success font-medium" aria-hidden>✓</span>
      )}

      {showCreateBanner && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onRequestCreate(value.trim()); setOpen(false) }}
          className="mt-1 w-full text-left px-2 py-1 rounded border border-warn/60 bg-warn/10 hover:bg-warn/20 text-[11.5px] text-ink font-medium cursor-pointer transition-colors"
        >
          + Crear nuevo {entityLabel}: «{value.trim()}»
        </button>
      )}

      {open && rect && createPortal(
        <ul
          role="listbox"
          style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1080 }}
          className="bg-white border border-gray-300 rounded shadow-lg max-h-[240px] overflow-y-auto"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-1.5 text-[12px] text-gray-500 italic">
              {value.trim() ? 'Sin coincidencias.' : `Escribí para buscar un ${entityLabel}…`}
            </li>
          )}
          {filtered.map(o => (
            <li
              key={o.id}
              role="option"
              onMouseDown={e => { e.preventDefault(); onChange(o.name, o.id); setOpen(false) }}
              className="px-3 py-1.5 text-[12.5px] text-slate-dark hover:bg-info/10 hover:text-ink cursor-pointer truncate"
            >
              {o.name}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
