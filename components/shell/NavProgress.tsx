'use client'

// ============================================================================
// NavProgress — the thin blue "something is happening" line under the topbar.
//
// Built ONCE, rendered globally in the app shell, and covers BOTH kinds of work
// through a reference-counted busy state (visible while count > 0):
//
//   1. NAVIGATION — a global capture-phase click listener catches every
//      internal <a>/<Link> click (so all 48 link surfaces are covered with no
//      per-page code), plus back/forward (popstate) and the shared navigate()
//      used by programmatic pushes. Navigation ends when the route (pathname
//      or query) actually commits.
//
//   2. MUTATIONS — useBusyTransition() is a drop-in for useTransition() that
//      reports its pending state to the bar, so every save/edit/delete shows it.
//
// Extras: 120ms delay so cached/instant work never flashes; creeps to ~90%
// while waiting; failsafe so a navigation that never commits can't get stuck.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

interface NavProgressValue {
  startNav: () => void
  begin:    () => void
  end:      () => void
  visible:  boolean
  progress: number
}

const NavProgressCtx = createContext<NavProgressValue>({
  startNav: () => {}, begin: () => {}, end: () => {}, visible: false, progress: 0,
})

export function useNavProgress() {
  return useContext(NavProgressCtx)
}

/** Shared navigator for pages that fetch by changing the URL programmatically.
 *  Use instead of router.push()/replace() so the loading line shows. */
export function useProgressRouter() {
  const router = useRouter()
  const { startNav } = useNavProgress()
  const navigate = useCallback((url: string, opts?: { replace?: boolean; scroll?: boolean }) => {
    startNav()
    if (opts?.replace) router.replace(url, { scroll: opts.scroll })
    else router.push(url, { scroll: opts?.scroll })
  }, [router, startNav])
  return { navigate }
}

/** Drop-in replacement for React's useTransition that also drives the loading
 *  line. Swap `useTransition()` -> `useBusyTransition()` and nothing else. */
export function useBusyTransition(): [boolean, React.TransitionStartFunction] {
  const [pending, startTransition] = useTransition()
  const { begin, end } = useNavProgress()
  const activeRef = useRef(false)
  useEffect(() => {
    if (pending && !activeRef.current) { activeRef.current = true; begin() }
    else if (!pending && activeRef.current) { activeRef.current = false; end() }
  }, [pending, begin, end])
  useEffect(() => () => { if (activeRef.current) { activeRef.current = false; end() } }, [end])
  return [pending, startTransition]
}

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [navPending, setNavPending] = useState(false)
  const [busyCount, setBusyCount]   = useState(0)
  const [visible, setVisible]       = useState(false)
  const [progress, setProgress]     = useState(0)

  const active = navPending || busyCount > 0

  const delayRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creepRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navFailsafe = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleRef  = useRef(false)
  const wasActive   = useRef(false)
  const first       = useRef(true)

  const pathname  = usePathname()
  const search    = useSearchParams()
  const searchKey = search.toString()

  const startCreep = useCallback(() => {
    if (creepRef.current) return
    creepRef.current = setInterval(() => {
      setProgress(p => (p >= 90 ? 90 : p + Math.max(0.5, (90 - p) * 0.06)))
    }, 170)
  }, [])
  const stopCreep = useCallback(() => {
    if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null }
  }, [])

  const showNow = useCallback(() => {
    delayRef.current = null
    visibleRef.current = true
    setVisible(true); setProgress(12)
    startCreep()
  }, [startCreep])

  const finishNow = useCallback(() => {
    stopCreep()
    setProgress(100)
    hideRef.current = setTimeout(() => { visibleRef.current = false; setVisible(false); setProgress(0) }, 220)
  }, [stopCreep])

  // React to the busy state going active / idle.
  useEffect(() => {
    if (active && !wasActive.current) {
      wasActive.current = true
      if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null }
      if (visibleRef.current) startCreep()                // was fading -> resume
      else if (!delayRef.current) delayRef.current = setTimeout(showNow, 120)
    } else if (!active && wasActive.current) {
      wasActive.current = false
      if (delayRef.current) { clearTimeout(delayRef.current); delayRef.current = null }  // never showed
      if (visibleRef.current) finishNow()
      else stopCreep()
    }
  }, [active, showNow, finishNow, startCreep, stopCreep])

  const startNav = useCallback(() => {
    setNavPending(true)
    if (navFailsafe.current) clearTimeout(navFailsafe.current)
    navFailsafe.current = setTimeout(() => setNavPending(false), 10000)
  }, [])
  const begin = useCallback(() => setBusyCount(c => c + 1), [])
  const end   = useCallback(() => setBusyCount(c => Math.max(0, c - 1)), [])

  // The route committed (path or query changed) => navigation finished.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setNavPending(false)
    if (navFailsafe.current) { clearTimeout(navFailsafe.current); navFailsafe.current = null }
  }, [pathname, searchKey])

  // Cover every internal link + back/forward without per-page wiring.
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
      let el = ev.target as HTMLElement | null
      while (el && el.tagName !== 'A') el = el.parentElement
      const a = el as HTMLAnchorElement | null
      if (!a) return
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      let url: URL
      try { url = new URL(a.href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      startNav()
    }
    function onPop() { startNav() }
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop)
    }
  }, [startNav])

  // Unmount cleanup.
  useEffect(() => () => {
    for (const r of [delayRef, hideRef, navFailsafe]) if (r.current) clearTimeout(r.current)
    if (creepRef.current) clearInterval(creepRef.current)
  }, [])

  const value = useMemo(() => ({ startNav, begin, end, visible, progress }), [startNav, begin, end, visible, progress])
  return <NavProgressCtx.Provider value={value}>{children}</NavProgressCtx.Provider>
}

/** The line itself — 0-height overlay right under the TopBar (never shifts layout). */
export function NavProgressBar() {
  const { visible, progress } = useNavProgress()
  return (
    <div className="relative h-0 z-40 print:hidden" aria-hidden>
      <div
        className="absolute top-0 left-0 h-[3px] bg-info rounded-r-full transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0, boxShadow: '0 0 8px rgb(var(--color-info) / 0.7)' }}
      />
    </div>
  )
}
