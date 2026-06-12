// ============================================================================
// FormError — the red error banner shown at the bottom of edit forms when
// a server action returns { ok: false, error }.
// Used inside `grid grid-cols-1 sm:grid-cols-2` forms — spans both cols.
// ============================================================================

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
      {message}
    </p>
  )
}
