// ============================================================================
// Managed rows — transactions OWNED by a dedicated planilla cell / single
// writer, which the generic Movimientos editors must NOT mutate.
//
// Why this exists: the Movimientos modal (listMovimientos/updateMovimiento) and
// the /movimientos/[id] form (updateTransaction) are generic row editors. They
// used to let a SECOND writer retag or clobber a row that a specialised cell
// already owns — e.g. flipping a COMMISSION_OUT to OTHER_IN, after which the
// ADMI "Calcular" button re-inserts a fresh commission and the owner is charged
// twice. Each managed row has exactly one writer:
//   • COMMISSION_OUT   → setCommission            (ADMI cell / Calcular)
//   • LANDLORD_PAYOUT  → upsertCellTransaction + setLandlordPayoutBankDate
//   • RENT_IN/RENT_NF_IN → Alquiler popover + setRentBankDate (Fecha banco)
//   • the OTROS cell's own OTHER_OUT row → setOtrosCell
// The Movimientos surface treats these as read-only and points edits to the
// owning cell. Plain module (no 'use server') so both client and server import.
// ============================================================================

/** Structural transaction types each owned by a single dedicated writer. */
export const MANAGED_TYPE_CODES = [
  'COMMISSION_OUT',
  'LANDLORD_PAYOUT',
  'RENT_IN',
  'RENT_NF_IN',
] as const

/**
 * Reserved marker appended by setOtrosCell to the planilla OTROS cell's own
 * OTHER_OUT row. ASCII and free of ILIKE wildcards (no `%`, no `_`), so it can
 * be matched with `.ilike('%[OTROS-CELL]%')`. Free-text Movimientos razones
 * never carry it, so the OTROS cell and itemised Movs salidas address disjoint
 * rows — no accidental adopt/overwrite/delete.
 */
export const OTROS_CELL_MARKER = '[OTROS-CELL]'

/** SQL ILIKE pattern that selects the OTROS cell's own row(s). */
export const OTROS_CELL_ILIKE = `%${OTROS_CELL_MARKER}%`

/**
 * True when the row is owned by a dedicated cell writer — a structural type, or
 * the OTROS cell's tagged OTHER_OUT row. Such rows are read-only in the generic
 * Movimientos editors.
 */
export function isManagedRow(typeCode: string, description: string | null | undefined): boolean {
  if ((MANAGED_TYPE_CODES as readonly string[]).includes(typeCode)) return true
  if (typeCode === 'OTHER_OUT' && (description ?? '').includes(OTROS_CELL_MARKER)) return true
  return false
}

/** Strip the reserved OTROS marker from a user-supplied description so a
 *  free-text razon can never forge ownership of the OTROS cell's row. */
export function stripOtrosMarker(description: string | null): string | null {
  if (!description) return description
  if (!description.includes(OTROS_CELL_MARKER)) return description
  const cleaned = description.split(OTROS_CELL_MARKER).join('').replace(/\s{2,}/g, ' ').trim()
  return cleaned || null
}

/** User-facing message pointing to the cell that owns a managed row. */
export function managedRowMessage(typeCode: string): string {
  switch (typeCode) {
    case 'COMMISSION_OUT':
      return 'La comision se edita desde la celda ADMI de la planilla (boton Calcular), no desde Movimientos.'
    case 'LANDLORD_PAYOUT':
      return 'La transferencia al propietario se edita desde su celda en la planilla.'
    case 'RENT_IN':
    case 'RENT_NF_IN':
      return 'El alquiler se edita desde las celdas Alquiler / Fecha banco de la planilla.'
    default:
      return 'Este importe (Otros) se edita desde su celda en la planilla, no desde Movimientos.'
  }
}
