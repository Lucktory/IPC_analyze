type Tone = 'positive' | 'negative' | 'neutral'

interface KPICardProps {
  label: string
  value: string
  delta?: string
  deltaTone?: Tone
}

const toneClass: Record<Tone, string> = {
  positive: 'text-success',
  negative: 'text-danger',
  neutral:  'text-slate-dark',
}

export function KPICard({ label, value, delta, deltaTone = 'neutral' }: KPICardProps) {
  return (
    <div className="bg-paper border border-line rounded p-5 shadow-card transition-all duration-200 hover:border-ink/25 hover:-translate-y-0.5 hover:shadow-cardHover">
      <p className="label-cap">{label}</p>
      <p className="font-display text-[32px] leading-none font-semibold text-ink mt-3 tabular-nums tracking-tight">
        {value}
      </p>
      {delta && (
        <p className={`text-[12px] mt-3 font-medium ${toneClass[deltaTone]}`}>{delta}</p>
      )}
    </div>
  )
}
