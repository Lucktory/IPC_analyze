// ============================================================================
// Owner type (admin / administrator / landlord / unknown) — the four flavors
// of "who owns this bank account / record".
//
// The DB exposes three nullable FKs (administration_id, administrator_id,
// landlord_id) and exactly one is set at a time. The same derivation +
// labeling logic was duplicated in queries.ts files; this module centralizes it.
// ============================================================================

export type OwnerType = 'admin' | 'administrator' | 'landlord' | 'unknown'

/** Plain Spanish role label — used in tables and filter chips. */
export const OWNER_TYPE_LABEL: Record<OwnerType, string> = {
  admin:         'Administración',
  administrator: 'Socio',
  landlord:      'Propietario',
  unknown:       'Sin asignar',
}

/**
 * Fallback display name when the FK-joined record has no `name` field.
 * For example, when a row references administrator_id but the
 * `administrators(name)` join came back null.
 */
const OWNER_FALLBACK: Record<OwnerType, string> = {
  admin:         'Pampa Administración',
  administrator: '(socio)',
  landlord:      '(propietario)',
  unknown:       '(sin dueño asignado)',
}

/**
 * Derive `[ownerType, ownerLabel]` from a Supabase row that has the three
 * owner FKs and the joined name fields. Returns the joined name when
 * available, otherwise the type-specific fallback.
 */
export function deriveOwner(row: {
  administration_id?:  string | null
  administrator_id?:   string | null
  landlord_id?:        string | null
  administrations?:    { name?: string | null } | null
  administrators?:     { name?: string | null } | null
  landlords?:          { name?: string | null } | null
}): { ownerType: OwnerType; ownerLabel: string } {
  if (row.administration_id) {
    return {
      ownerType:  'admin',
      ownerLabel: row.administrations?.name ?? OWNER_FALLBACK.admin,
    }
  }
  if (row.administrator_id) {
    return {
      ownerType:  'administrator',
      ownerLabel: row.administrators?.name ?? OWNER_FALLBACK.administrator,
    }
  }
  if (row.landlord_id) {
    return {
      ownerType:  'landlord',
      ownerLabel: row.landlords?.name ?? OWNER_FALLBACK.landlord,
    }
  }
  return {
    ownerType:  'unknown',
    ownerLabel: OWNER_FALLBACK.unknown,
  }
}
