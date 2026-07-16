'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { useProgressRouter } from '@/components/shell/NavProgress'
import { Search, X } from 'lucide-react'

interface TokenSearchInputProps {
  /** Space-joined tokens from the URL (e.g. "perez c-2024"). */
  initialValue: string
  placeholder?: string
  /** URL search param to bind to. Default: 'q'. */
  paramName?:   string
  /** Debounce window before navigating. Default: 300ms. */
  debounceMs?:  number
}

/**
 * Multi-condition search: each term the user types becomes a removable chip.
 * A row matches only when EVERY chip is found (AND) — the page does the
 * actual matching from the `?q=` param this component maintains.
 *
 * Behaviour:
 *   - Space / Enter commits the current text as a chip.
 *   - Backspace on an empty field removes the last chip.
 *   - Clicking a chip's x removes it. Duplicates are ignored.
 *   - The still-uncommitted text ALSO filters live, so a single term behaves
 *     exactly like the old one-box search (no need to press space first).
 *
 * Like AutoSearchInput, it navigates through useProgressRouter so the global
 * loading bar fires automatically, and it uses replace + scroll:false so the
 * page doesn't jump while typing.
 */
export function TokenSearchInput({
  initialValue,
  placeholder,
  paramName  = 'q',
  debounceMs = 300,
}: TokenSearchInputProps) {
  const { navigate } = useProgressRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const parse = (s: string) => s.split(/\s+/).map(t => t.trim()).filter(Boolean)

  const [tokens, setTokens] = useState<string[]>(() => parse(initialValue))
  const [draft,  setDraft]  = useState('')
  // Last value we pushed to the URL — guards the effect from re-firing after
  // its own navigation (useSearchParams returns a fresh object each time).
  const committed = useRef(parse(initialValue).join(' '))

  // Sync (chips + live draft) -> URL, debounced.
  useEffect(() => {
    const effective = [...tokens, draft.trim()].filter(Boolean).join(' ')
    if (effective === committed.current) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (effective) next.set(paramName, effective)
      else           next.delete(paramName)
      const qs = next.toString()
      navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true, scroll: false })
      committed.current = effective
    }, debounceMs)
    return () => clearTimeout(t)
  }, [tokens, draft, params, paramName, debounceMs, pathname, navigate])

  function addToken(raw: string) {
    const v = raw.trim()
    if (!v) return
    setTokens(prev =>
      prev.some(t => t.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v],
    )
  }

  function removeToken(i: number) {
    setTokens(prev => prev.filter((_, idx) => idx !== i))
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    // Any whitespace (typed space or a paste) commits the completed terms and
    // keeps the trailing partial in the draft.
    if (/\s/.test(val)) {
      const parts = val.split(/\s+/)
      const last  = parts.pop() ?? ''
      parts.filter(Boolean).forEach(addToken)
      setDraft(last)
    } else {
      setDraft(val)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (draft.trim()) { addToken(draft); setDraft('') }
    } else if (e.key === 'Backspace' && !draft && tokens.length) {
      e.preventDefault()
      removeToken(tokens.length - 1)
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      title="Separa con espacios para filtrar por varias condiciones (propietario, inquilino, contrato)"
      className="flex flex-wrap items-center gap-1 min-h-9 px-2 py-1 rounded border border-line bg-cream focus-within:border-ink focus-within:bg-paper transition-colors cursor-text"
    >
      <Search size={13} className="text-slate shrink-0" />
      {tokens.map((tok, i) => (
        <span
          key={`${tok}-${i}`}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-info/10 text-info text-[11px] font-medium max-w-[140px]"
        >
          <span className="truncate">{tok}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeToken(i) }}
            aria-label={`Quitar ${tok}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-info/80 hover:bg-info/20 hover:text-info shrink-0"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoComplete="off"
        placeholder={tokens.length ? 'Agregar...' : placeholder}
        className="flex-1 min-w-[70px] bg-transparent outline-none text-[13px] text-ink placeholder:text-slate"
      />
    </div>
  )
}
