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
 * Text input that mirrors its value into a URL search param with a debounce.
 *
 * Two non-obvious things this component has to get right:
 *
 *   1. router.replace({ scroll: false }) — without scroll:false, every
 *      keystroke jumps the page back to the top, which is bizarre while
 *      typing in a search box.
 *
 *   2. `committed` ref — useSearchParams() returns a fresh object after each
 *      navigation, so a naive effect that depends on `params` will re-run
 *      after every navigation and re-fire the timer with the same value,
 *      navigating again forever. We compare `value` to the last value we
 *      pushed to the URL and skip the timer when they match.
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
  const committed = useRef(initialValue)

  useEffect(() => {
    if (value === committed.current) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(paramName, value)
      else       next.delete(paramName)
      for (const k of resetParams) next.delete(k)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      committed.current = value
    }, debounceMs)
    return () => clearTimeout(t)
  }, [value, params, paramName, debounceMs, pathname, router, resetParams])

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors w-full"
    />
  )
}
