// Shared ECharts theme — ported from Plager ERP useChartTheme.ts.
// Currency formatters adapted from BRL (R$) to ARS ($).

import { fmtMoney } from '@/lib/format'
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
    surface:     isDark ? '#18181B' : '#FFFFFF',
    // Tooltip — stays high-contrast on either theme (dark bubble works on both)
    tooltipBg:   isDark ? '#27272A' : '#1F1F1F',
    tooltipText: isDark ? '#FAFAFA' : '#FAFAFA',
    // Axis + grid — softer on dark
    axisLine:    isDark ? '#27272A' : '#E5E5E5',
    axisLabel:   isDark ? '#71717A' : '#7D8491',
    gridLine:    isDark ? '#27272A' : '#F2F2F2',
    // Donut center / large numbers
    centerLabel: isDark ? '#71717A' : '#7D8491',
    centerValue: isDark ? '#FAFAFA' : '#1F1F1F',
  }
}

// Legacy multi-hue palette — kept for backward compatibility but discouraged.
// Prefer the monochrome palettes below for new charts.
export const chartPalette = ['#FF8552', '#E66A36', '#16A34A', '#2563EB', '#F5C518', '#7D8491']

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

export const chartBaseStyle = {
  textStyle: {
    fontFamily: 'Lexend, system-ui, sans-serif',
    color: '#4A4F58',
  },
  grid: { left: 16, right: 16, top: 16, bottom: 16, containLabel: true },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E1D8',
    borderWidth: 1,
    textStyle: { color: '#1F1F1F', fontFamily: 'Lexend, system-ui, sans-serif' },
    padding: [8, 12] as [number, number],
  },
}

export function fmtCompactARS(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (Math.abs(v) >= 1_000) return `$ ${(v / 1_000).toFixed(0)} mil`
  return `$ ${v.toLocaleString('es-AR')}`
}

export const fmtARS = (v: number) => fmtMoney(v)

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('es-AR')
}

export function fmtCount(unit: string, plural?: string) {
  return (v: number) => `${fmtInt(v)} ${v === 1 ? unit : plural ?? unit + 's'}`
}
