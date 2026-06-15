'use client'

// ============================================================================
// InlineEntityCell — click-to-edit cell with autocomplete and a comfortable
// popover editor. Used for Propietario + Inquilino columns.
//
// Behaviour:
//   • Click cell → popover opens directly below it, ~320px wide, with a
//     comfortable text input. Current value selected, ready for replace-on-type.
//   • Typing filters the suggestion list (max 8 shown).
//   • Picking a suggestion → optimistic close (instant), server in background.
//   • "+ Crear nuevo X" row at the bottom of the dropdown — explicit
//     affordance to create a new entity (opens NewEntityModal).
//   • Blur with no exact match → also opens NewEntityModal as a backup.
//   • Esc / click outside → cancel.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useFloatingPopover } from './useFloatingPopover'
import { NewEntityModal, type NewEntityFields } from './NewEntityModal'

export interface EntityOption {
  id:   string
  name: string
}

interface Props {
  currentName:    string
  options:        EntityOption[]
  entityLabel:    string                  // "propietario" / "inquilino"
  entityType:     'landlord' | 'tenant'
  onPickExisting: (id: string)              => Promise<{ ok: boolean; error?: string | null }>
  onCreateNew:    (fields: NewEntityFields) => Promise<{ ok: boolean; error?: string | null }>
  displayClassName?: string
  hint?:             string
}

const MAX_DROPDOWN = 8

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
  const [open, setOpen]                       = useState(false)
  const [value, setValue]                     = useState(currentName)
  const [highlight, setHighlight]             = useState(0)
  const [error, setError]                     = useState<string | null>(null)
  const [modalName, setModalName]             = useState<string | null>(null)
  const [optimisticName, setOptimisticName]   = useState<string | null>(null)
  const [pendingPick, setPendingPick]         = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const router    = useRouter()

  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 320 })

  const shown = optimisticName ?? currentName

  // Clear optimistic state when server data catches up.
  useEffect(() => {
    if (optimisticName != null && optimisticName === currentName) {
      setOptimisticName(null)
    }
  }, [currentName, optimisticName])

  // Focus + select input when popover opens.
  useEffect(() => {
    if (open) {
      setValue(shown)
      setError(null)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  function pickExisting(opt: EntityOption) {
    setOptimisticName(opt.name)
    setOpen(false)
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

  function commit() {
    if (pendingPick) return
    const typed = value.trim()
    const current = currentName.trim()
    if (!typed || typed === current) {
      setOpen(false)
      return
    }
    if (exactMatch) {
      pickExisting(exactMatch)
      return
    }
    // No match → open create modal.
    setModalName(typed)
    setOpen(false)
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        title={`Tocá para editar ${entityLabel}`}
        className={`w-full text-left px-0 hover:bg-blue-50 transition-colors truncate block ${displayClassName ?? 'text-slate-dark'} ${pendingPick ? 'opacity-60' : ''}`}
      >
        <span className="truncate block">{shown || <span className="text-slate/60">— sin {entityLabel} —</span>}</span>
        {hint && <span className="text-[9px] text-slate block">{hint}</span>}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>

      {/* Popover editor — anchored to the cell, comfortably sized */}
      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={commit} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-2 border-b border-gray-200">
              <input
                ref={inputRef}
                type="text"
                value={value}
                placeholder={`Buscá o escribí nombre del ${entityLabel}…`}
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
                      commit()
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setValue(currentName)
                    setOpen(false)
                  }
                }}
                className="w-full h-9 px-2 text-[13px] border border-gray-300 rounded outline-none focus:border-info text-ink"
              />
            </div>

            <ul role="listbox" className="max-h-[260px] overflow-y-auto py-0.5">
              {matches.length === 0 && (
                <li className="px-3 py-2 text-[12px] text-gray-500 italic">
                  Sin coincidencias.
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
                    onClick={() => pickExisting(m)}
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
            </ul>

            {/* Explicit "+ Crear nuevo" button — always present so the
                encargada has a clear affordance to create a new entity. */}
            <button
              type="button"
              onClick={() => {
                const typed = value.trim() || ''
                setModalName(typed)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 border-t border-gray-200 bg-warn/10 hover:bg-warn/20 text-[12.5px] text-ink font-medium transition-colors"
            >
              + Crear nuevo {entityLabel}{value.trim() ? `: «${value.trim()}»` : ''}
            </button>
          </div>
        </>,
        document.body,
      )}

      {/* New-entity modal — triggered by the button above or by blur with no match. */}
      {modalName !== null && (
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
