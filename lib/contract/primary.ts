// ============================================================================
// pickPrimaryLandlord — single rule for "the representative landlord" of a
// contract. There is no is_primary column for landlords, so consumers derive it
// from contract_landlords by highest ownership_pct. Four call sites already
// sorted; the dashboard one took [0] unsorted (and didn't even fetch
// ownership_pct), so a 70/30 contract could show the 30% owner there and the
// 70% owner everywhere else. All consumers now share this.
// ============================================================================

// Accepts/returns the untyped supabase junction rows the query files already
// pass around (each row is { ownership_pct, landlords: {…} }).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickPrimaryLandlord(rows: any[] | null | undefined): any {
  if (!rows || rows.length === 0) return undefined
  return [...rows].sort((a, b) => Number(b.ownership_pct ?? 0) - Number(a.ownership_pct ?? 0))[0]
}
