'use client'

// ============================================================================
// ThemeToggle — three-state button (light → dark → system → light) that
// lives in the TopBar. Icon reflects the current *resolved* theme so the
// user can see what's active at a glance.
// ============================================================================

import { useTheme, type ThemePreference } from '@/lib/theme'

const NEXT: Record<ThemePreference, ThemePreference> = {
  light:  'dark',
  dark:   'system',
  system: 'light',
}

const PREF_LABEL: Record<ThemePreference, string> = {
  light:  'Tema: claro · tocá para cambiar a oscuro',
  dark:   'Tema: oscuro · tocá para usar el sistema',
  system: 'Tema: sistema · tocá para cambiar a claro',
}

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[preference])}
      title={PREF_LABEL[preference]}
      aria-label={PREF_LABEL[preference]}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-slate-dark hover:bg-cream-2 hover:text-ink transition-colors"
    >
      {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
      {preference === 'system' && <SystemDot />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

/** Small indicator below the icon when preference === 'system'. */
function SystemDot() {
  return (
    <span
      aria-hidden
      className="absolute mt-[26px] w-1 h-1 rounded-full bg-slate"
      style={{ pointerEvents: 'none' }}
    />
  )
}
