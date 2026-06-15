'use client'

// ============================================================================
// InlineEntityCell — Excel-like click-to-edit cell with autocomplete.
//
// Behaviour model (confirmed with Alejandro / Medhi-chan):
//   1. Click cell → input takes over the cell (no border offset, fills it)
//      and value is selected, ready to be typed-over.
//   2. While typing, dropdown shows suggestions — purely informational.
//   3. On blur (mouse leaves the cell):
//        • Empty or unchanged value → silent revert, no save.
//        • Exact match against an existing option → silent link (optimistic).
//        • No match → open NewEntityModal so the encargada can enrich
//          the new entity (phone, email, DNI) before saving.
//   4. Esc → silent revert.
//   5. Pick from dropdown (click / Enter on highlight) → instant link
//      (optimistic — cell closes before the backend round-trip completes).
//
// Optimistic UI: the cell closes immediately on successful pick/blur and
// shows the new value, even before the server has confirmed. The server
// call fires in the background; on failure the cell reverts and shows the
// error. Eliminates the "slow response" the user noticed.
//
// All overlay UI (dropdown + modal) is portal-rendered to document.body
// so it escapes the table's overflow + sticky stacking contexts.
// ============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { NewEntityModal, type NewEntityFields } from './NewEntityModal'

export interface EntityOption {
  id:   string
  name: string
}

interface Props {
  currentName:    string
  options:        EntityOption[]
  entityLabel:    string                  // "propietario" / "inquilino"
  entityType:     'landlord' | 'tenant'   // for the create modal
  onPickExisting: (id: string)            => Promise<{ ok: boolean; error?: string | null }>
  onCreateNew:    (fields: NewEntityFields) => Promise<{ ok: boolean; error?: string | null }>
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
  entityType,
  onPickExisting,
  onCreateNew,
  displayClassName,
  hint,
}: Props) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(currentName)
  const [highlight, setHighlight] = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [modalName, setModalName] = useState<string | null>(null)

  // Optimistic display value — shown immediately on a successful pick,
  // overrides the server-provided currentName until router.refresh syncs.
  const [optimisticName, setOptimisticName] = useState<string | null>(null)
  // Suppress further blur handling while a pick is in flight.
  const [pendingPick, setPendingPick] = useState(false)

  const [rect, setRect] = useState<OverlayRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  // ── Display value: optimistic > current ──────────────────────────────────
  const shown = optimisticName ?? currentName

  // Reset optimistic when server data catches up.
  useEffect(() => {
    if (optimisticName != null && optimisticName === currentName) {
      setOptimisticName(null)
    }
  }, [currentName, optimisticName])

  // ── Filtered / exact-match logic ─────────────────────────────────────────
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

  // ── Focus + select-all when entering edit mode ───────────────────────────
  useLayoutEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
      const idx = matches.findIndex(m => m.id === exactMatch?.id)
      setHighlight(idx >= 0 ? idx : 0)
      computeRect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  // ── Reposition overlay on scroll / resize while editing ──────────────────
  useEffect(() => {
    if (!editing) return
    const onReflow = () => computeRect()
    window.addEventListener('scroll', onReflow, true)
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

  // ── Optimistic save for picking existing ─────────────────────────────────
  // Close the cell immediately, show the new name, fire the server in the
  // background. On failure, revert + show the error.
  function pickExisting(opt: EntityOption) {
    setOptimisticName(opt.name)
    setEditing(false)
    setValue(opt.name)
    setPendingPick(true)
    setError(null)
    onPickExisting(opt.id)
      .then(res => {
        if (!res.ok) {
          setOptimisticName(null)
          setError(res.error ?? 'Error al guardar')
        } else {
          router.refresh()
        }
      })
      .finally(() => setPendingPick(false))
  }

  // ── Blur handler: silent revert / silent link / open modal ───────────────
  function handleBlur() {
    if (pendingPick) return
    const typed   = value.trim()
    const current = currentName.trim()
    if (!typed || typed === current) {
      setValue(currentName)
      setEditing(false)
      return
    }
    if (exactMatch) {
      pickExisting(exactMatch)
      return
    }
    // No exact match → open the entity creation modal.
    setModalName(typed)
    setEditing(false)
  }

  function handleCreate(fields: NewEntityFields): Promise<{ ok: boolean; error?: string | null }> {
    setError(null)
    return onCreateNew(fields).then(res => {
      if (res.ok) {
        setOptimisticName(fields.name)
        setModalName(null)
        router.refresh()
      } else {
        setError(res.error ?? 'Error al crear')
      }
      return res
    })
  }

  function cancelModal() {
    setModalName(null)
    setValue(currentName)
  }

  // ── Display state ────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <>
        <button
          type="button"
          onClick={() => { setValue(shown); setEditing(true); setError(null) }}
          title={`Tocá para editar ${entityLabel}`}
          className={`w-full text-left px-0 -mx-0 hover:bg-blue-50 transition-colors truncate block ${displayClassName ?? 'text-slate-dark'} ${pendingPick ? 'opacity-60' : ''}`}
        >
          <span className="truncate block">{shown || <span className="text-slate/60">— sin {entityLabel} —</span>}</span>
          {hint && <span className="text-[9px] text-slate block">{hint}</span>}
          {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
        </button>

        {modalName && (
          <NewEntityModal
            entityType={entityType}
            defaultName={modalName}
            onCancel={cancelModal}
            onCreate={handleCreate}
          />
        )}
      </>
    )
  }

  // ── Editing state ────────────────────────────────────────────────────────
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
              pickExisting(matches[highlight])
            } else {
              handleBlur()
            }
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setValue(currentName)
            setEditing(false)
          } else if (e.key === 'Tab') {
            handleBlur()
          }
        }}
        onBlur={() => {
          // Defer so a dropdown mousedown can win first.
          setTimeout(() => {
            if (editing && document.activeElement !== inputRef.current) {
              handleBlur()
            }
          }, 50)
        }}
        placeholder={`Escribí nombre del ${entityLabel}…`}
        // Visually fills the cell exactly — no border, no rounding, no extra
        // padding. The yellow tint is the Excel "editing" affordance.
        className="w-full px-0 py-0 text-[12px] bg-yellow-50 outline outline-2 outline-info -outline-offset-2 text-ink"
      />

      {/* Dropdown — portal-rendered to escape table overflow + sticky contexts. */}
      {rect && createPortal(
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top:      rect.top,
            left:     rect.left,
            width:    rect.width,
            zIndex:   1000,
          }}
          className="bg-white border border-gray-300 rounded shadow-lg max-h-[260px] overflow-y-auto py-0.5"
        >
          {matches.length === 0 && (
            <li className="px-3 py-1.5 text-[11.5px] text-gray-500 italic">
              Sin coincidencias. Al salir del campo se podrá crear un nuevo {entityLabel}.
            </li>
          )}
          {matches.map((m, i) => {
            const isCurrent = m.id === exactMatch?.id
            const isHL      = i === highlight
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={isHL}
                onMouseDown={e => { e.preventDefault(); pickExisting(m) }}
                onMouseEnter={() => setHighlight(i)}
                className={[
                  'relative pl-3 pr-2 py-1.5 text-[12.5px] cursor-pointer transition-colors',
                  isHL ? 'bg-info/10 text-ink' : 'text-slate-dark hover:bg-gray-50',
                ].join(' ')}
              >
                {isHL && <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-info rounded-r" aria-hidden />}
                <span className="truncate block">
                  {m.name}
                  {isCurrent && <span className="text-[10px] text-gray-500 ml-2">· actual</span>}
                </span>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}

      {/* New-entity modal — also portal-rendered. */}
      {modalName && (
        <NewEntityModal
          entityType={entityType}
          defaultName={modalName}
          onCancel={cancelModal}
          onCreate={handleCreate}
        />
      )}
    </>
  )
}
