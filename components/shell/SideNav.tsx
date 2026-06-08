'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  to: string
  label: string
  icon: 'dashboard' | 'contracts' | 'tenants' | 'owners' | 'properties' | 'payments' | 'banks' | 'reconcile'
}

const mainItems: NavItem[] = [
  { to: '/dashboard',    label: 'Panel',         icon: 'dashboard'  },
  { to: '/contratos',    label: 'Contratos',     icon: 'contracts'  },
  { to: '/propietarios', label: 'Propietarios',  icon: 'owners'     },
  { to: '/inquilinos',   label: 'Inquilinos',    icon: 'tenants'    },
  { to: '/propiedades',  label: 'Propiedades',   icon: 'properties' },
  { to: '/movimientos',  label: 'Movimientos',   icon: 'payments'   },
  { to: '/bancos',       label: 'Bancos',        icon: 'banks'      },
  { to: '/conciliacion', label: 'Conciliación',  icon: 'reconcile'  },
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
  }
}

interface SideNavProps {
  onNavigate?: () => void
}

export function SideNav({ onNavigate }: SideNavProps = {}) {
  const pathname = usePathname()
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/')

  return (
    <>
      <div className="h-14 flex items-center gap-3 px-5 border-b border-paper/10">
        <div className="h-7 w-7 rounded bg-paper/10 flex items-center justify-center font-display font-semibold text-paper text-[14px] shrink-0">
          A
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display font-medium text-[15px] text-paper tracking-tight">
            Alejandro
          </span>
          <span className="text-[9px] text-paper/50 uppercase tracking-[0.18em] mt-0.5">
            Administración
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-4 pb-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {mainItems.map((item) => {
            const active = isActive(item.to)
            return (
              <li key={item.to}>
                <Link
                  href={item.to}
                  onClick={onNavigate}
                  className={[
                    'flex items-center gap-3 pl-3 pr-3 py-2 rounded text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-paper/[0.08] text-paper'
                      : 'text-paper/60 hover:bg-paper/[0.04] hover:text-paper',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-4 h-4 shrink-0 flex items-center justify-center transition-colors',
                      active ? 'text-paper' : 'text-paper/50',
                    ].join(' ')}
                  >
                    <NavIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <p className="px-3 pt-7 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-paper/40">
          Configuración
        </p>
        <ul className="space-y-0.5">
          <li>
            <span className="flex items-center gap-3 pl-3 pr-3 py-2 rounded text-[13px] font-medium text-paper/35 cursor-not-allowed select-none">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-4 h-4 shrink-0">
                <circle cx="10" cy="7.5" r="3" />
                <path d="M3 17 Q3 12 10 12 Q17 12 17 17" />
              </svg>
              <span>Usuarios</span>
            </span>
          </li>
          <li>
            <span className="flex items-center gap-3 pl-3 pr-3 py-2 rounded text-[13px] font-medium text-paper/35 cursor-not-allowed select-none">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                <circle cx="10" cy="10" r="6" />
                <path d="M10 7 V10 L12 11.5" />
              </svg>
              <span>Reglas IPC</span>
            </span>
          </li>
        </ul>
      </nav>

      <footer className="px-5 py-4 border-t border-paper/10 text-[10.5px] text-paper/45 leading-relaxed">
        <p className="text-paper/80 font-medium">Administración Alejandro</p>
        <p className="mt-0.5">Buenos Aires · Argentina</p>
        <p className="mt-2 text-paper/35 tabular-nums">v0.1.0</p>
      </footer>
    </>
  )
}
