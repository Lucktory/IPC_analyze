'use server'

// ============================================================================
// Landlord email bulk-import — Alejandro periodically sends a list of
// landlord names with their emails (sometimes two per row, sometimes the
// email belongs to a spouse or external accountant). This module handles
// the paste-and-apply flow used by /propietarios/cargar-emails:
//
//   previewEmailImport(text)   — parse + match against DB, return preview
//   applyEmailImport(decisions) — commit the user's accepted matches
//
// Tolerates any of these line formats (one landlord per line):
//   "NAME    email@x.com"
//   "NAME | email1@x.com | email2@x.com"
//   "NAME    email1@x.com / email2@x.com"
//   "NAME, email@x.com"
// Plus arbitrary whitespace / tab separators.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'

const EMAIL_REGEX = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g

export interface PreviewLine {
  /** 1-based index of the line in the pasted text. Lets the UI reference it. */
  lineNumber:   number
  /** Original line as pasted. */
  rawText:      string
  /** Name extracted from the line (everything that wasn't an email or
   *  separator). Empty when nothing readable was left. */
  parsedName:   string
  /** Emails extracted from the line. First one will become the primary;
   *  the rest go into landlords.alt_emails. */
  emails:       string[]
  /** Top matches in the landlords table, ranked by similarity to parsedName.
   *  The UI lets the user pick one (or "skip"). */
  candidates:   { id: string; name: string; currentEmail: string | null; similarity: number }[]
  /** True when at least one candidate's name is essentially identical to
   *  parsedName (no manual review needed for the common case). */
  hasExactMatch: boolean
}

export interface PreviewResult {
  lines: PreviewLine[]
  /** Lines that couldn't be parsed (no email found). */
  skippedLines: { lineNumber: number; rawText: string; reason: string }[]
}

export async function previewEmailImport(rawText: string): Promise<PreviewResult> {
  try {
    const supabase = await createSupabaseServer()
    const { data: landlordRows } = await supabase
      .from('landlords')
      .select('id, name, email')
      .order('name')
    const landlords = ((landlordRows ?? []) as any[]).map(l => ({
      id:           String(l.id),
      name:         String(l.name ?? ''),
      currentEmail: l.email as string | null,
    }))

    const result: PreviewResult = { lines: [], skippedLines: [] }
    const lines = rawText.split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]
      const trimmed = raw.trim()
      if (!trimmed) continue

      const emails = trimmed.match(EMAIL_REGEX) ?? []
      if (emails.length === 0) {
        result.skippedLines.push({
          lineNumber: i + 1,
          rawText:    raw,
          reason:     'No se encontró ningún email en la línea.',
        })
        continue
      }

      // Strip the emails out of the line to leave the name + separators.
      let nameText = trimmed
      for (const e of emails) nameText = nameText.replace(e, '')
      // Collapse separators (tabs, multiple spaces, pipes, slashes, commas)
      // into single spaces, then trim.
      nameText = nameText.replace(/[\t|,/]+/g, ' ').replace(/\s+/g, ' ').trim()

      // Match: rank landlords by similarity to the parsed name.
      const ranked = landlords
        .map(l => ({ ...l, similarity: nameSimilarity(nameText, l.name) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
      const hasExactMatch = ranked[0] && ranked[0].similarity >= 0.95

      result.lines.push({
        lineNumber:    i + 1,
        rawText:       raw,
        parsedName:    nameText,
        emails:        emails.map(e => e.toLowerCase()),
        candidates:    ranked.map(r => ({
          id:           r.id,
          name:         r.name,
          currentEmail: r.currentEmail,
          similarity:   r.similarity,
        })),
        hasExactMatch: !!hasExactMatch,
      })
    }

    return result
  } catch (err) {
    console.error('[previewEmailImport] failed:', err)
    return { lines: [], skippedLines: [] }
  }
}

// One decision per pasted line. The UI sends back the lineNumber so we can
// match it up against the original paste; the rest is what to do with it.
export interface ApplyDecision {
  lineNumber:    number
  landlordId:    string | null   // null = skip this line
  primaryEmail:  string
  altEmails:     string[]
}

export interface ApplyResult {
  ok:     boolean
  error:  string | null
  /** Per-row outcome — surfaced in the UI so the user sees what changed. */
  applied: { landlordId: string; landlordName: string; email: string; altCount: number }[]
  skipped: { landlordId: string; reason: string }[]
}

export async function applyEmailImport(decisions: ApplyDecision[]): Promise<ApplyResult> {
  const result: ApplyResult = { ok: true, error: null, applied: [], skipped: [] }
  try {
    const supabase = await createSupabaseServer()

    for (const d of decisions) {
      if (!d.landlordId)                     continue
      if (!d.primaryEmail || !d.primaryEmail.includes('@')) {
        result.skipped.push({ landlordId: d.landlordId, reason: 'Email primario inválido.' })
        continue
      }
      // Fetch the current row so we can compare and (optionally) preserve
      // existing alt_emails the user didn't replace.
      const { data: existing, error: fetchErr } = await supabase
        .from('landlords')
        .select('name, email, alt_emails')
        .eq('id', d.landlordId)
        .maybeSingle()
      if (fetchErr || !existing) {
        result.skipped.push({ landlordId: d.landlordId, reason: 'Propietario no encontrado.' })
        continue
      }
      const { error: updErr } = await supabase
        .from('landlords')
        .update({
          email:      d.primaryEmail.toLowerCase().trim(),
          alt_emails: d.altEmails.map(e => e.toLowerCase().trim()).filter(Boolean),
        })
        .eq('id', d.landlordId)
      if (updErr) {
        result.skipped.push({ landlordId: d.landlordId, reason: updErr.message })
        continue
      }
      result.applied.push({
        landlordId:   d.landlordId,
        landlordName: String((existing as any).name ?? ''),
        email:        d.primaryEmail,
        altCount:     d.altEmails.length,
      })
    }

    revalidatePath('/propietarios')
    return result
  } catch (err) {
    console.error('[applyEmailImport] failed:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error inesperado.',
      applied: result.applied,
      skipped: result.skipped,
    }
  }
}

// ── Name-similarity helper ───────────────────────────────────────────────────
// Cheap fuzzy match: normalize both strings (lowercase, strip accents and
// non-alphanumerics) and use the Dice coefficient over character bigrams.
// Good enough for "ALASSIA JOSE LUIS" vs "ALASSIA, JOSE LUIS" vs "alassia jose"
// — picks the right row 99% of the time, doesn't need a full Levenshtein.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb)   return 0
  if (na === nb)    return 1
  // Token-containment short-circuit: every token of the shorter string is
  // present in the longer one → high score.
  const ta = na.split(' ')
  const tb = nb.split(' ')
  const shorter = ta.length <= tb.length ? ta : tb
  const longer  = shorter === ta ? tb : ta
  const allIn   = shorter.every(t => longer.includes(t))
  if (allIn && shorter.length >= 2) return 0.95
  // Dice coefficient on bigrams.
  const A = bigrams(na)
  const B = bigrams(nb)
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return A.size + B.size === 0 ? 0 : (2 * inter) / (A.size + B.size)
}
