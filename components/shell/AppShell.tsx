'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { BreadcrumbProvider } from './BreadcrumbContext'

interface AppShellProps {
  children:      React.ReactNode
  userEmail:     string | null
  pendingCount?: number
}

// localStorage key for the desktop sidenav collapsed state. We avoid SSR
// hydration mismatches by reading lazily on mount, not during render.
const COLLAPSED_KEY = 'sidenav.collapsed'

// Routes that opt out of the centered max-w-shell layout and use the full
// viewport width. Currently just the planilla — its 19 cols don't fit in
// the standard shell. Detail pages (e.g. /liquidacion/[id]) stay centered.
function isWideRoute(pathname: string): boolean {
  return pathname === '/liquidacion'
}

export function AppShell({ children, userEmail, pendingCount = 0 }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Restore collapsed state on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY)
      if (stored === '1') setCollapsed(true)
    } catch { /* ignore — quota or disabled storage */ }
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      try { window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  // Lock body scroll when drawer is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  return (
    <BreadcrumbProvider>
    <div className="flex h-screen w-screen overflow-hidden bg-cream">
      {/* Sidebar: relative position on lg+, fixed drawer below. */}
      <aside
        className={[
          'fixed lg:relative inset-y-0 left-0 z-50 print:hidden',
          'shrink-0 bg-nav-bg text-nav-text flex flex-col',
          'transition-[transform,width] duration-200 ease-out',
          // Width: full drawer on mobile, configurable on lg+.
          collapsed ? 'w-[240px] lg:w-[64px]' : 'w-[240px]',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <SideNav
          onNavigate={() => setOpen(false)}
          userEmail={userEmail}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* Backdrop only visible on small screens when drawer is open. */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px]"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <TopBar pendientes={pendingCount} userEmail={userEmail} onMenuClick={() => setOpen(true)} />
        </div>
        <main className="flex-1 overflow-auto bg-watermark print:overflow-visible print:bg-paper">
          {/* /liquidacion is a planilla page — it needs the full viewport
              width to fit the 19-column grid without horizontal scrolling
              eating into wasted gutters. Every other page keeps the
              centered max-w-shell + comfortable padding. */}
          <div className={isWideRoute(pathname)
            ? 'w-full px-2 py-2 print:px-0 print:py-0'
            : 'max-w-shell mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 print:max-w-none print:px-0 print:py-0'}>
            {children}
          </div>
        </main>
      </div>
    </div>
    </BreadcrumbProvider>
  )
}
