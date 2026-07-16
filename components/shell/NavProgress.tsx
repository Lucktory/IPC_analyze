'use client'

// ============================================================================
// NavProgress — the thin blue loading line under the topbar.
//
// Built ONCE and rendered globally in the app shell, so every page gets it:
//   • Sidebar links start it (wired once in SideNav).
//   • Pages that navigate themselves (filters / search) call the shared
//     navigate() from useProgressRouter() instead of router.push().
//
// It finishes automatically when the new route (pathname OR search params)
// actually renders — which is exactly when the server data has arrived.
//
// Details that matter:
//   • 120ms delay before showing, so instant/cached navigations don't flash.
//   • Creeps toward 90% while waiting, then snaps to 100% and fades out.
//   • Failsafe timeout so the bar can never get stuck on screen.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

interface NavProgressValue {
  start:    () => void
  done:     () => void
  visible:  boolean
  progress: number
}

const NavProgressCtx = createContext<NavProgressValue>({
  start: () => {}, done: () => {}, visible: false, progress: 0,
})

export function useNavProgress() {
  return useContext(NavProgressCtx)
}

/** The shared navigator: starts the bar, then pushes. Use this instead of
 *  router.push() on any page that fetches by changing the URL. */
export function useProgressRouter() {
  const router = useRouter()
  const { start } = useNavProgress()
  const navigate = useCallback((url: string) => {
    start()
    router.push(url)
  }, [router, start])
  return { navigate }
}

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible]   = useState(false)
  const [progress, setProgress] = useState(0)

  const delayRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creepRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  const pathname  = usePathname()
  const search    = useSearchParams()
  const searchKey = search.toString()

  const clearTimers = useCallback(() => {
    if (delayRef.current)    { clearTimeout(delayRef.current);    delayRef.current = null }
    if (creepRef.current)    { clearInterval(creepRef.current);   creepRef.current = null }
    if (hideRef.current)     { clearTimeout(hideRef.current);     hideRef.current = null }
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null }
  }, [])

  const done = useCallback(() => {
    clearTimers()
    setProgress(100)
    hideRef.current = setTimeout(() => { setVisible(false); setProgress(0) }, 220)
  }, [clearTimers])

  const start = useCallback(() => {
    clearTimers()
    setProgress(0)
    // Only reveal if the wait is actually noticeable — avoids a flash.
    delayRef.current = setTimeout(() => {
      setVisible(true)
      setProgress(15)
      creepRef.current = setInterval(() => {
        setProgress(p => (p >= 90 ? 90 : p + Math.max(0.4, (90 - p) * 0.07)))
      }, 180)
    }, 120)
    // Never let it hang around if a navigation never commits.
    failsafeRef.current = setTimeout(() => done(), 10000)
  }, [clearTimers, done])

  // The route committed (path or query changed) => the data is here.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    done()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchKey])

  useEffect(() => () => clearTimers(), [clearTimers])

  const value = useMemo(() => ({ start, done, visible, progress }), [start, done, visible, progress])
  return <NavProgressCtx.Provider value={value}>{children}</NavProgressCtx.Provider>
}

/** The line itself. Rendered once, right under the TopBar. Overlays (h-0) so it
 *  never shifts the layout. */
export function NavProgressBar() {
  const { visible, progress } = useNavProgress()
  return (
    <div className="relative h-0 z-40 print:hidden" aria-hidden>
      <div
        className="absolute top-0 left-0 h-[3px] bg-info rounded-r-full transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          boxShadow: '0 0 8px rgb(var(--color-info) / 0.7)',
        }}
      />
    </div>
  )
}
