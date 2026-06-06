// Shared ECharts theme — ported from Plager ERP useChartTheme.ts.
// Currency formatters adapted from BRL (R$) to ARS ($).

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
export const accentInk   = '#1F1F1F'
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
    textStyle: { color: '#111111', fontFamily: 'Lexend, system-ui, sans-serif' },
    padding: [8, 12] as [number, number],
  },
}

export function fmtCompactARS(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (Math.abs(v) >= 1_000) return `$ ${(v / 1_000).toFixed(0)} mil`
  return `$ ${v.toLocaleString('es-AR')}`
}

export function fmtARS(v: number): string {
  return '$' + Math.round(v).toLocaleString('es-AR')
}

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('es-AR')
}

export function fmtCount(unit: string, plural?: string) {
  return (v: number) => `${fmtInt(v)} ${v === 1 ? unit : plural ?? unit + 's'}`
}
