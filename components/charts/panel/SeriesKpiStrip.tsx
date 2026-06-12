// ============================================================================
// SeriesKpiStrip — the colored "● LABEL value  ● LABEL value" header strip
// shown above MultiLineArea, mirroring the three-series legend in the design.
// ============================================================================

interface SeriesKpiItem {
  label: string
  color: string
  value: string
}

interface Props {
  items: SeriesKpiItem[]
}

export function SeriesKpiStrip({ items }: Props) {
  return (
    <div className="flex items-baseline gap-5 flex-wrap mb-3">
      {items.map(i => (
        <div key={i.label} className="inline-flex items-baseline gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i.color }} />
          <span className="text-[10px] text-panel-muted uppercase tracking-wider">{i.label}</span>
          <span className="text-[14px] font-medium text-panel-ink tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  )
}
