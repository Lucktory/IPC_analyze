'use client'

// ============================================================================
// Theme provider — light / dark / system preference, persisted to localStorage.
//
// The actual class swap on <html data-theme="..."> happens via:
//   1. An inline script in <head> that reads localStorage BEFORE React
//      mounts, so the page paints in the right theme on first frame.
//      (See FOUC_PREVENTION_SCRIPT below.)
//   2. This provider, which keeps the React state in sync with the
//      document attribute and reacts to user toggles + OS-level changes.
//
// Components read the current theme via useTheme().
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ThemeResolved   = 'light' | 'dark'

interface ThemeContextValue {
  /** User's stored preference. Persists across sessions. */
  preference:    ThemePreference
  /** What's actually rendered right now. `system` collapses to light or dark. */
  resolved:      ThemeResolved
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'ipc-theme'

function resolvePreference(pref: ThemePreference): ThemeResolved {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

function applyToDocument(theme: ThemeResolved) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial state matches what the FOUC script set. We can't read from React
  // during SSR, so we start with 'system' as the assumed pref + light fallback,
  // then sync on mount.
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [resolved,   setResolved]         = useState<ThemeResolved>('light')

  // On mount: hydrate from localStorage + document state.
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? 'system'
    setPreferenceState(stored)
    const resolved = resolvePreference(stored)
    setResolved(resolved)
    applyToDocument(resolved)
  }, [])

  // Listen for OS-level dark-mode changes when the user is on 'system'.
  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const next: ThemeResolved = mq.matches ? 'dark' : 'light'
      setResolved(next)
      applyToDocument(next)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  function setPreference(p: ThemePreference) {
    setPreferenceState(p)
    if (p === 'system') localStorage.removeItem(STORAGE_KEY)
    else                localStorage.setItem(STORAGE_KEY, p)
    const next = resolvePreference(p)
    setResolved(next)
    applyToDocument(next)
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback for SSR or components rendered outside the provider — they
    // get light theme without breaking. Should only happen during initial paint.
    return {
      preference: 'system',
      resolved:   'light',
      setPreference: () => {},
    }
  }
  return ctx
}

/**
 * Inline <script> string. Drop into the root layout's <head> via
 * dangerouslySetInnerHTML. Runs before React hydrates, sets the right
 * data-theme on <html> so the first paint matches the user's stored
 * preference and there's no flash.
 */
export const FOUC_PREVENTION_SCRIPT = `(function(){
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme;
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    } else {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`
