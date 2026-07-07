'use client'

// ============================================================================
// InlineTextField — click-to-edit text value. Shows the value (or an empty
// placeholder); click → input; Enter / blur saves, Esc cancels. Optimistic:
// the display updates immediately, then the server call fires.
//
// onSave must be a server action (or a client closure over one). A server
// component can't create that closure, so wrap this in a small client
// component that binds the contract/entity id (see CommissionPctEditor /
// LandlordContactFields for the pattern).
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  value:             string | null
  onSave:            (value: string) => Promise<{ ok: boolean; error?: string | null }>
  type?:             'text' | 'email' | 'tel'
  placeholder?:      string
  emptyLabel?:       string
  displayClassName?: string
}

export function InlineTextField({
  value, onSave, type = 'text', placeholder, emptyLabel = '—', displayClassName,
}: Props) {
  const [editing, setEditing]       = useState(false)
  const [draft, setDraft]           = useState(value ?? '')
  const [error, setError]           = useState<string | null>(null)
  const [pending, setPending]       = useState(false)
  const [optimistic, setOptimistic] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  const shown = optimistic ?? value

  useEffect(() => {
    if (editing) {
      setDraft(value ?? '')
      setError(null)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
    }
  }, [editing, value])

  function commit() {
    const next = draft.trim()
    if (next === (value ?? '').trim()) { setEditing(false); return }
    setOptimistic(next)
    setEditing(false)
    setPending(true)
    onSave(next)
      .then(res => {
        if (!res.ok) { setOptimistic(null); setError(res.error ?? 'Error al guardar.') }
        else         { router.refresh() }
      })
      .finally(() => setPending(false))
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setError(null) }
        }}
        onBlur={commit}
        className="w-full h-7 px-2 text-[13px] border border-info rounded bg-paper outline-none text-ink"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click para editar"
      className={`text-left rounded px-1 -mx-1 hover:bg-info/10 transition-colors ${pending ? 'opacity-60' : ''} ${displayClassName ?? 'text-ink'}`}
    >
      {shown && shown.trim() !== '' ? shown : <span className="text-slate">{emptyLabel}</span>}
      {error && <span className="block text-[9px] text-danger" title={error}>{error}</span>}
    </button>
  )
}
