// ============================================================================
// `lib/shared/` — the function registry.
//
// EVERY shared helper (validation, math, ids, formatting that's not already
// in `lib/format.ts`) lives in a topic file under this folder and is
// re-exported here. Both server actions and client components import from
// `@/lib/shared` — one path, no duplication.
//
// Add a new helper? Pick the right topic file (or create a new one) and
// add the export below. Never inline `const FOO = 0.05` again.
//
// Topic files today:
//   • percentages.ts — sum / valid / epsilon for "must total 100" rules
//   • ids.ts         — local UI ids for dynamic rows
// ============================================================================

export * from './percentages'
export * from './ids'
