'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

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
    <div className="flex h-screen w-screen overflow-hidden bg-cream">
      {/* Sidebar: relative position on lg+, fixed drawer below. */}
      <aside
        className={[
          'fixed lg:relative inset-y-0 left-0 z-50',
          'w-[240px] shrink-0 bg-ink text-paper flex flex-col',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <SideNav onNavigate={() => setOpen(false)} />
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
        <TopBar pendientes={3} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
