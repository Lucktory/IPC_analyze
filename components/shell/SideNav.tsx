'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getSection } from '@/lib/sections'

interface NavItem {
  to: string
  label: string
  icon: 'dashboard' | 'contracts' | 'tenants' | 'owners' | 'properties' | 'payments' | 'banks' | 'reconcile' | 'sheet' | 'bell' | 'funnel' | 'shield' | 'help'
}

const mainItems: NavItem[] = [
  // Liquidación first — the encargada's daily work starts here (Alejandro's
  // direction 2026-06-15). The other views are secondary.
  { to: '/liquidacion',  label: 'Liquidación',   icon: 'funnel'     },
  { to: '/pendientes',   label: 'Pendientes',    icon: 'bell'       },
  { to: '/diagnostico',  label: 'Diagnóstico',   icon: 'shield'     },
  { to: '/dashboard',    label: 'Panel',         icon: 'dashboard'  },
  { to: '/contratos',    label: 'Contratos',     icon: 'contracts'  },
  { to: '/propietarios', label: 'Propietarios',  icon: 'owners'     },
  { to: '/inquilinos',   label: 'Inquilinos',    icon: 'tenants'    },
  { to: '/propiedades',  label: 'Propiedades',   icon: 'properties' },
  { to: '/movimientos',  label: 'Movimientos',   icon: 'payments'   },
  { to: '/bancos',       label: 'Bancos',        icon: 'banks'      },
  { to: '/conciliacion', label: 'Conciliación',  icon: 'reconcile'  },
  { to: '/ayuda',        label: 'Ayuda',         icon: 'help'       },
]

function NavIcon({ name }: { name: NavItem['icon'] }) {
  const common = {
    viewBox: '0 0 20 20',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    className: 'w-full h-full',
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="15" height="15" rx="1.5" />
          <path d="M2.5 8 H17.5" />
          <path d="M2.5 13 H17.5" />
          <path d="M8 2.5 V17.5" />
          <path d="M13 2.5 V17.5" />
        </svg>
      )
    case 'contracts':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M5 3 H12 L15.5 6.5 V16 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 Z" />
          <path d="M12 3 V6.5 H15.5" />
          <path d="M6.5 9.5 H13" />
          <path d="M6.5 12 H13" />
          <path d="M6.5 14.5 H10.5" />
        </svg>
      )
    case 'tenants':
      return (
        <svg {...common} strokeLinejoin="round">
          <circle cx="7" cy="8" r="2.2" />
          <circle cx="13" cy="8" r="2.2" />
          <path d="M2.5 16 Q2.5 12 7 12 Q11.5 12 11.5 16" />
          <path d="M8.5 16 Q8.5 12 13 12 Q17.5 12 17.5 16" />
        </svg>
      )
    case 'owners':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 17 V8 L10 4 L17 8 V17 Z" />
          <path d="M3 17 H17" />
          <rect x="8.5" y="13" width="3" height="4" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M5.5 9.5 H7.5 V11.5 H5.5 Z" />
          <path d="M12.5 9.5 H14.5 V11.5 H12.5 Z" />
        </svg>
      )
    case 'payments':
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
          <circle cx="10" cy="10" r="2.2" />
        </svg>
      )
    case 'properties':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 9 L10 3 L17 9 V17 H3 Z" />
          <path d="M8 17 V12 H12 V17" />
        </svg>
      )
    case 'banks':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 8 L10 4 L17 8" />
          <path d="M5 8 V14" />
          <path d="M9 8 V14" />
          <path d="M11 8 V14" />
          <path d="M15 8 V14" />
          <path d="M3 16 H17" />
        </svg>
      )
    case 'reconcile':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M4 6 H13 L16 9 L13 12 H4" />
          <path d="M16 14 H7 L4 17 L7 20" />
        </svg>
      )
    case 'sheet':
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="2.5" y="3" width="15" height="14" rx="1" />
          <path d="M2.5 7 H17.5" />
          <path d="M2.5 11 H17.5" />
          <path d="M2.5 15 H17.5" />
          <path d="M7 3 V17" />
          <path d="M12 3 V17" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M5 9 a5 5 0 0 1 10 0 v3 l1.5 2 H3.5 L5 12 Z" />
          <path d="M8 15 a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'funnel':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M2.5 3 H17.5 L12 10 V16 L8 17.5 V10 Z" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M10 2.5 L16 4.5 V10 a6 6 0 0 1 -6 6 a6 6 0 0 1 -6 -6 V4.5 Z" />
          <path d="M7 10 L9.5 12 L13 8" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common} strokeLinejoin="round">
          <circle cx="10" cy="10" r="7.5" />
          <path d="M7.8 8 a2.3 2.3 0 1 1 3.2 2.1 c-0.7 0.3 -1 0.8 -1 1.5" />
          <circle cx="10" cy="14" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}

interface SideNavProps {
  onNavigate?:         () => void
  userEmail?:          string | null
  /** Desktop icons-only mode. Mobile drawer always renders full labels. */
  collapsed?:          boolean
  /** Toggle collapsed state — only effective on lg+ screens. */
  onToggleCollapsed?:  () => void
}

export function SideNav({
  onNavigate,
  userEmail,
  collapsed = false,
  onToggleCollapsed,
}: SideNavProps = {}) {
  const pathname = usePathname()
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/')

  // Display name: prefer the local-part of the email; fall back to "Sesión activa".
  const displayName = userEmail
    ? userEmail.split('@')[0]
    : 'Sesión activa'
  const initial = displayName.charAt(0).toUpperCase() || 'P'

  // Collapsed mode is a desktop-only concern (mobile = full drawer). Tailwind
  // responsive classes hide the labels at lg+ when collapsed.
  const hideAtCollapsed = collapsed ? 'lg:hidden' : ''

  return (
    <>
      <div className={`h-[68px] flex items-center gap-2.5 border-b border-nav-text/10 ${collapsed ? 'lg:justify-center lg:px-2 px-5' : 'px-5'}`}>
        <span className="shrink-0 text-info">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <path d="M5 28 V13.5 L16 5 L27 13.5 V28 Z" />
            <path d="M11.5 28 V19 H20.5 V28" />
          </svg>
        </span>
        <div className={`flex-col leading-none min-w-0 flex ${hideAtCollapsed}`}>
          <span className="font-display font-semibold text-[19px] text-nav-text tracking-tight truncate">
            Pampa
          </span>
          <span className="text-[10px] text-nav-text/50 uppercase tracking-[0.2em] mt-1">
            Administración
          </span>
        </div>
      </div>

      <nav className={`flex-1 pt-4 pb-4 overflow-y-auto overflow-x-hidden ${collapsed ? 'lg:px-2 px-3' : 'px-3'}`}>
        <ul className="space-y-1">
          {mainItems.map((item) => {
            const active = isActive(item.to)
            const section = getSection(item.to)
            return (
              <li key={item.to}>
                <Link
                  href={item.to}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  // Active item = bold FILLED pill in the section's colour (keeps
                  // the app's per-section identity while adopting the reference's
                  // solid-pill look). White text/icon reads on every section hue,
                  // in both light and dark.
                  style={active ? { backgroundColor: section.color } : undefined}
                  className={[
                    'flex items-center gap-3.5 py-2.5 rounded-lg text-[15px] font-medium transition-colors',
                    collapsed ? 'lg:justify-center lg:px-2 px-3' : 'px-3',
                    active
                      ? 'text-white shadow-sm'
                      : 'text-nav-text/60 hover:bg-nav-text/[0.05] hover:text-nav-text',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-[22px] h-[22px] shrink-0 flex items-center justify-center transition-colors',
                      active ? 'text-white' : 'text-nav-text/45',
                    ].join(' ')}
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span className={hideAtCollapsed}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <p className={`px-3 pt-6 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-nav-text/40 ${hideAtCollapsed}`}>
          Configuración
        </p>
        <ul className="space-y-1">
          <li>
            <span
              title={collapsed ? 'Usuarios' : undefined}
              className={`flex items-center gap-3.5 py-2.5 rounded-lg text-[15px] font-medium text-nav-text/35 cursor-not-allowed select-none ${collapsed ? 'lg:justify-center lg:px-2 px-3' : 'px-3'}`}
            >
              <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-full h-full">
                  <circle cx="10" cy="7.5" r="3" />
                  <path d="M3 17 Q3 12 10 12 Q17 12 17 17" />
                </svg>
              </span>
              <span className={hideAtCollapsed}>Usuarios</span>
            </span>
          </li>
          <li>
            <span
              title={collapsed ? 'Reglas IPC' : undefined}
              className={`flex items-center gap-3.5 py-2.5 rounded-lg text-[15px] font-medium text-nav-text/35 cursor-not-allowed select-none ${collapsed ? 'lg:justify-center lg:px-2 px-3' : 'px-3'}`}
            >
              <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <circle cx="10" cy="10" r="6" />
                  <path d="M10 7 V10 L12 11.5" />
                </svg>
              </span>
              <span className={hideAtCollapsed}>Reglas IPC</span>
            </span>
          </li>
        </ul>
      </nav>

      {/* Collapse toggle — desktop only, sits just above the footer. */}
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="hidden lg:flex items-center justify-center gap-2 mx-3 mb-2 py-1.5 rounded text-[11px] font-medium text-nav-text/50 hover:text-nav-text hover:bg-nav-text/[0.06] transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            {collapsed
              ? <polyline points="7 4 13 10 7 16" />
              : <polyline points="13 4 7 10 13 16" />}
          </svg>
          <span className={hideAtCollapsed}>Colapsar</span>
        </button>
      )}

      <div className={`border-t border-nav-text/10 py-3 flex items-center gap-3 ${collapsed ? 'lg:justify-center lg:px-2 px-5' : 'px-5'}`}>
        <div className="h-9 w-9 rounded-full bg-info/15 flex items-center justify-center font-display font-semibold text-info text-[14px] shrink-0">
          {initial}
        </div>
        <div className={`flex-col leading-tight min-w-0 flex ${hideAtCollapsed}`}>
          <span className="font-medium text-[14px] text-nav-text truncate">{displayName}</span>
          <span className="text-[11px] text-nav-text/50 truncate">Sesión activa</span>
        </div>
      </div>
    </>
  )
}
