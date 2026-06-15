'use client'

// ============================================================================
// InlineEntityCell — click-to-edit cell with autocomplete + new-name alert.
//
// Used by the Propietario and Inquilino columns of the /liquidacion grid.
// Goal: prevent typos from creating duplicate landlords/tenants. The
// encargada either picks an existing entity from the dropdown, or — if her
// typed text matches nothing — confirms before a new entity is created.
//
// Why portal rendering: the grid lives inside a horizontally-scrolling
// container, and several cells are `position: sticky`. Both create stacking
// + clipping contexts that would chop an `absolute`-positioned dropdown.
// Rendering the dropdown into `document.body` and positioning via the
// input's getBoundingClientRect escapes those boundaries entirely.
//
// States:
//   1. Display       — current name + click to edit
//   2. Editing       — input + dropdown of matches (always shown on focus)
//   3. New-name confirm — when she commits text that doesn't match any
//                         option, a warning dialog appears
//
// Behaviour:
//   • Enter edit mode → input auto-selects all text (first keystroke replaces)
//                       and dropdown opens with ALL options (sorted, capped)
//   • Type-ahead       → case-insensitive substring match over `options`
//   • Arrow keys ↑↓    → move highlight
//   • Enter            → pick highlighted option (or commit current text)
//   • Esc              → cancel
//   • Tab / blur       → commit
//   • Commit with text not in options → confirm-new dialog
// ============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

export interface EntityOption {
  id:   string
  name: string
}

interface Props {
  currentName:    string
  options:        EntityOption[]
  entityLabel:    string
  onPickExisting: (id: string) => Promise<{ ok: boolean; error?: string | null }>
  onCreateNew:    (name: string) => Promise<{ ok: boolean; error?: string | null }>
  displayClassName?: string
  hint?:             string
}

const MAX_DROPDOWN = 8
const DROPDOWN_MIN_WIDTH = 320

interface OverlayRect {
  top:   number
  left:  number
  width: number
}

export function InlineEntityCell({
  currentName,
  options,
  entityLabel,
  onPickExisting,
  onCreateNew,
  displayClassName,
  hint,
}: Props) {
  const [editing, setEditing]       = useState(false)
  const [value, setValue]           = useState(currentName)
  const [highlight, setHighlight]   = useState(0)
  const [error, setError]           = useState<string | null>(null)
  const [confirmNew, setConfirmNew] = useState<string | null>(null)
  const [rect, setRect]             = useState<OverlayRect | null>(null)
  const [pending, startTransition]  = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  // ── Filtered / exact-match logic ──────────────────────────────────────────
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options.slice(0, MAX_DROPDOWN)
    return options
      .filter(o => o.name.toLowerCase().includes(q))
      .slice(0, MAX_DROPDOWN)
  }, [value, options])

  const exactMatch = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return null
    return options.find(o => o.name.trim().toLowerCase() === q) ?? null
  }, [value, options])

  // ── Focus + select-all when entering edit mode. useLayoutEffect runs
  //    before the browser paints so the user never sees an un-selected state.
  useLayoutEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
      // Highlight the row matching the current value, if present.
      const idx = matches.findIndex(m => m.id === exactMatch?.id)
      setHighlight(idx >= 0 ? idx : 0)
      computeRect()
    }
    // Intentionally only on editing transition. Mid-edit recomputation is
    // handled by recomputeOnReflow below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // ── Reposition the overlay on scroll / resize while editing.
  useEffect(() => {
    if (!editing) return
    const onReflow = () => computeRect()
    window.addEventListener('scroll', onReflow, true)  // capture-phase: catch inner scrollers
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [editing])

  function computeRect() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({
      top:   r.bottom + window.scrollY + 2,
      left:  r.left   + window.scrollX,
      width: Math.max(r.width, DROPDOWN_MIN_WIDTH),
    })
  }

  // ── Commit / cancel / save flows ──────────────────────────────────────────
  function commit() {
    const v = value.trim()
    if (v === currentName.trim()) {
      setEditing(false)
      setError(null)
      return
    }
    if (!v) {
      setError(`El ${entityLabel} no puede quedar vacío.`)
      return
    }
    if (exactMatch) {
      saveExisting(exactMatch.id)
      return
    }
    setConfirmNew(v)
  }

  function saveExisting(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await onPickExisting(id)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      setEditing(false)
      setConfirmNew(null)
      router.refresh()
    })
  }

  function saveNew(name: string) {
    setError(null)
    startTransition(async () => {
      const res = await onCreateNew(name)
      if (!res.ok) {
        setError(res.error ?? 'Error al crear')
        return
      }
      setEditing(false)
      setConfirmNew(null)
      router.refresh()
    })
  }

  function cancel() {
    setValue(currentName)
    setEditing(false)
    setConfirmNew(null)
    setError(null)
  }

  // ── Display state ─────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(currentName); setEditing(true) }}
        title={`Tocá para editar ${entityLabel}`}
        className={`w-full text-left px-1 -mx-1 rounded hover:bg-cream-2 transition-colors truncate ${displayClassName ?? 'text-slate-dark'} ${pending ? 'opacity-50' : ''}`}
      >
        <span className="truncate block">{currentName || <span className="text-slate/60">— sin {entityLabel} —</span>}</span>
        {hint && <span className="text-[9px] text-slate block">{hint}</span>}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>
    )
  }

  // ── Editing state ─────────────────────────────────────────────────────────
  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => { setValue(e.target.value); setHighlight(0); setError(null) }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight(h => Math.min(h + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(h => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (matches[highlight] && value.trim()) {
              saveExisting(matches[highlight].id)
            } else {
              commit()
            }
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          } else if (e.key === 'Tab') {
            commit()
          }
        }}
        onBlur={() => {
          // Defer the blur commit by a tick so a mousedown on a dropdown
          // item can win (its onMouseDown already preventDefaults focus loss).
          setTimeout(() => {
            if (!confirmNew && editing && document.activeElement !== inputRef.current) {
              commit()
            }
          }, 50)
        }}
        disabled={pending}
        placeholder={`Escribí nombre del ${entityLabel}…`}
        className="w-full px-1.5 py-0.5 text-[12px] border border-ink rounded bg-paper outline-none text-ink"
      />

      {/* Dropdown — portal-rendered to escape the table's overflow + sticky contexts. */}
      {rect && !confirmNew && matches.length > 0 && createPortal(
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top:      rect.top,
            left:     rect.left,
            width:    rect.width,
            zIndex:   1000,
          }}
          className="bg-paper border border-line rounded shadow-lg max-h-[260px] overflow-y-auto py-0.5"
        >
          {matches.map((m, i) => {
            const isCurrent = m.id === exactMatch?.id
            const isHL      = i === highlight
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={isHL}
                onMouseDown={e => { e.preventDefault(); saveExisting(m.id) }}
                onMouseEnter={() => setHighlight(i)}
                className={[
                  'relative pl-3 pr-2 py-1.5 text-[12.5px] cursor-pointer transition-colors',
                  isHL  ? 'bg-info/10 text-ink' : 'text-slate-dark hover:bg-cream',
                ].join(' ')}
              >
                {/* Left accent — visible when highlighted */}
                {isHL && <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-info rounded-r" aria-hidden />}
                <span className="truncate block">
                  {m.name}
                  {isCurrent && <span className="text-[10px] text-slate ml-2">· actual</span>}
                </span>
              </li>
            )
          })}
          {!exactMatch && value.trim() && (
            <li
              className="px-3 py-1.5 text-[11px] text-ink bg-warn/15 border-t border-line italic"
              title="Sin coincidencias — al confirmar, se creará una nueva entrada"
            >
              ⚠ &ldquo;{value.trim()}&rdquo; no existe — Enter para crear nuevo
            </li>
          )}
        </ul>,
        document.body,
      )}

      {/* New-name confirm dialog — also portal-rendered. */}
      {rect && confirmNew && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'absolute',
            top:      rect.top,
            left:     rect.left,
            width:    rect.width,
            zIndex:   1001,
          }}
          className="bg-paper border-2 border-warn rounded shadow-lg p-3"
        >
          <p className="text-[12px] text-ink font-medium mb-1">⚠ Nuevo {entityLabel}</p>
          <p className="text-[11.5px] text-slate-dark mb-2 leading-snug">
            <strong className="text-ink">&ldquo;{confirmNew}&rdquo;</strong> no existe en la lista.
            ¿Querés crear un nuevo {entityLabel} o corregir el nombre?
          </p>
          {error && <p className="text-[11px] text-danger mb-1.5">{error}</p>}
          <div className="flex items-center gap-1.5 justify-end">
            <button
              type="button"
              onClick={() => { setConfirmNew(null); inputRef.current?.focus() }}
              disabled={pending}
              className="px-2.5 py-1 text-[11.5px] rounded border border-line text-slate-dark hover:bg-cream-2 transition-colors"
            >
              Volver a editar
            </button>
            <button
              type="button"
              onClick={() => saveNew(confirmNew)}
              disabled={pending}
              className="px-2.5 py-1 text-[11.5px] rounded bg-warn text-ink font-medium hover:opacity-90 transition-opacity"
            >
              {pending ? 'Creando…' : 'Crear nuevo'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
