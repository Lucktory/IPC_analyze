'use client'

// ============================================================================
// ValidationBadgeCell — column 21 indicator (Phase 7A).
//
// Renders a small badge based on the row's validationIssues:
//   • zero issues          → muted green ✓
//   • only warnings        → yellow ⚠ N (count)
//   • at least one error   → red ⚠ N
//
// Click → popover (portal-rendered to escape the grid's overflow context)
// listing every issue with severity dot, message, expected vs actual.
// ============================================================================

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPopover } from './useFloatingPopover'
import { highestSeverity, type ValidationIssue } from '@/lib/liquidacion/validations'
import { ValidationIssueRow } from '@/components/shared/ValidationIssueRow'

interface Props {
  issues: ValidationIssue[]
}

export function ValidationBadgeCell({ issues }: Props) {
  const [open, setOpen] = useState(false)
  const [popoverEl, setPopoverEl] = useState<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, popover: popoverEl, minWidth: 380 })

  const severity = highestSeverity(issues)
  const count    = issues.length

  // Circular status badge (matches the mockup): green ✓ when clean, amber ⚠
  // for warnings, a filled red circle with the issue count for errors.
  const badge =
    count === 0            ? 'bg-success/15 text-success' :
    severity === 'error'   ? 'bg-danger text-white' :
                             'bg-warn/20 text-warn'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => count > 0 && setOpen(true)}
        title={count === 0 ? 'Todos los chequeos pasaron' : `${count} ${count === 1 ? 'problema' : 'problemas'} — tocá para ver`}
        className={`inline-grid place-items-center w-5 h-5 rounded-full transition-transform ${badge} ${count === 0 ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        disabled={count === 0}
      >
        {count === 0
          ? <span className="text-[11px] leading-none">✓</span>
          : severity === 'error'
            ? <span className="text-[10px] font-semibold tabular-nums leading-none">{count}</span>
            : <span className="text-[11px] leading-none">⚠</span>}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            ref={setPopoverEl}
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-paper border border-line rounded shadow-lg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-line bg-cream-2 flex items-center justify-between">
              <span className="font-display text-[13px] font-medium text-ink">
                {count} {count === 1 ? 'discrepancia detectada' : 'discrepancias detectadas'}
              </span>
              <span className="text-[10px] text-slate italic">click afuera para cerrar</span>
            </div>
            <ul className="max-h-[360px] overflow-y-auto">
              {issues.map((issue, idx) => (
                <ValidationIssueRow key={`${issue.code}-${idx}`} issue={issue} />
              ))}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

// Rule-code → Spanish label map lives in components/shared/ValidationIssueRow.tsx
// (see `prettyValidationCode`) so /diagnostico, the contract page, and this
// badge's popover all render labels from one source.
