'use client'

// ============================================================================
// DonutPanel — donut chart with a configurable legend (side or bottom).
// Used by the top two cards on /dashboard. The donut renders via ECharts;
// the legend is plain HTML so we can draw the colored accent underline
// beneath each label exactly as in the design reference.
// ============================================================================

import dynamic from 'next/dynamic'
import { chartBaseStyle } from '../theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export type LegendPosition = 'side' | 'bottom'

export interface DonutPanelItem {
  label: string
  value: number
  color: string
}

interface Props {
  items:           DonutPanelItem[]
  legendPosition?: LegendPosition
  /** Word shown under the big number, e.g. "propiedades", "contratos". */
  totalUnit?:      string
}

export function DonutPanel({ items, legendPosition = 'side', totalUnit = 'total' }: Props) {
  const total = items.reduce((s, i) => s + i.value, 0)

  const option: any = {
    ...chartBaseStyle,
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    tooltip: {
      show: true,
      trigger: 'item',
      backgroundColor: '#1F1F1F',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: {
        color: '#FAFAFA',
        fontFamily: 'Lexend, system-ui, sans-serif',
        fontSize: 12,
      },
      extraCssText: 'border-radius: 4px; box-shadow: 0 2px 12px rgba(31,31,31,0.18);',
      formatter: (p: any) =>
        `<div style="font-weight:500;margin-bottom:2px">${p.name}</div>` +
        `<div style="display:flex;gap:8px;align-items:baseline;opacity:0.85">` +
        `<span style="font-variant-numeric:tabular-nums">${p.value.toLocaleString('es-AR')}</span>` +
        `<span style="font-variant-numeric:tabular-nums">${p.percent}%</span></div>`,
    },
    series: [
      {
        type: 'pie',
        radius: ['65%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { focus: 'series', scaleSize: 4 },
        blur: { itemStyle: { opacity: 0.35 } },
        data: items.map(i => ({
          name:  i.label,
          value: i.value,
          itemStyle: { color: i.color, borderColor: '#FFFFFF', borderWidth: 2 },
        })),
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '40%',
        style: {
          text: 'TOTAL',
          fontSize: 10,
          fill: '#7D8491',
          fontFamily: 'Lexend',
          fontWeight: 500,
          letterSpacing: 2,
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '47%',
        style: {
          text: total.toLocaleString('es-AR'),
          fontSize: 30,
          fontWeight: 600,
          fill: '#1F1F1F',
          fontFamily: 'Lexend',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '62%',
        style: {
          text: totalUnit,
          fontSize: 11,
          fill: '#7D8491',
          fontFamily: 'Lexend',
        },
      },
    ],
  }

  const donut = (
    <div style={{ width: '100%', height: 220 }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )

  if (legendPosition === 'bottom') {
    return (
      <div className="flex flex-col">
        {donut}
        <div className="flex items-center justify-center gap-4 flex-wrap mt-2 pt-3 border-t border-line">
          {items.map(i => (
            <span key={i.label} className="inline-flex items-center gap-2 text-[12px] text-slate-dark">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: i.color }} />
              {i.label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // side legend
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 items-center">
      {donut}
      <ul className="flex flex-col gap-3">
        {items.map(i => {
          const pct = total > 0 ? Math.round((i.value / total) * 100) : 0
          return (
            <li key={i.label}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: i.color }} />
                <span className="text-[13px] text-ink flex-1 truncate">{i.label}</span>
                <span className="text-[14px] font-medium text-ink tabular-nums">{i.value}</span>
                <span className="text-[11px] text-slate tabular-nums w-9 text-right">{pct}%</span>
              </div>
              <div className="h-[2px] rounded-full" style={{ backgroundColor: i.color, opacity: 0.85 }} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
