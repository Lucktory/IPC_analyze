'use client'

import { Search, Bell, Menu } from 'lucide-react'

interface TopBarProps {
  pendientes?: number
  userInitials?: string
  userName?: string
  userRole?: string
  onMenuClick?: () => void
}

export function TopBar({
  pendientes = 0,
  userInitials = 'AH',
  userName = 'Alejandro H.',
  userRole = 'Admin',
  onMenuClick,
}: TopBarProps) {
  return (
    <header className="h-14 bg-paper border-b border-line flex items-center px-3 sm:px-6 gap-2 sm:gap-4">
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="lg:hidden -ml-1 p-2 rounded text-slate-dark hover:text-ink hover:bg-cream-2 transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
      )}

      {/* Search — hidden under sm */}
      <div className="hidden sm:block flex-1 max-w-md relative">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate"
          strokeWidth={1.5}
        />
        <input
          type="search"
          name="global-search"
          autoComplete="off"
          placeholder="Buscar contratos, inquilinos, propietarios..."
          className="w-full h-9 pl-9 pr-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
        />
      </div>

      {/* Spacer for mobile to push right-side elements */}
      <div className="flex-1 sm:hidden" />

      <button
        type="button"
        className="relative h-9 px-2 sm:px-3 rounded inline-flex items-center gap-1.5 sm:gap-2 text-slate-dark hover:bg-cream-2 transition-colors group"
        title={`${pendientes} acciones pendientes`}
      >
        <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <span className="hidden sm:inline text-[12px] font-medium text-slate-dark group-hover:text-ink transition-colors">
          Pendientes
        </span>
        {pendientes > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-paper text-[10px] font-semibold leading-[18px] text-center tabular-nums">
            {pendientes}
          </span>
        )}
      </button>

      <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-line">
        <div className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center font-display font-semibold text-[12px]">
          {userInitials}
        </div>
        <div className="hidden md:flex flex-col leading-tight">
          <span className="text-[13px] font-medium text-ink">{userName}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate">{userRole}</span>
        </div>
      </div>
    </header>
  )
}
