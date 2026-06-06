import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="font-display text-[28px] leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && <p className="text-slate mt-1 text-[14px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
