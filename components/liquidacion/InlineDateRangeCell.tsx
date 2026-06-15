'use client'

// ============================================================================
// InlineDateRangeCell — click-to-edit cell for the CONTRATO (vigencia) column.
//
// Click cell → popover opens with two date inputs (start / end). Save on
// Enter or via the Save button; Esc cancels. Optimistic close.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useFloatingPopover } from './useFloatingPopover'

interface Props {
  startDate:    string | null
  endDate:      string | null
  onSave:       (startDate: string | null, endDate: string | null) => Promise<{ ok: boolean; error?: string | null }>
  displayClassName?: string
  title?:       string
}

function fmtCell(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const f = (s: string | null) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '—'
  return `${f(start)} – ${f(end)}`
}

export function InlineDateRangeCell({ startDate, endDate, onSave, displayClassName, title }: Props) {
  const [open, setOpen]               = useState(false)
  const [draftStart, setDraftStart]   = useState(startDate ?? '')
  const [draftEnd,   setDraftEnd]     = useState(endDate   ?? '')
  const [error, setError]             = useState<string | null>(null)
  const [pending, setPending]         = useState(false)
  const [optimistic, setOptimistic]   = useState<{ s: string | null; e: string | null } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 300 })

  const shownStart = optimistic ? optimistic.s : startDate
  const shownEnd   = optimistic ? optimistic.e : endDate

  useEffect(() => {
    if (open) {
      setDraftStart(startDate ?? '')
      setDraftEnd(endDate ?? '')
      setError(null)
    }
  }, [open, startDate, endDate])

  function commit() {
    const s = draftStart.trim() || null
    const e = draftEnd.trim() || null
    if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return setError('Fecha de inicio inválida.')
    if (e && !/^\d{4}-\d{2}-\d{2}$/.test(e)) return setError('Fecha de fin inválida.')
    if (s && e && new Date(e) <= new Date(s)) return setError('La fecha de fin debe ser posterior al inicio.')
    if (s === (startDate ?? null) && e === (endDate ?? null)) {
      setOpen(false)
      return
    }
    setOptimistic({ s, e })
    setOpen(false)
    setPending(true)
    onSave(s, e)
      .then(res => {
        if (!res.ok) {
          setOptimistic(null)
          setError(res.error ?? 'Error al guardar')
        } else {
          router.refresh()
        }
      })
      .finally(() => setPending(false))
  }

  function cancel() {
    setOpen(false)
    setError(null)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={title}
        className={`w-full text-center px-0 hover:bg-blue-50 transition-colors tabular-nums text-[11px] truncate ${displayClassName ?? 'text-slate-dark'} ${pending ? 'opacity-60' : ''}`}
      >
        {fmtCell(shownStart, shownEnd)}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={cancel} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg p-2"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <p className="label-cap text-gray-500 mb-1">Vigencia</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] text-gray-500">Desde</span>
                <input
                  type="date"
                  value={draftStart}
                  onChange={e => { setDraftStart(e.target.value); setError(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); commit() }
                    if (e.key === 'Escape') { e.preventDefault(); cancel() }
                  }}
                  className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded outline-none focus:border-info"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-gray-500">Hasta</span>
                <input
                  type="date"
                  value={draftEnd}
                  onChange={e => { setDraftEnd(e.target.value); setError(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); commit() }
                    if (e.key === 'Escape') { e.preventDefault(); cancel() }
                  }}
                  className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded outline-none focus:border-info"
                />
              </label>
            </div>
            {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <button type="button" onClick={cancel} className="px-2 py-1 text-[11px] text-gray-600 hover:text-ink">Cancelar</button>
              <button type="button" onClick={commit} className="px-2 py-1 text-[11px] bg-ink text-paper rounded font-medium">Guardar</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
