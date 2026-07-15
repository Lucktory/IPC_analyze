'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { BreadcrumbProvider } from './BreadcrumbContext'

interface AppShellProps {
  children:      React.ReactNode
  userEmail:     string | null
  userName?:     string | null
  userPhotoUrl?: string | null
  isSuperAdmin?: boolean
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

// Routes that fill the viewport height with NO page scroll (at lg+) — the
// content lays itself out to fit one screen at 1024x768 and up; internal areas
// (table body, detail columns) scroll instead of the page. The Panel dashboard
// plus the redesigned entity list + detail pages. Their /nuevo, /cargar-emails
// form sub-routes keep normal page scroll.
function isFullHeightRoute(pathname: string): boolean {
  // Dashboard, the contracts LIST (its detail is a dense working page that
  // scrolls), and the pendientes action queue.
  if (pathname === '/dashboard' || pathname === '/contratos' || pathname === '/pendientes') return true
  // Entity list + detail pages (but not their /nuevo, /cargar-emails forms).
  const m = pathname.match(/^\/(propietarios|inquilinos|propiedades)(?:\/([^/]+))?$/)
  if (!m) return false
  return !m[2] || !['nuevo', 'cargar-emails'].includes(m[2])
}

export function AppShell({ children, userEmail, userName = null, userPhotoUrl = null, isSuperAdmin = false, pendingCount = 0 }: AppShellProps) {
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
          userName={userName}
          userPhotoUrl={userPhotoUrl}
          isSuperAdmin={isSuperAdmin}
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
          <TopBar pendientes={pendingCount} userEmail={userEmail} userName={userName} userPhotoUrl={userPhotoUrl} onMenuClick={() => setOpen(true)} />
        </div>
        <main className={`flex-1 bg-watermark print:overflow-visible print:bg-paper ${
          isWideRoute(pathname) ? 'overflow-hidden'
          : isFullHeightRoute(pathname) ? 'overflow-auto lg:overflow-hidden'
          : 'overflow-auto'}`}>
          {/* /liquidacion is a planilla page — it needs the full viewport
              width AND height to fit the 19-column grid with the table
              being the only scrolling area. /dashboard is full-height at lg+
              (charts flex to one screen); below lg it falls back to a normal
              scrolling stack so the cards don't collapse on small screens.
              Every other page keeps the centered max-w-shell + comfortable
              padding (and uses page-level scrolling). */}
          <div className={
            isWideRoute(pathname)
              ? 'w-full h-full flex flex-col px-2 pt-2 pb-0 print:px-0 print:py-0'
            : isFullHeightRoute(pathname)
              ? 'w-full lg:h-full flex flex-col px-3 sm:px-5 lg:px-6 py-3 sm:py-4 print:px-0 print:py-0'
              : 'max-w-shell mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 print:max-w-none print:px-0 print:py-0'}>
            {children}
          </div>
        </main>
      </div>
    </div>
    </BreadcrumbProvider>
  )
}
