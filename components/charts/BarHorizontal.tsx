'use client'

import dynamic from 'next/dynamic'
import { chartBaseStyle, accentInk, fmtCompactARS, fmtInt, useChartColors } from './theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface Datum {
  name: string
  value: number
}

type Format = 'currency' | 'percent' | 'integer'

interface Props {
  data: Datum[]
  height?: number
  format?: Format
  unit?: string
  unitPlural?: string
  barColor?: string
  preserveOrder?: boolean
  showLabels?: boolean
}

function buildFormatter({
  format,
  unit,
  unitPlural,
}: {
  format: Format
  unit?: string
  unitPlural?: string
}) {
  if (unit) {
    return (v: number) => `${fmtInt(v)} ${v === 1 ? unit : unitPlural ?? unit + 's'}`
  }
  if (format === 'percent') return (v: number) => `${v}%`
  if (format === 'integer') return fmtInt
  return fmtCompactARS
}

export function BarHorizontal({
  data,
  height = 240,
  format = 'currency',
  unit,
  unitPlural,
  barColor = accentInk,
  preserveOrder = false,
  showLabels = true,
}: Props) {
  const ordered = preserveOrder ? [...data].reverse() : [...data].sort((a, b) => a.value - b.value)
  const fmt = buildFormatter({ format, unit, unitPlural })
  const c   = useChartColors()

  const option = {
    ...chartBaseStyle,
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    grid: { left: 8, right: 88, top: 4, bottom: 8, containLabel: true },
    tooltip: { show: false },
    xAxis: {
      type: 'value' as const,
      show: false,
    },
    yAxis: {
      type: 'category' as const,
      data: ordered.map(d => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 12, fontFamily: 'Lexend' },
    },
    series: [
      {
        type: 'bar' as const,
        data: ordered.map(d => d.value),
        itemStyle: { color: barColor },
        barWidth: 10,
        label: {
          show: showLabels,
          position: 'right' as const,
          color: c.centerValue,
          fontSize: 11,
          fontFamily: 'Lexend',
          fontWeight: 500,
          distance: 8,
          formatter: (p: any) => fmt(p.value),
        },
      },
    ],
  }

  return (
    <div style={{ width: '100%', height }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}
