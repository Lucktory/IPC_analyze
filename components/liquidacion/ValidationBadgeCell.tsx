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
import { fmtMoney } from '@/lib/format'

interface Props {
  issues: ValidationIssue[]
}

export function ValidationBadgeCell({ issues }: Props) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 380 })

  const severity = highestSeverity(issues)
  const count    = issues.length

  // Visual: tiered styles based on severity.
  const styles =
    severity === 'error'   ? { dot: 'bg-danger',  text: 'text-danger',  bg: 'hover:bg-danger/10' } :
    severity === 'warning' ? { dot: 'bg-warn',    text: 'text-ink',     bg: 'hover:bg-warn/10'   } :
                             { dot: 'bg-success/70', text: 'text-success', bg: 'hover:bg-success/10' }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => count > 0 && setOpen(true)}
        title={count === 0 ? 'Todos los chequeos pasaron' : `${count} ${count === 1 ? 'problema' : 'problemas'} — tocá para ver`}
        className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded transition-colors ${styles.bg} ${count === 0 ? 'cursor-default' : 'cursor-pointer'}`}
        disabled={count === 0}
      >
        {count === 0 ? (
          <span className={`text-[12px] ${styles.text}`}>✓</span>
        ) : (
          <>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            <span className={`text-[10px] font-medium ${styles.text}`}>{count}</span>
          </>
        )}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-display text-[13px] font-medium text-ink">
                {count} {count === 1 ? 'discrepancia detectada' : 'discrepancias detectadas'}
              </span>
              <span className="text-[10px] text-gray-500 italic">click afuera para cerrar</span>
            </div>
            <ul className="max-h-[360px] overflow-y-auto">
              {issues.map((issue, idx) => (
                <li
                  key={`${issue.code}-${idx}`}
                  className={`px-3 py-2 border-b border-gray-100 last:border-b-0 ${issue.severity === 'error' ? 'bg-danger/5' : 'bg-warn/5'}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${issue.severity === 'error' ? 'bg-danger' : 'bg-warn'}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
                        {issue.severity === 'error' ? 'Error' : 'Aviso'} · {prettyCode(issue.code)}
                      </p>
                      <p className="text-[12.5px] text-ink mt-0.5 leading-snug">{issue.message}</p>
                      {(issue.expected !== null || issue.actual !== null) && (
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                          {issue.expected !== null && (
                            <div>
                              <span className="text-gray-500 block">Esperado</span>
                              <span className="text-ink tabular-nums">{fmtMoney(issue.expected)}</span>
                            </div>
                          )}
                          {issue.actual !== null && (
                            <div>
                              <span className="text-gray-500 block">Actual</span>
                              <span className="text-ink tabular-nums">{fmtMoney(issue.actual)}</span>
                            </div>
                          )}
                          {issue.diff > 0 && (
                            <div>
                              <span className="text-gray-500 block">Diferencia</span>
                              <span className={`tabular-nums font-medium ${issue.severity === 'error' ? 'text-danger' : 'text-warn'}`}>
                                {fmtMoney(issue.diff)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

// Map the rule code to a short human-readable Spanish category label.
function prettyCode(code: string): string {
  switch (code) {
    case 'TRANSFERENCIA_IMBALANCE':       return 'Transferencia no balancea'
    case 'TRANSFERENCIA_NEGATIVE':        return 'Transferencia negativa'
    case 'PAID_STATUS_INCONSISTENT':      return 'Estado pagada inconsistente'
    case 'BANK_DATES_OUT_OF_ORDER':       return 'Fechas bancarias fuera de orden'
    case 'ADMI_DESTINATIONS_UNCLASSIFIED': return 'ADMI sin clasificar'
    case 'COMMISSION_PCT_DEVIATION':      return 'Comisión efectiva difiere'
    case 'RENT_AMOUNT_VARIANCE':          return 'Variación de alquiler'
    case 'PAYMENT_OVERDUE':               return 'Alquiler vencido (recargo por mora)'
    case 'CONTRACT_EXPIRED_BUT_ACTIVE':   return 'Contrato vencido — sigue activo'
    case 'CONTRACT_INVALID_DATE_RANGE':   return 'Vigencia inválida'
    case 'CONTRACT_LANDLORD_JUNCTION_EMPTY': return 'Sin propietarios cargados'
    case 'CONTRACT_TENANT_JUNCTION_EMPTY':   return 'Sin inquilinos cargados'
    case 'LANDLORD_PCT_SUM_NOT_100':      return 'Suma % propietarios ≠ 100'
    case 'TENANT_PCT_SUM_NOT_100':        return 'Suma % inquilinos ≠ 100'
    case 'ADMIN_PCT_SUM_INVALID':         return 'Suma % administradores ≠ 100'
    case 'CONTRACT_MISSING_COMMISSION_PCT': return 'Sin % de comisión cargado'
    case 'CONTRACT_NEXT_ADJUSTMENT_OVERDUE': return 'Aumento programado vencido'
    case 'CONTRACT_SELLADO_PENDING':      return 'Sellado sin aplicar'
    case 'CONTRACT_DEPOSIT_STATE_INVALID': return 'Depósito devuelto en contrato activo'
    case 'BILLING_IVA_MISMATCH':          return 'IVA contrato vs administrador no coincide'
    default:                              return code
  }
}
