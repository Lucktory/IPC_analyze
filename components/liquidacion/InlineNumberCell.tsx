'use client'

// ============================================================================
// InlineNumberCell — click-to-edit numeric cell with a comfortable popover.
//
// Used for: Expensas, Pct, Ingresos, Transferencia, Otros, ADM destinations.
//
// Click cell → popover opens directly below it with a wider input
// (~280px) so typing feels comfortable. Enter / blur commits, Esc cancels.
// Optimistic close: the cell exits edit mode immediately on commit, then
// the server call fires in the background.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useFloatingPopover } from './useFloatingPopover'
import { fmtMoney } from '@/lib/format'

interface Props {
  /** Display value (already-rendered string is also acceptable for the cell). */
  value:        number | null
  /** Format hint: 'money' = $X.XXX, 'percent' = X.X%, 'plain' = digits only. */
  format?:      'money' | 'percent' | 'plain'
  /** Min/max bounds for validation. */
  min?:         number
  max?:         number
  /** Optional pre-fill suffix label inside the popover (e.g. "$" or "%"). */
  unit?:        string
  /** Saver — returns standard action shape. */
  onSave:       (value: number) => Promise<{ ok: boolean; error?: string | null }>
  /** Tailwind classes for the read-only display. */
  displayClassName?: string
  /** Tooltip on the read-only display. */
  title?:       string
  /** Optional placeholder for the empty case. */
  placeholder?: string
}

function format(value: number | null, fmt: 'money' | 'percent' | 'plain'): string {
  if (value == null) return '—'
  if (fmt === 'money')   return fmtMoney(value)
  if (fmt === 'percent') return `${value.toFixed(1)}%`
  return value.toString()
}

export function InlineNumberCell({
  value, format: fmt = 'money', min, max, unit, onSave,
  displayClassName, title, placeholder = '—',
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string>(value != null ? value.toString() : '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [optimistic, setOptimistic] = useState<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 240 })

  const shown = optimistic ?? value

  useEffect(() => {
    if (open) {
      setDraft(value != null ? value.toString() : '')
      setError(null)
      // Focus the input after the popover mounts.
      setTimeout(() => inputRef.current?.focus(), 0)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [open, value])

  function commit() {
    const trimmed = draft.trim()
    const next = trimmed === '' ? 0 : Number(trimmed)
    if (!isFinite(next))                          return setError('No es un número.')
    if (min !== undefined && next < min)          return setError(`Mínimo ${min}.`)
    if (max !== undefined && next > max)          return setError(`Máximo ${max}.`)
    if (next === (value ?? 0)) {
      setOpen(false)
      return
    }
    // Optimistic: close immediately, show new value, fire server in background.
    setOptimistic(next)
    setOpen(false)
    setPending(true)
    onSave(next)
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
    setDraft(value != null ? value.toString() : '')
    setOpen(false)
    setError(null)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        className={`w-full text-right px-0 hover:bg-blue-50 transition-colors tabular-nums truncate ${displayClassName ?? 'text-slate-dark'} ${pending ? 'opacity-60' : ''}`}
      >
        {shown != null ? format(shown, fmt) : placeholder}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>

      {open && rect && createPortal(
        <div
          style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
          className="bg-white border border-gray-300 rounded shadow-lg p-2"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            {unit && <span className="text-[12px] text-gray-500">{unit}</span>}
            <input
              ref={inputRef}
              type="number"
              value={draft}
              step="0.01"
              onChange={e => { setDraft(e.target.value); setError(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter')  { e.preventDefault(); commit() }
                if (e.key === 'Escape') { e.preventDefault(); cancel() }
              }}
              onBlur={() => {
                // Defer in case the user clicks a popover button.
                setTimeout(() => commit(), 50)
              }}
              className="flex-1 h-8 px-2 text-[13px] border border-gray-300 rounded outline-none focus:border-info tabular-nums text-ink"
            />
          </div>
          {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
          <p className="text-[10px] text-gray-500 mt-1 italic">Enter para guardar · Esc para cancelar</p>
        </div>,
        document.body,
      )}
    </>
  )
}
