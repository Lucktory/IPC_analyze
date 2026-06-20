// ============================================================================
// Diagnóstico digest — flattens the planilla's per-row validation issues
// into a system-wide list grouped by severity + rule.
//
// Single source of truth: reuses getLiquidacionGridForPeriod() which already
// runs all 20 validators. No new validation logic here — pure projection.
//
// Used by:
//   • /diagnostico page (system-wide view)
//   • /contratos/[id] (per-contract subset via getContractDiagnostico)
//   • future: /dashboard widget, /pendientes integrity section
// ============================================================================

import { getLiquidacionGridForPeriod } from './queries'
import type { ValidationIssue, ValidationCode } from './validations'

export interface DiagnosticoItem {
  contractId:     string
  contractNumber: string | null
  tenantName:     string
  landlordName:   string
  issue:          ValidationIssue
}

export interface DiagnosticoCounts {
  errors:        number
  warnings:      number
  totalIssues:   number
  cleanContracts: number
  totalContracts: number
}

export interface DiagnosticoDigest {
  period:    string
  items:     DiagnosticoItem[]
  counts:    DiagnosticoCounts
  /** Issue count per ValidationCode — drives the per-rule filter chips. */
  byCode:    Partial<Record<ValidationCode, number>>
}

export async function getDiagnosticoDigest(period: string): Promise<DiagnosticoDigest> {
  const rows = await getLiquidacionGridForPeriod(period)

  const items: DiagnosticoItem[] = []
  let cleanContracts = 0
  const byCode: Partial<Record<ValidationCode, number>> = {}

  for (const r of rows) {
    if (r.validationIssues.length === 0) {
      cleanContracts++
      continue
    }
    for (const issue of r.validationIssues) {
      items.push({
        contractId:     r.contractId,
        contractNumber: r.contrato,
        tenantName:     r.inquilino,
        landlordName:   r.propietario,
        issue,
      })
      byCode[issue.code] = (byCode[issue.code] ?? 0) + 1
    }
  }

  // Sort: errors first, then warnings; within severity by rule code (stable
  // alphabetical) then by contract for repeatable ordering across renders.
  items.sort((a, b) => {
    const sev = (s: 'error' | 'warning') => (s === 'error' ? 0 : 1)
    const sa = sev(a.issue.severity), sb = sev(b.issue.severity)
    if (sa !== sb) return sa - sb
    if (a.issue.code !== b.issue.code) return a.issue.code.localeCompare(b.issue.code)
    return (a.contractNumber ?? '').localeCompare(b.contractNumber ?? '')
  })

  const errors   = items.filter(i => i.issue.severity === 'error').length
  const warnings = items.filter(i => i.issue.severity === 'warning').length

  return {
    period,
    items,
    counts: {
      errors,
      warnings,
      totalIssues:    items.length,
      cleanContracts,
      totalContracts: rows.length,
    },
    byCode,
  }
}

/** Per-contract subset — keeps the contract detail page in sync with the
 *  planilla Check badge. Returns just the issues for one contract+period. */
export async function getContractDiagnostico(
  contractId: string,
  period:     string,
): Promise<DiagnosticoItem[]> {
  const digest = await getDiagnosticoDigest(period)
  return digest.items.filter(i => i.contractId === contractId)
}
