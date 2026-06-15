'use client'

// ============================================================================
// InlineEntityCell — click-to-edit cell with autocomplete + new-name alert.
//
// Used for the Propietario and Inquilino columns of the /liquidacion grid.
// Goal: prevent typos from creating duplicate landlords/tenants. The
// encargada either picks an existing entity from the dropdown, or — if her
// typed text matches nothing — sees an alert before a new entity is created.
//
// States:
//   1. Display       — shows the current name (truncate); click to edit.
//   2. Editing       — input + dropdown of matches as she types.
//   3. New-name confirm — shown when she presses Enter/Tab on text that
//                         doesn't match any existing option.
//
// Behaviour:
//   • Type ahead — case-insensitive substring match over `options`.
//   • Arrow keys + Enter to select from the dropdown.
//   • Esc to cancel (no save).
//   • Enter/Tab/blur with text that EXACTLY matches an option → link silent.
//   • Enter/Tab/blur with text that doesn't match → confirm new-name dialog.
//
// Server side: parent passes `onPickExisting(id)` and `onCreateNew(name)`
// callbacks. Both return `Promise<{ ok; error? }>` so the cell can show
// errors inline.
// ============================================================================

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface EntityOption {
  id:   string
  name: string
}

interface Props {
  /** Current display value (the linked entity's name). */
  currentName: string
  /** All candidates the encargada can pick from. */
  options:     EntityOption[]
  /** Human-readable label: "propietario" / "inquilino" — used in the alert. */
  entityLabel: string
  /** Called when the encargada picks an existing option from the dropdown. */
  onPickExisting: (id: string) => Promise<{ ok: boolean; error?: string | null }>
  /** Called when she confirms creating a new entity. */
  onCreateNew:    (name: string) => Promise<{ ok: boolean; error?: string | null }>
  /** Optional class overrides for the display state (e.g. font weight). */
  displayClassName?: string
  /** Optional secondary line (e.g. "co-propiedad" hint). */
  hint?: string
}

const MAX_DROPDOWN = 8

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
  const [pending, startTransition]  = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // Filtered options — case-insensitive substring on the cleaned value.
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options.slice(0, MAX_DROPDOWN)
    return options
      .filter(o => o.name.toLowerCase().includes(q))
      .slice(0, MAX_DROPDOWN)
  }, [value, options])

  // Exact match — case-insensitive trim equality.
  const exactMatch = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return null
    return options.find(o => o.name.trim().toLowerCase() === q) ?? null
  }, [value, options])

  function commit() {
    const v = value.trim()
    // No change → just leave editing mode without a server round-trip.
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
    // No match — show the confirm-new dialog.
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
    <div className="relative">
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
            // If a dropdown row is highlighted AND user has typed something, prefer the highlight.
            if (matches[highlight] && value.trim()) {
              saveExisting(matches[highlight].id)
            } else {
              commit()
            }
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          } else if (e.key === 'Tab') {
            // Don't preventDefault — let Tab move focus naturally; commit on blur.
            commit()
          }
        }}
        onBlur={() => {
          // If the new-name dialog opens, blur will fire — but we don't want
          // to cancel; we want the dialog to remain. Detect that via confirmNew.
          if (!confirmNew) commit()
        }}
        disabled={pending}
        placeholder={`Escribí nombre del ${entityLabel}…`}
        className="w-full px-1.5 py-0.5 text-[12px] border border-ink rounded bg-paper outline-none text-ink"
      />

      {/* Dropdown — only when editing AND we have matches AND no confirm dialog */}
      {!confirmNew && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-40 bg-paper border border-line rounded shadow-card max-h-[220px] overflow-y-auto"
        >
          {matches.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={e => { e.preventDefault(); saveExisting(m.id) }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-2 py-1 text-[12px] cursor-pointer ${i === highlight ? 'bg-cream-2 text-ink' : 'text-slate-dark hover:bg-cream'}`}
            >
              {m.name}
            </li>
          ))}
          {!exactMatch && value.trim() && (
            <li
              className="px-2 py-1 text-[11px] text-ink bg-warn/10 border-t border-line italic"
              title="Sin coincidencias — al confirmar, se creará una nueva entrada"
            >
              ⚠ No existe — al guardar se pedirá confirmación
            </li>
          )}
        </ul>
      )}

      {/* New-name confirm dialog */}
      {confirmNew && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute left-0 top-full mt-1 z-50 bg-paper border-2 border-warn rounded shadow-card p-3 min-w-[260px]"
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
        </div>
      )}
    </div>
  )
}
