// ============================================================================
// Location cleanup shim.
//
// During the initial import, EVERY property's city/province was bulk-set to the
// placeholder "CABA" / "Buenos Aires" — a geographically impossible pair (CABA
// is the Ciudad Autonoma de Buenos Aires, which is NOT part of Buenos Aires
// province). The real localities were never captured, so we treat that exact
// placeholder as "unknown" instead of asserting a wrong location on every page
// (Pendientes, Propiedades, Inquilinos, Contratos, Bancos).
//
// This is a DISPLAY shim, not a data change. Remove it once real city data is
// entered, or the placeholder is cleared in the DB (db/fix-placeholder-city.sql).
// ============================================================================

const PLACEHOLDER_CITY     = 'CABA'
const PLACEHOLDER_PROVINCE = 'BUENOS AIRES'

/** True when a city value is the known bulk-import placeholder. */
export function isPlaceholderCity(city: string | null | undefined): boolean {
  return !!city && city.trim().toUpperCase() === PLACEHOLDER_CITY
}

/** The city to display, or null when it's the known placeholder / empty. */
export function displayCity(city: string | null | undefined): string | null {
  return !city || isPlaceholderCity(city) ? null : city
}

/**
 * The province to display, or null. When the city is the known placeholder the
 * whole location block is bogus, so a paired placeholder province is dropped too.
 */
export function displayProvince(
  province: string | null | undefined,
  city?: string | null | undefined,
): string | null {
  if (!province) return null
  if (isPlaceholderCity(city) && province.trim().toUpperCase() === PLACEHOLDER_PROVINCE) return null
  return province
}
