import Link from 'next/link'
import type { ValidationIssue, ValidationCode } from '@/lib/liquidacion/validations'
import { fmtMoney } from '@/lib/format'

// ============================================================================
// ValidationIssueRow — single validation issue rendered as a row.
//
// Used by:
//   • /diagnostico page (system-wide list)
//   • /contratos/[id] (per-contract issues section)
//   • components/liquidacion/ValidationBadgeCell popover (per-row Check badge)
//
// Two display modes:
//   • showContract = true   → full row with tenant/landlord names + action
//   • showContract = false  → compact, just severity + message + expected/actual
// ============================================================================

interface Props {
  issue:         ValidationIssue
  /** When provided, the row shows tenant + landlord names and a "Ver contrato"
   *  link. When omitted, the row stays compact (used inside per-contract
   *  popovers where the contract identity is already known from the context). */
  contract?: {
    contractId:    string
    tenantName:    string
    landlordName:  string
  }
  /** Optional. Overrides the default "Ver contrato →" link with a custom URL. */
  contractHref?: string
}

const CODE_LABEL: Record<ValidationCode, string> = {
  TRANSFERENCIA_IMBALANCE:           'Transferencia no balancea',
  TRANSFERENCIA_NEGATIVE:            'Transferencia negativa',
  PAID_STATUS_INCONSISTENT:          'Estado pagada inconsistente',
  BANK_DATES_OUT_OF_ORDER:           'Fechas bancarias fuera de orden',
  ADMI_DESTINATIONS_UNCLASSIFIED:    'ADMI sin clasificar',
  COMMISSION_PCT_DEVIATION:          'Comisión efectiva difiere',
  RENT_AMOUNT_VARIANCE:              'Variación de alquiler',
  PAYMENT_OVERDUE:                   'Alquiler vencido (recargo por mora)',
  CONTRACT_EXPIRED_BUT_ACTIVE:       'Contrato vencido — sigue activo',
  CONTRACT_INVALID_DATE_RANGE:       'Vigencia inválida',
  CONTRACT_LANDLORD_JUNCTION_EMPTY:  'Sin propietarios cargados',
  CONTRACT_TENANT_JUNCTION_EMPTY:    'Sin inquilinos cargados',
  LANDLORD_PCT_SUM_NOT_100:          'Suma % propietarios ≠ 100',
  TENANT_PCT_SUM_NOT_100:            'Suma % inquilinos ≠ 100',
  ADMIN_PCT_SUM_INVALID:             'Suma % administradores ≠ 100',
  CONTRACT_MISSING_COMMISSION_PCT:   'Sin % de comisión cargado',
  CONTRACT_NEXT_ADJUSTMENT_OVERDUE:  'Aumento programado vencido',
  CONTRACT_SELLADO_PENDING:          'Sellado sin aplicar',
  CONTRACT_DEPOSIT_STATE_INVALID:    'Depósito devuelto en contrato activo',
  BILLING_IVA_MISMATCH:              'IVA contrato vs administrador no coincide',
}

export function prettyValidationCode(code: ValidationCode | string): string {
  return CODE_LABEL[code as ValidationCode] ?? code
}

export function ValidationIssueRow({ issue, contract, contractHref }: Props) {
  const isError = issue.severity === 'error'

  const dotClass  = isError ? 'bg-danger' : 'bg-warn'
  const tintClass = isError ? 'bg-danger/5' : 'bg-warn/5'

  const href = contractHref ?? (contract ? `/contratos/${contract.contractId}` : null)

  return (
    <li className={`px-3 py-2 border-b border-gray-100 last:border-b-0 ${tintClass}`}>
      <div className="flex items-start gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotClass}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          {contract && (
            <p className="text-[13px] text-ink leading-snug">
              <strong className="font-medium">{contract.tenantName}</strong>
              <span className="text-slate"> · prop. </span>
              <span className="text-slate-dark">{contract.landlordName}</span>
            </p>
          )}
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mt-0.5">
            {isError ? 'Error' : 'Aviso'} · {prettyValidationCode(issue.code)}
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
                  <span className={`tabular-nums font-medium ${isError ? 'text-danger' : 'text-warn'}`}>
                    {fmtMoney(issue.diff)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 px-2 py-1 rounded border border-line text-slate-dark text-[11px] font-medium hover:bg-cream-2 transition-colors"
            title="Abrir la página del contrato"
          >
            Ver contrato →
          </Link>
        )}
      </div>
    </li>
  )
}
