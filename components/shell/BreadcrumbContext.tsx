'use client'

// Per-route breadcrumb suffix. Detail pages (e.g. /contratos/[id]) mount a
// <BreadcrumbTitle name="..."/> at render time; the TopBar reads the value
// via useBreadcrumbTitle() and shows it after the section name.
//
// Effectively a tiny "currently-viewed entity" register that doesn't need a
// router refactor or per-route metadata plumbing.

import { createContext, useContext, useEffect, useState } from 'react'

const BreadcrumbContext = createContext<{
  title: string | null
  setTitle: (t: string | null) => void
}>({
  title: null,
  setTitle: () => {},
})

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  return (
    <BreadcrumbContext.Provider value={{ title, setTitle }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbTitle() {
  return useContext(BreadcrumbContext).title
}

/**
 * Drop into a detail page (server or client) — it mounts a tiny client
 * component that writes the title into context for the TopBar.
 */
export function BreadcrumbTitle({ name }: { name: string }) {
  return <BreadcrumbTitleSetter name={name} />
}

function BreadcrumbTitleSetter({ name }: { name: string }) {
  const { setTitle } = useContext(BreadcrumbContext)
  useEffect(() => {
    setTitle(name)
    return () => setTitle(null)
  }, [name, setTitle])
  return null
}
