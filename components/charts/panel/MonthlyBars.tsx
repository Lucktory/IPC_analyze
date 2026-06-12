'use client'

// ============================================================================
// MonthlyBars — vertical bar chart over N months. Used by /dashboard for
// "Ingresos por mes". Rounded-top bars with a subtle vertical gradient.
// The "vs. mes anterior" delta indicator is rendered by the parent in
// the card's top-right slot, not here — keeps this component pure-chart.
// ============================================================================

import dynamic from 'next/dynamic'
import { chartBaseStyle, fmtCompactARS } from '../theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface BarPoint {
  label: string
  value: number
}

interface Props {
  points:  BarPoint[]
  color?:  string
  height?: number
  /** Currency vs raw integer formatting on the tooltip + y-axis. */
  format?: 'currency' | 'integer'
}

export function MonthlyBars({
  points,
  color  = '#D4A857',
  height = 220,
  format = 'currency',
}: Props) {
  const fmt = format === 'currency' ? fmtCompactARS : (v: number) => v.toLocaleString('es-AR')

  const option: any = {
    ...chartBaseStyle,
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    animation: true,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31,31,31,0.04)' } },
      backgroundColor: '#1F1F1F',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: '#FAFAFA', fontFamily: 'Lexend', fontSize: 12 },
      extraCssText: 'border-radius: 4px; box-shadow: 0 2px 12px rgba(31,31,31,0.18);',
      formatter: (params: any[]) => {
        const p = params[0]
        return `<div style="font-weight:500;margin-bottom:2px">${p.axisValueLabel}</div>` +
               `<div style="font-variant-numeric:tabular-nums">${fmt(p.value)}</div>`
      },
    },
    xAxis: {
      type: 'category',
      data: points.map(p => p.label),
      axisLine:  { lineStyle: { color: '#E5E5E5' } },
      axisTick:  { show: false },
      axisLabel: { color: '#7D8491', fontFamily: 'Lexend', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#7D8491', fontFamily: 'Lexend', fontSize: 10, formatter: fmt },
      splitLine: { lineStyle: { color: '#F2F2F2', type: [4, 4] } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color },
              { offset: 1, color: shade(color, -18) },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: shade(color,  10) },
                { offset: 1, color },
              ],
            },
          },
        },
        data: points.map(p => p.value),
      },
    ],
  }

  return (
    <div style={{ width: '100%', height }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}

/** Lighten (positive %) or darken (negative %) a hex color. */
function shade(hex: string, pct: number): string {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m) return hex
  const [r, g, b] = m.map(h => parseInt(h, 16))
  const lighten = (c: number) => Math.max(0, Math.min(255, Math.round(c + (255 - c) * (pct / 100))))
  const darken  = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + pct / 100))))
  const fn = pct >= 0 ? lighten : darken
  return '#' + [fn(r), fn(g), fn(b)].map(c => c.toString(16).padStart(2, '0')).join('')
}
