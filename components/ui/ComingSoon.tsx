interface ComingSoonProps {
  title:   string
  lead:    string
  bullets: string[]
}

export function ComingSoon({ title, lead, bullets }: ComingSoonProps) {
  return (
    <>
      <div className="mb-6">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink font-medium">{title}</strong>
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card p-10">
        <div className="max-w-xl">
          <p className="label-cap text-slate mb-2">Próximamente</p>
          <h2 className="font-display text-[20px] font-medium text-ink mb-4">{title}</h2>
          <p className="text-[14px] text-slate-dark leading-relaxed mb-6">{lead}</p>

          <ul className="space-y-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-dark">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-dark/40 mt-1.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
