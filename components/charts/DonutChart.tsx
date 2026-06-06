'use client'

import dynamic from 'next/dynamic'
import { chartBaseStyle, monoInkPalette, fmtCompactARS, fmtInt } from './theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface DonutItem {
  name: string
  value: number
  color?: string
}

type Format = 'currency' | 'percent' | 'integer'

interface Props {
  data: DonutItem[]
  totalLabel?: string
  compact?: boolean
  height?: number
  format?: Format
  unit?: string
  unitPlural?: string
  totalOverride?: string
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

export function DonutChart({
  data,
  totalLabel,
  compact = false,
  height,
  format = 'currency',
  unit,
  unitPlural,
  totalOverride,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const fmt = buildFormatter({ format, unit, unitPlural })
  const radius = compact ? ['62%', '80%'] : ['60%', '80%']
  const centerFontSize = compact ? 18 : 32
  const labelFontSize = compact ? 9 : 10

  const option: any = {
    ...chartBaseStyle,
    animation: false,
    tooltip: { show: false },
    series: [
      {
        type: 'pie',
        radius,
        avoidLabelOverlap: false,
        itemStyle: {},
        label: { show: false },
        labelLine: { show: false },
        emphasis: { disabled: true },
        data: data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color ?? monoInkPalette[i % monoInkPalette.length] },
        })),
      },
    ],
    graphic: totalLabel
      ? [
          {
            type: 'text',
            left: 'center',
            top: compact ? '38%' : '40%',
            style: {
              text: totalLabel,
              fontSize: labelFontSize,
              fill: '#7D8491',
              fontFamily: 'Lexend',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 1,
            },
          },
          {
            type: 'text',
            left: 'center',
            top: compact ? '47%' : '49%',
            style: {
              text: totalOverride ?? fmt(total),
              fontSize: centerFontSize,
              fontWeight: 600,
              fill: '#111111',
              fontFamily: 'Lexend',
            },
          },
        ]
      : [],
  }

  const computedHeight = height ?? (compact ? 160 : 260)

  return (
    <div style={{ width: '100%', height: computedHeight }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}
