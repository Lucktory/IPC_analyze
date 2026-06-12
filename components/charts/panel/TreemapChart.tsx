'use client'

// ============================================================================
// TreemapChart — premium concentration view. Each landlord = a rectangle
// area-sized by their revenue share, colored by rank with a monochromatic
// gold→slate gradient (rank 1 = brightest gold, last rank = muted slate).
// Each block has its own vertical gradient (lighter top → base bottom)
// for depth. Labels use ECharts rich text: rank badge + name + amount.
// ============================================================================

import dynamic from 'next/dynamic'
import { chartBaseStyle, fmtCompactARS, useChartColors, PREMIUM } from '../theme'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

export interface TreemapItem {
  name:  string
  value: number
  pct:   number
}

interface Props {
  items:   TreemapItem[]
  height?: number
}

// ── Color helpers — interpolate between two hex colors by t∈[0,1] ────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
function lighten(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    r + (255 - r) * (pct / 100),
    g + (255 - g) * (pct / 100),
    b + (255 - b) * (pct / 100),
  )
}

/** Monochromatic ramp: rank-1 → premium gold; last rank → muted slate. */
function rankColor(rank: number, total: number): string {
  if (total <= 1) return PREMIUM.gold
  const t = rank / (total - 1)
  return lerpHex(PREMIUM.gold, PREMIUM.slate, t)
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
        animationDuration: 1200,
        animationEasing:   'quinticInOut',
        animationDelay: (idx: number) => idx * 70,
        width:  '100%',
        height: '100%',
        // Rich-text label: rank badge over name + amount. ECharts hides the
        // label when the rectangle is too small to fit it cleanly, so the
        // tail rectangles stay clean.
        label: {
          show:     true,
          position: 'insideTopLeft',
          padding:  [10, 10],
          formatter: (p: any) => {
            const rank = (p.dataIndex + 1).toString()
            return `{rank|${rank}}\n{name|${p.name}}\n{amount|${fmtCompactARS(p.value)}}`
          },
          rich: {
            rank: {
              fontSize:        13,
              fontWeight:      700,
              color:           '#FFFFFF',
              backgroundColor: 'rgba(255,255,255,0.20)',
              borderRadius:    4,
              padding:         [3, 7],
              fontFamily:      'Lexend',
            },
            name: {
              fontSize:   13,
              fontWeight: 500,
              color:      '#FFFFFF',
              padding:    [6, 0, 2, 0],
              fontFamily: 'Lexend',
            },
            amount: {
              fontSize:   11,
              color:      'rgba(255,255,255,0.78)',
              fontFamily: 'Lexend',
            },
          },
        },
        upperLabel: { show: false },
        itemStyle: {
          borderColor:  c.surface,
          borderWidth:  3,
          gapWidth:     3,
          borderRadius: 6,           // ECharts ≥5.5 supports this on treemap
        },
        emphasis: {
          itemStyle: {
            shadowBlur:    8,
            shadowColor:   'rgba(0,0,0,0.18)',
            shadowOffsetY: 1,
          },
          label: { fontSize: 14 },
        },
        data: items.map((item, i) => {
          const base    = rankColor(i, items.length)
          const lighter = lighten(base, 14)
          return {
            name:  item.name,
            value: item.value,
            pct:   item.pct,
            itemStyle: {
              // Per-block vertical gradient — lighter at top, base at bottom.
              // Gives each rectangle "depth" without faking 3D.
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: lighter },
                  { offset: 1, color: base },
                ],
              },
            },
          }
        }),
      },
    ],
  }

  return (
    <div style={{ width: '100%', height }}>
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge lazyUpdate />
    </div>
  )
}
