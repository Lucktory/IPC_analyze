import type { ReactNode } from 'react'

type Tone = 'success' | 'danger' | 'neutral' | 'warn' | 'info'

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  /**
   * Extra Tailwind classes appended after the default. Use with the `!`
   * prefix to force-override the badge's default text color when sitting
   * on a tinted urgency row (e.g. `!text-white` on the orange critical row).
   */
  className?: string
}

const dotClass: Record<Tone, string> = {
  success: 'bg-success',
  danger:  'bg-danger',
  warn:    'bg-warn',
  info:    'bg-info',
  neutral: 'bg-slate',
}

const textClass: Record<Tone, string> = {
  success: 'text-success',
  danger:  'text-danger',
  warn:    'text-warn',
  info:    'text-info',
  neutral: 'text-slate-dark',
}

// Minimal status indicator: small colored dot + text. Replaces the legacy
// full-fill pill which signaled "template" too strongly. Used Linear-style.
export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${textClass[tone]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass[tone]}`} />
      {children}
    </span>
  )
}
