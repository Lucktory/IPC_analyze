'use client'

// ============================================================================
// PeriodSelect — month picker for the Panel dashboard. Navigates to
// /dashboard?period=YYYY-MM-01; the server page re-queries every widget for
// the chosen month. Options come from buildPeriodTabs (months with data +
// the live current month), newest-first.
// ============================================================================

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { periodLabel } from '@/lib/period'

export function PeriodSelect({ current, periods }: { current: string; periods: string[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="relative inline-flex items-center">
      <select
        value={current}
        onChange={e => {
          const p = e.target.value
          startTransition(() => router.push(`/dashboard?period=${p}`))
        }}
        aria-label="Seleccionar mes"
        className="appearance-none bg-cream-2 border border-line rounded-md pl-3 pr-8 py-1 text-[13px] font-medium text-ink cursor-pointer hover:border-info/50 focus:outline-none focus:ring-2 focus:ring-info/40 transition-colors"
      >
        {periods.map(p => (
          <option key={p} value={p}>{periodLabel(p)}</option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className={`pointer-events-none absolute right-2 text-slate ${pending ? 'animate-pulse' : ''}`}
      />
    </div>
  )
}
