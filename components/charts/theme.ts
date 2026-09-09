// Shared ECharts theme — ported from Plager ERP useChartTheme.ts.
// Currency formatters adapted from BRL (R$) to ARS ($).

import { fmtMoney, fmtInt } from '@/lib/format'
import { useTheme } from '@/lib/theme'

/**
 * Theme-aware color tokens for ECharts. Hardcoded colors in chart option
 * objects (tooltip backgrounds, axis labels, split lines, donut center
 * text, pie segment borders) all read from this hook so charts swap
 * cleanly when the user toggles the theme.
 *
 * Light values match the existing chart look; dark values come from the
 * panel.* / paper-dark scale defined in globals.css.
 */
export function useChartColors() {
  const { resolved } = useTheme()
  const isDark = resolved === 'dark'
  return {
    isDark,
    // Surfaces — pie segment borders, card-internal backgrounds
    surface:     isDark ? '#151B26' : '#FFFFFF',
    // Tooltip — stays high-contrast on either theme (dark bubble works on both)
    tooltipBg:   isDark ? '#0B0F16' : '#131A28',
    tooltipText: isDark ? '#F4F6FA' : '#FFFFFF',
    // Axis + grid — cool, softer on dark
    axisLine:    isDark ? '#232A38' : '#E2E6ED',
    axisLabel:   isDark ? '#6B7485' : '#8A93A5',
    gridLine:    isDark ? '#232A38' : '#EEF1F6',
    // Donut center / large numbers
    centerLabel: isDark ? '#6B7485' : '#8A93A5',
    centerValue: isDark ? '#F4F6FA' : '#131A28',
  }
}

// Legacy multi-hue palette — kept for backward compatibility but discouraged.
// Prefer the monochrome palettes below for new charts.
export const chartPalette = ['#3B82F6', '#34D399', '#8B5CF6', '#F59E0B', '#60A5FA', '#8A93A5']

// Single-hue palettes — three lightness levels each. Use these for categorical
// data without semantic meaning. Mercury / Stripe / Linear aesthetic.
export const monoInkPalette   = ['#1F1F1F', '#4A4F58', '#7D8491']
export const monoSlatePalette = ['#4A4F58', '#7D8491', '#D6CFC1']
export const monoRedPalette   = ['#991B1B', '#DC2626', '#F87171']
export const monoGreenPalette = ['#14532D', '#16A34A', '#86EFAC']

// Single accent colors for bar charts where bar = one value per row.
// accentInk softened from pure ink (#1F1F1F) to slate-dark (#4A4F58) —
// pure black on near-white reads as harsh slabs and tires the eye over
// scan time. The cool-gray is what Stripe / Mercury / Linear use.
export const accentInk   = '#4A4F58'
export const accentGreen = '#16A34A'
export const accentRed   = '#DC2626'

// Premium muted palette used by /dashboard. Tuned to read OK on both light
// and dark surfaces — saturated enough to be distinct, desaturated enough
// to feel calm. Mirrors `accent.*` in tailwind.config.ts (Tailwind tokens
// can't be read from JS, so we keep them as hex here too).
export const PREMIUM = {
  gold:     '#3B82F6',   // primary blue
  slate:    '#8A93A5',
  emerald:  '#34D399',
  amethyst: '#8B5CF6',   // violet
  inkSoft:  '#F59E0B',   // amber
  inkDeep:  '#60A5FA',   // light blue
} as const

// Color rotation for donut segments etc. Cycles through the four premium
// hues + two dark slates as fallbacks for 5th/6th segments.
export const PREMIUM_ROTATION = [
  PREMIUM.gold,      // blue
  PREMIUM.emerald,   // emerald
  PREMIUM.amethyst,  // violet
  PREMIUM.inkSoft,   // amber
  PREMIUM.inkDeep,   // light blue
  PREMIUM.slate,     // slate
]

// Theme-neutral chart defaults. Tooltip colors live in `useChartColors()`
// because they need to swap with the theme — every chart overrides them
// from there. The font family + grid spacing here are safe in both themes.
export const chartBaseStyle = {
  textStyle: {
    fontFamily: 'Lexend, system-ui, sans-serif',
  },
  grid: { left: 16, right: 16, top: 16, bottom: 16, containLabel: true },
}

export function fmtCompactARS(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (Math.abs(v) >= 1_000) return `$ ${(v / 1_000).toFixed(0)} mil`
  return `$ ${v.toLocaleString('es-AR')}`
}

export const fmtARS = (v: number) => fmtMoney(v)

// Canonical definition now lives in lib/format.ts (it is not chart-specific —
// every KPI tile needs it). Re-exported here so the chart components that
// already import it from this module keep working unchanged.
export { fmtInt }

export function fmtCount(unit: string, plural?: string) {
  return (v: number) => `${fmtInt(v)} ${v === 1 ? unit : plural ?? unit + 's'}`
}
