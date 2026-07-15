// ============================================================================
// Audit humanizers — pure functions (no server imports) used by the UI to turn
// raw audit rows into readable Who/Action/Details. Imported by client code.
// ============================================================================

import type { AuditEntry } from './types'

export type Tone = 'success' | 'info' | 'danger' | 'neutral'

const ACTION_META: Record<string, { label: string; tone: Tone }> = {
  insert:            { label: 'Creo',           tone: 'success' },
  update:            { label: 'Edito',          tone: 'info' },
  delete:            { label: 'Elimino',        tone: 'danger' },
  login:             { label: 'Inicio sesion',  tone: 'neutral' },
  logout:            { label: 'Cerro sesion',   tone: 'neutral' },
  signup:            { label: 'Alta de usuario',tone: 'success' },
  'user.create':     { label: 'Creo usuario',   tone: 'success' },
  'user.update':     { label: 'Edito usuario',  tone: 'info' },
  'user.delete':     { label: 'Elimino usuario',tone: 'danger' },
  'user.role_change':{ label: 'Cambio rol',     tone: 'info' },
  'user.activate':   { label: 'Activo usuario', tone: 'info' },
  'user.deactivate': { label: 'Desactivo usuario', tone: 'info' },
  'user.photo':      { label: 'Cambio foto',    tone: 'info' },
  'password.change': { label: 'Cambio clave',   tone: 'info' },
}

export function actionMeta(action: string): { label: string; tone: Tone } {
  return ACTION_META[action] ?? { label: action, tone: 'neutral' }
}

const ENTITY_LABEL: Record<string, string> = {
  contracts: 'Contrato', transactions: 'Movimiento', liquidaciones: 'Liquidacion',
  liquidacion_lines: 'Linea de liquidacion', adjustments: 'Aumento',
  contract_landlords: 'Propietario de contrato', contract_tenants: 'Inquilino de contrato',
  contract_administrators: 'Administrador de contrato', contract_period_notes: 'Nota de periodo',
  contract_events: 'Observacion', contract_recurring_charges: 'Recargo',
  properties: 'Propiedad', property_landlords: 'Propietario de propiedad',
  landlords: 'Propietario', tenants: 'Inquilino', banks: 'Banco', bank_accounts: 'Cuenta bancaria',
  usuarios: 'Usuario', session: 'Sesion', auth: 'Cuenta',
}

export function entityBase(entityType: string): string {
  return ENTITY_LABEL[entityType] ?? entityType
}

/** Friendly entity name, e.g. "Contrato C-2026-0045". */
export function entityLabel(entry: AuditEntry): string {
  const base = entityBase(entry.entityType)
  if (entry.entityType === 'session') return 'Sesion'
  const j = (entry.after ?? entry.before ?? {}) as Record<string, unknown>
  const friendly = (j.contract_number || j.name || j.label || j.code) as string | undefined
  if (friendly) return `${base} ${friendly}`
  if (entry.entityId) return `${base} (${String(entry.entityId).slice(0, 8)})`
  return base
}

const FIELD_LABELS: Record<string, string> = {
  current_rent: 'Alquiler', rent_facturado_neto: 'Alquiler facturado (neto)', rent_no_facturado: 'Alquiler N/F',
  rent_iva_rate: 'IVA alquiler', expensas: 'Expensas', commission_pct: 'Comision %',
  commission_includes_iva: 'Comision con IVA', commission_base: 'Base de comision', commission_destination: 'Banco comision',
  amount: 'Monto', period: 'Periodo', bank_date: 'Fecha banco', description: 'Descripcion',
  status: 'Estado', start_date: 'Desde', end_date: 'Hasta', next_adjustment_date: 'Prox. aumento',
  full_name: 'Nombre', email: 'Email', phone: 'Telefono', dni: 'DNI', role: 'Rol', active: 'Activo', photo_url: 'Foto',
  name: 'Nombre', label: 'Etiqueta', ownership_pct: '% propiedad', share_pct: '% parte',
  old_rent: 'Alquiler anterior', new_rent: 'Alquiler nuevo', factor: 'Factor',
  contract_number: 'Contrato', lfa_code: 'LFA', recupero_type_code: 'Tipo', interval_months: 'Frecuencia (meses)',
  is_commercial: 'Comercial', active_bool: 'Activo',
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'administration_id', 'transaction_type_id'])

export interface DiffRow { label: string; field: string; before: unknown; after: unknown; changed: boolean }

/** The rows shown in the expanded before/after panel. */
export function diffRows(entry: AuditEntry): DiffRow[] {
  const a = (entry.after ?? {}) as Record<string, unknown>
  const b = (entry.before ?? {}) as Record<string, unknown>
  const created = entry.action === 'insert' || entry.action === 'user.create' || entry.action === 'signup'
  const deleted = entry.action === 'delete' || entry.action === 'user.delete'

  if (created) {
    return Object.keys(a).filter(k => !SKIP_FIELDS.has(k) && a[k] !== null && a[k] !== '')
      .map(k => ({ label: fieldLabel(k), field: k, before: null, after: a[k], changed: true }))
  }
  if (deleted) {
    return Object.keys(b).filter(k => !SKIP_FIELDS.has(k) && b[k] !== null && b[k] !== '')
      .map(k => ({ label: fieldLabel(k), field: k, before: b[k], after: null, changed: true }))
  }
  // update: only fields that actually changed
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  const rows: DiffRow[] = []
  for (const k of keys) {
    if (SKIP_FIELDS.has(k)) continue
    if (JSON.stringify(b[k]) === JSON.stringify(a[k])) continue
    rows.push({ label: fieldLabel(k), field: k, before: b[k], after: a[k], changed: true })
  }
  return rows
}

/** One-line description shown under the entity name. */
export function summarize(entry: AuditEntry): string {
  if (entry.summary) return entry.summary
  const base = entityBase(entry.entityType)
  if (entry.action === 'insert') return `Nuevo ${base.toLowerCase()} creado`
  if (entry.action === 'delete') return `${base} eliminado`
  if (entry.action === 'update') {
    const d = diffRows(entry)
    if (d.length === 1) return `Actualizo ${d[0].label.toLowerCase()}`
    if (d.length > 1) return `Actualizo ${d.length} campos`
    return `Actualizo ${base.toLowerCase()}`
  }
  return actionMeta(entry.action).label
}

/** Render a stored value for display. */
export function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'Sin valor'
  if (typeof v === 'boolean') return v ? 'Si' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
