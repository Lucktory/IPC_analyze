'use client'

import { Bell, Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSection, getBreadcrumbSuffix } from '@/lib/sections'
import { useBreadcrumbTitle } from './BreadcrumbContext'

interface TopBarProps {
  pendientes?:  number
  userInitials?: string
  userName?:    string
  userRole?:    string
  onMenuClick?: () => void
}

export function TopBar({
  pendientes   = 0,
  userInitials = 'AH',
  userName     = 'Alejandro H.',
  userRole     = 'Admin',
  onMenuClick,
}: TopBarProps) {
  const pathname  = usePathname()
  const section   = getSection(pathname)
  const fallbackSuffix = getBreadcrumbSuffix(pathname)
  const entityName = useBreadcrumbTitle()
  const subsection = entityName ?? fallbackSuffix
  const onDetailPage = !!fallbackSuffix

  return (
    <header className="h-14 bg-paper border-b border-line flex items-stretch px-3 sm:px-6 gap-2 sm:gap-4">
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="lg:hidden -ml-1 my-2 p-2 rounded text-slate-dark hover:text-ink hover:bg-cream-2 transition-colors self-center"
        >
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
      )}

      {/* Section identifier — left color stripe + title link + breadcrumb */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        {/* 3px color stripe — the "you are here" visual cue */}
        <span
          aria-hidden
          className="block w-[3px] self-stretch my-3 rounded-full shrink-0"
          style={{ backgroundColor: section.color }}
        />
        <div className="flex items-baseline gap-2 min-w-0">
          {/* Section name is now a link back to the section index */}
          <Link
            href={section.path}
            className={[
              'font-display font-semibold uppercase tracking-tight text-[13px] sm:text-[15px] truncate transition-colors',
              onDetailPage
                ? 'text-slate-dark hover:text-ink'
                : 'text-ink',
            ].join(' ')}
            title={`Ir a ${section.label}`}
          >
            {section.label}
          </Link>
          {subsection && (
            <>
              <span className="text-slate text-[12px] shrink-0" aria-hidden>›</span>
              <span className="text-[12px] sm:text-[13px] text-ink font-medium truncate">{subsection}</span>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        className="relative h-9 px-2 sm:px-3 rounded inline-flex items-center gap-1.5 sm:gap-2 text-slate-dark hover:bg-cream-2 transition-colors group self-center"
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

      <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-line self-center">
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
