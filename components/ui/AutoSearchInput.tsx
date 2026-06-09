'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface AutoSearchInputProps {
  initialValue:  string
  placeholder?:  string
  paramName?:    string   // URL search param to bind to. Default: 'q'
  debounceMs?:   number   // Debounce window. Default: 300ms
  resetParams?:  string[] // Params to drop on every change (e.g. ['page'])
}

/**
 * Text input that mirrors its value into a URL search param with a debounce —
 * removes the need for a Filtrar button. Replaces (not pushes) history so
 * back/forward stays clean.
 */
export function AutoSearchInput({
  initialValue,
  placeholder,
  paramName   = 'q',
  debounceMs  = 300,
  resetParams = [],
}: AutoSearchInputProps) {
  const router    = useRouter()
  const pathname  = usePathname()
  const params    = useSearchParams()
  const [value, setValue] = useState(initialValue)
  // Track whether the user has typed since mount — avoids firing a navigation
  // on initial render that would loop with the parent re-rendering.
  const dirty = useRef(false)

  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(paramName, value)
      else       next.delete(paramName)
      for (const k of resetParams) next.delete(k)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }, debounceMs)
    return () => clearTimeout(t)
  }, [value, params, paramName, debounceMs, pathname, router, resetParams])

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => { dirty.current = true; setValue(e.target.value) }}
      placeholder={placeholder}
      className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors w-full"
    />
  )
}
