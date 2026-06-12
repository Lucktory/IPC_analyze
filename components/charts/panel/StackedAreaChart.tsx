'use client'

// ============================================================================
// StackedAreaChart — two (or more) smooth-bezier lines on a shared axis with
// gradient area fills underneath. Used on /dashboard for "Ingresos &
// Comisiones": shows total revenue + Pampa's earned share in one read.
//
// NOTE: lines are NOT stacked — they overlap. For 2 series of very different
// magnitudes (ingresos vs comisiones), stacking flattens the smaller one
// against the y-axis. Overlapping lets both shapes read clearly.
// ============================================================================

import dynamic from 'next/dynamic'
import { chartBaseStyle, fmtCompactARS, useChartColors } from '../theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface AreaSeries {
  name:   string
  color:  string
  values: number[]
}

interface Props {
  xLabels: string[]
  series:  AreaSeries[]
  height?: number
}

export function StackedAreaChart({ xLabels, series, height = 280 }: Props) {
  const c = useChartColors()

  const option: any = {
    ...chartBaseStyle,
    backgroundColor: 'transparent',
    grid: { left: 8, right: 12, top: 32, bottom: 28, containLabel: true },
    animation: true,
    animationDuration: 1400,
    animationEasing: 'cubicInOut',
    // Stagger area-fill reveals so the two series don't pop in at once.
    animationDelay: (idx: number) => idx * 60,
    legend: {
      top: 0,
      right: 0,
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: c.axisLabel, fontFamily: 'Lexend', fontSize: 11 },
      itemGap: 18,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: c.axisLine, width: 1 },
      },
      backgroundColor: c.tooltipBg,
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: c.tooltipText, fontFamily: 'Lexend', fontSize: 12 },
      extraCssText: 'border-radius: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.25);',
      formatter: (params: any[]) => {
        const month = params[0]?.axisValueLabel ?? ''
        const lines = params.map(p =>
          `<div style="display:flex;gap:10px;align-items:baseline">` +
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>` +
          `<span style="flex:1;opacity:0.7">${p.seriesName}</span>` +
          `<span style="font-variant-numeric:tabular-nums">${fmtCompactARS(p.value)}</span>` +
          `</div>`,
        ).join('')
        return `<div style="font-weight:500;margin-bottom:6px">${month}</div>${lines}`
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      boundaryGap: false,
      axisLine:  { lineStyle: { color: c.axisLine } },
      axisTick:  { show: false },
      axisLabel: { color: c.axisLabel, fontFamily: 'Lexend', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.axisLabel, fontFamily: 'Lexend', fontSize: 10, formatter: fmtCompactARS },
      splitLine: { lineStyle: { color: c.gridLine, type: [4, 4] } },
    },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      smoothMonotone: 'x',
      symbol: 'circle',
      symbolSize: 0,             // hidden by default; shown on emphasis below
      lineStyle: { color: s.color, width: 2.5 },
      itemStyle: { color: s.color },
      areaStyle: {
        // Richer gradient — saturated near the line, full transparency
        // at the baseline. Same palette as the TintCard tints elsewhere
        // on /dashboard for visual continuity.
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0,   color: s.color + '70' },
            { offset: 0.6, color: s.color + '20' },
            { offset: 1,   color: s.color + '00' },
          ],
        },
      },
      emphasis: {
        focus: 'series',
        lineStyle: { width: 3 },
        itemStyle: { color: s.color, borderColor: c.surface, borderWidth: 2 },
        symbolSize: 9,
      },
      data: s.values,
    })),
  }

  return (
    <div style={{ width: '100%', height }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}
