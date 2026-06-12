'use client'

// ============================================================================
// MultiLineArea — N smooth area lines on a shared time axis, dark themed.
// Used by /dashboard for "Tendencia operativa". Three muted accent colors
// (gold / emerald / amethyst) by default. The current-value KPI strip
// above the chart is rendered by the parent in the card's body, not here.
// ============================================================================

import dynamic from 'next/dynamic'
import { chartBaseStyle, fmtCompactARS } from '../theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface LineSeries {
  name:    string
  color:   string
  values:  number[]
  /** Optional formatter override for tooltip + axis. */
  format?: 'currency' | 'integer'
}

interface Props {
  /** X-axis category labels (one per index across all series). */
  xLabels: string[]
  series:  LineSeries[]
  height?: number
}

export function MultiLineArea({ xLabels, series, height = 220 }: Props) {
  const option: any = {
    ...chartBaseStyle,
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    animation: true,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#262C39', width: 1 },
      },
      backgroundColor: '#0F1218',
      borderColor: '#262C39',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#E5E7EB', fontFamily: 'Lexend', fontSize: 12 },
      formatter: (params: any[]) => {
        const month = params[0]?.axisValueLabel ?? ''
        const lines = params.map(p => {
          const s     = series[p.seriesIndex]
          const fmt   = (s.format ?? 'integer') === 'currency' ? fmtCompactARS : (v: number) => v.toLocaleString('es-AR')
          return `<div style="display:flex;gap:10px;align-items:baseline">` +
                 `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color}"></span>` +
                 `<span style="flex:1;color:#9CA3AF">${s.name}</span>` +
                 `<span style="font-variant-numeric:tabular-nums;color:#E5E7EB">${fmt(p.value)}</span>` +
                 `</div>`
        }).join('')
        return `<div style="font-weight:500;margin-bottom:6px">${month}</div>${lines}`
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      boundaryGap: false,
      axisLine:  { lineStyle: { color: '#262C39' } },
      axisTick:  { show: false },
      axisLabel: { color: '#9CA3AF', fontFamily: 'Lexend', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9CA3AF', fontFamily: 'Lexend', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1F2430', type: [4, 4] } },
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      smoothMonotone: 'x',
      symbol: 'none',
      lineStyle: { color: s.color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: s.color + '55' },
            { offset: 1, color: s.color + '00' },
          ],
        },
      },
      emphasis: { focus: 'series', lineStyle: { width: 2.5 } },
      data: s.values,
    })),
  }

  return (
    <div style={{ width: '100%', height }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}
