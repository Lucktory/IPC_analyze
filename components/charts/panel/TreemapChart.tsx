'use client'

// ============================================================================
// TreemapChart — area-encodes a ranked list. Each rectangle's area is
// proportional to its value, so the biggest contributor visually dominates.
//
// Used on /dashboard for "Concentración por propietario" — a glance tells
// you "Pérez S.A. is bigger than the next three combined" without reading
// numbers. This is the chart that exposes concentration risk visually.
// ============================================================================

import dynamic from 'next/dynamic'
import { chartBaseStyle, fmtCompactARS, useChartColors, PREMIUM_ROTATION } from '../theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface TreemapItem {
  name:  string
  value: number
  /** % of total — for the tooltip / label. */
  pct:   number
}

interface Props {
  items:   TreemapItem[]
  height?: number
}

export function TreemapChart({ items, height = 280 }: Props) {
  const c = useChartColors()

  const option: any = {
    ...chartBaseStyle,
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: c.tooltipBg,
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: c.tooltipText, fontFamily: 'Lexend', fontSize: 12 },
      extraCssText: 'border-radius: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.25);',
      formatter: (p: any) =>
        `<div style="font-weight:500;margin-bottom:2px">${p.name}</div>` +
        `<div style="display:flex;gap:10px;align-items:baseline">` +
        `<span style="font-variant-numeric:tabular-nums">${fmtCompactARS(p.value)}</span>` +
        `<span style="opacity:0.7;font-variant-numeric:tabular-nums">${p.data.pct.toFixed(1)}%</span>` +
        `</div>`,
    },
    series: [
      {
        type: 'treemap',
        breadcrumb: { show: false },
        roam:       false,
        nodeClick:  false,
        animation:  true,
        animationDuration: 700,
        animationEasing:   'cubicOut',
        width:  '100%',
        height: '100%',
        label: {
          show:       true,
          color:      '#FFFFFF',
          fontFamily: 'Lexend',
          fontWeight: 500,
          fontSize:   12,
          // Show name + amount; ECharts auto-hides the label when the
          // rectangle is too small to fit, so tiny tail slices stay clean.
          formatter: (p: any) => `${p.name}\n${fmtCompactARS(p.value)}`,
          textShadowColor: 'rgba(0,0,0,0.25)',
          textShadowBlur:  2,
        },
        upperLabel: { show: false },
        itemStyle: {
          borderColor: c.surface,
          borderWidth: 2,
          gapWidth:    2,
        },
        levels: [{
          // Force ECharts to not pick weird colors on its own
          color: PREMIUM_ROTATION,
          colorMappingBy: 'index',
        }],
        data: items.map((item, i) => ({
          name:  item.name,
          value: item.value,
          pct:   item.pct,
          itemStyle: {
            color: PREMIUM_ROTATION[i % PREMIUM_ROTATION.length],
          },
        })),
      },
    ],
  }

  return (
    <div style={{ width: '100%', height }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}
