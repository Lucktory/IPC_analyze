import type { ReactNode } from 'react'

type Tone = 'success' | 'danger' | 'neutral'

interface BadgeProps {
  tone?: Tone
  children: ReactNode
}

const dotClass: Record<Tone, string> = {
  success: 'bg-success',
  danger:  'bg-danger',
  neutral: 'bg-slate',
}

const textClass: Record<Tone, string> = {
  success: 'text-success',
  danger:  'text-danger',
  neutral: 'text-slate-dark',
}

// Minimal status indicator: small colored dot + text. Replaces the legacy
// full-fill pill which signaled "template" too strongly. Used Linear-style.
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${textClass[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass[tone]}`} />
      {children}
    </span>
  )
}
