// Section identity — the muted color + label for each top-level area of the app.
// Used by the TopBar (color stripe + page title) and the SideNav (active icon).
//
// One source of truth: change here, the TopBar stripe and the sidebar icon
// follow automatically.

export interface Section {
  /** Path that owns this section (longest match wins for nested routes). */
  path:  string
  /** Big uppercase label shown in the TopBar. */
  label: string
  /** 3px stripe color (CSS hex). */
  color: string
}

export const SECTIONS: Section[] = [
  { path: '/dashboard',    label: 'Panel',         color: '#475569' },
  { path: '/pendientes',   label: 'Pendientes',    color: '#DC2626' },
  { path: '/contratos',    label: 'Contratos',     color: '#0F766E' },
  { path: '/propietarios', label: 'Propietarios',  color: '#7C3AED' },
  { path: '/inquilinos',   label: 'Inquilinos',    color: '#0284C7' },
  { path: '/propiedades',  label: 'Propiedades',   color: '#16A34A' },
  { path: '/movimientos',  label: 'Movimientos',   color: '#CA8A04' },
  { path: '/bancos',       label: 'Bancos',        color: '#1E40AF' },
  { path: '/conciliacion', label: 'Conciliación',  color: '#9D174D' },
  { path: '/liquidacion',  label: 'Liquidación',   color: '#0891B2' },
]

const DEFAULT_SECTION: Section = SECTIONS[0]

/**
 * Resolve the section that owns `pathname`. Longest-prefix match so
 * `/contratos/[id]` resolves to Contratos, not the dashboard fallback.
 */
export function getSection(pathname: string): Section {
  const match = SECTIONS
    .filter(s => pathname === s.path || pathname.startsWith(s.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]
  return match ?? DEFAULT_SECTION
}

/**
 * If we're on a detail route (e.g. /contratos/abc-123), return the suffix
 * for the breadcrumb. Just "Detalle" for now — pages can override later by
 * exposing the entity name through metadata.
 */
export function getBreadcrumbSuffix(pathname: string): string | null {
  const section = getSection(pathname)
  if (pathname === section.path) return null
  // Anything deeper is a detail page
  return 'Detalle'
}
