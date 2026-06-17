// ============================================================================
// import-from-sheet.ts — Parses client-data/alejandro-sheet.csv and emits
//   db/seed-from-sheet.sql  (INSERT statements ready for Supabase SQL Editor)
//   db/seed-report.txt      (human-readable summary of what was parsed)
//
// Run:  npm run import-sheet
// ============================================================================

import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// 1. CSV parser (handles quoted multi-line cells — needed because Alejandro's
//    sheet has embedded newlines inside cells)
// ---------------------------------------------------------------------------
function parseCSV(text: string): string[][] {
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else inQuotes = false
      } else cell += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(cell); cell = '' }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else cell += ch
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows
}

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------
function parseAmount(raw: string): number | null {
  if (!raw) return null
  // Argentine format: "$ 1.010.543,17" → thousand sep "." decimal sep ","
  const cleaned = raw.replace(/\s/g, '').replace(/\$/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  if (!isFinite(n)) return null
  return n
}

// Extract the FIRST $-amount mentioned in a free-text cell (DEUDA column).
// Used as fallback when INGRESOS is missing or shows a partial payment.
// Pattern: $1.010.543,17 / $722.505 / $864.924,86 / $ 960.000
function extractFirstAmount(text: string): number | null {
  if (!text) return null
  const m = text.match(/\$\s*([\d][\d.]*(?:,\d{1,2})?)/)
  if (!m) return null
  const cleaned = m[1].replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isFinite(n) && n > 0 ? n : null
}

// When DEUDA contains an ARREARS TABLE (PASCUAL-style: month names followed by
// monthly rents in chronological order), the LATEST listed rent is the current
// monthly rent — not the first. Detected by the presence of >= 2 Spanish month
// names in the cell. Returns the last $-amount that follows a month name.
function extractCurrentRentFromArrears(text: string): number | null {
  if (!text) return null
  const monthRx = /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/gi
  const months = text.match(monthRx) || []
  if (months.length < 2) return null
  // Find the last "<month> ... $amount" occurrence
  const rx = /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)[^$]*\$\s*([\d][\d.]*(?:,\d{1,2})?)/gi
  let last: string | null = null
  for (const m of text.matchAll(rx)) last = m[2]
  if (!last) return null
  const cleaned = last.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isFinite(n) && n > 0 ? n : null
}

function sqlString(v: string | null | undefined): string {
  if (v == null) return 'null'
  return `'${v.replace(/'/g, "''")}'`
}

function sqlNumber(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'null'
  return v.toString()
}

function sqlDate(v: string | null | undefined): string {
  if (!v) return 'null'
  return `'${v}'::date`
}

// Detect cadence from free text
function detectCadence(text: string): string | null {
  const t = text.toUpperCase()
  if (/CUATRIMESTRAL/.test(t)) return 'cuatrimestral'
  if (/TRIMESTRAL/.test(t)) return 'trimestral'
  if (/SEMESTRAL/.test(t)) return 'semestral'
  if (/BIMESTRAL/.test(t)) return 'bimestral'
  if (/MENSUAL/.test(t)) return 'mensual'
  if (/ANUAL/.test(t)) return 'anual'
  // Numeric forms — "IPC 4 MESES" → cuatrimestral, etc.
  if (/\b4\s*MESES\b/.test(t)) return 'cuatrimestral'
  if (/\b3\s*MESES\b/.test(t)) return 'trimestral'
  if (/\b6\s*MESES\b/.test(t)) return 'semestral'
  if (/\b2\s*MESES\b/.test(t)) return 'bimestral'
  if (/\b12\s*MESES\b/.test(t)) return 'anual'
  return null
}

// Snap a (year, month, day) to a valid calendar date. If day exceeds the
// month's last day (e.g. 29/02/2025 — Alejandro wrote a Feb 29 in a non-leap
// year), clamp down to the actual last day of the month. Returns null for
// out-of-range months/years.
function snapToValidDate(year: number, month: number, day: number): string | null {
  if (!isFinite(year) || !isFinite(month) || !isFinite(day)) return null
  if (year < 1900 || year > 2100) return null
  if (month < 1 || month > 12) return null
  // new Date(y, m, 0) returns the LAST day of the previous month, so passing
  // month directly (1-indexed) gives us the last day of `month` itself.
  const lastDay = new Date(year, month, 0).getDate()
  const actualDay = Math.max(1, Math.min(day, lastDay))
  return `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`
}

// Parse date range like "01/11/2024 - 31/10/2026". Handles missing separator
// too — Alejandro sometimes writes "01/12/2024 30/11/2026" without a dash.
// Strategy: find ALL dd/mm/yyyy occurrences; if two are present, treat the
// first as start and the second as end.
function parseDateRange(raw: string): { start: string | null; end: string | null } {
  if (!raw) return { start: null, end: null }
  const matches = [...raw.matchAll(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/g)]
  if (matches.length >= 2) {
    const m1 = matches[0]
    const m2 = matches[1]
    return {
      start: snapToValidDate(+m1[3], +m1[2], +m1[1]),
      end:   snapToValidDate(+m2[3], +m2[2], +m2[1]),
    }
  }
  if (matches.length === 1) {
    const m = matches[0]
    return { start: snapToValidDate(+m[3], +m[2], +m[1]), end: null }
  }
  return { start: null, end: null }
}

// Extract phone like (+54 9 2974 08-3065) from a free-text blob
function extractPhone(raw: string): string | null {
  const m = raw.match(/\+?54\s*9?\s*\d{3,4}\s*\d{2,3}[-\s]?\d{4,}/)
  if (m) return m[0].replace(/\s+/g, ' ').trim()
  const m2 = raw.match(/\(\s*(\d{7,})\s*\)/)
  if (m2) return m2[1]
  return null
}

// Strip noise markers from a person name: (F), (f), FLOR (manager codes), trailing
// notes after first newline, etc. Returns a clean uppercase-ish canonical name.
function firstNonEmptyLine(raw: string): string {
  for (const line of raw.split('\n')) {
    if (line.trim()) return line
  }
  return ''
}

function cleanName(raw: string): string {
  if (!raw) return ''
  let s = firstNonEmptyLine(raw)            // first non-empty line
  // Strip everything after the first paren (phones, codes)
  const parenIdx = s.indexOf('(')
  if (parenIdx > 0) s = s.slice(0, parenIdx)
  // Strip cadence + adjustment keywords (these often run inline with the name)
  s = s.replace(/\b(TRIMESTRAL|CUATRIMESTRAL|BIMESTRAL|SEMESTRAL|MENSUAL|ANUAL|ANUALES)\b.*/gi, '')
  s = s.replace(/\bSEGUN\s+IPC\b.*/gi, '')
  s = s.replace(/\bPROX(?:\.|IMO)?\s*AUMENTO.*/gi, '')
  s = s.replace(/\bAUMENTO\b.*/gi, '')
  s = s.replace(/\bIPC\b.*/gi, '')
  s = s.replace(/\bVTO\.?\s*CONTRATO.*/gi, '')
  s = s.replace(/\bCBU\b.*/gi, '')          // CBU + everything after
  s = s.replace(/\bAlias\b.*/gi, '')
  s = s.replace(/\bCUIT\b.*/gi, '')         // CUIT + everything after
  s = s.replace(/IVA\s+RESPONSABLE.*/gi, '')
  s = s.replace(/\bFINALIZA\b.*/gi, '')
  s = s.replace(/\bTITULARES?\b.*/gi, '')
  s = s.replace(/\b(?:FACTURAN|FACTURA)\b.*/gi, '')
  // Strip noise markers
  s = s.replace(/\+?54\s*9?\s*\d{3,4}\s*\d{2,3}[-\s]?\d{4,}/g, '') // bare phone runs
  s = s.replace(/\(\s*[FfAaLl]\s*\)/g, '')  // (F), (f), (A), (L)
  s = s.replace(/\bFLOR\b/g, '')            // FLOR marker
  s = s.replace(/\bFLAVIO\b/g, '')          // sometimes manager name appended
  // Building/apartment identifiers that get baked into Alejandro's landlord
  // names (TYPAC building has units 6°J, 8°H, etc.) — these belong on the
  // property, not the landlord, so strip them for dedup. Real example:
  // "CHIOCARELLO MARIANA TYPAC 6° J" + "CHIOCARELLO MARIANA TYPAC 8°H"
  // should both dedup to "CHIOCARELLO MARIANA".
  s = s.replace(/\bTYPAC\s+\d+\s*[°ºo]?\s*[A-Z]?\b/gi, '')
  // Strip "-----<text>" property-identifier suffix (2+ dashes followed by
  // free text means Alejandro tacked on a property label). Example:
  // "MEDINA BEATRIZ-----COCHERA Nº" → "MEDINA BEATRIZ". Single dashes like
  // "CORDOBA MARIELA- CROCE" are NOT touched (they separate distinct names).
  s = s.replace(/\s*-{2,}.*$/g, '')
  // Strip "<name>- <many spaces> <property location>" — Alejandro sometimes
  // writes the address on the same line as the landlord, separated by a dash
  // and lots of spaces. Example: "MEDINA BEATRIZ-                  DPTO BS AS
  // PARANA 11 D, BAULERA Nº3" → "MEDINA BEATRIZ". The 3+ space threshold
  // protects normal co-owner patterns like "CORDOBA MARIELA- CROCE".
  s = s.replace(/-\s{3,}.+$/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  // Strip trailing/leading separators
  s = s.replace(/^[-\/|,\s]+|[-\/|,\s]+$/g, '').trim()
  return s
}

// Heuristic: is this string a real person/company name (vs a note)?
function looksLikeName(s: string): boolean {
  if (!s) return false
  if (s.length < 3) return false
  if (s.length > 80) return false                       // long strings = notes
  // Header literals + property-type words that appear standalone after a "/"
  // separator (e.g. "VIGLIANCO NOELIA/ VIVIENDA" — VIVIENDA = "dwelling" in
  // Spanish, not a person). Property classifications belong on the property
  // record, not as a co-tenant.
  if (/^(PROPIETARIOS|INQUILINOS|VACIO|VAC[ÍI]O|SIN|VIVIENDA|COMERCIAL|LOCAL|OFICINA|COCHERA|DEPOSITO|MONOAMBIENTE)$/i.test(s)) return false
  // "EX X" pattern = former tenant note, e.g. "(EX CASTELLANI)" appears as a
  // historical reference next to the current tenant; do not record as a person.
  // Strip parens before checking — the cleaned name might still be "(EX
  // CASTELLANI)" with parens intact since cleanName only strips at first
  // paren when parenIdx > 0.
  const stripped = s.replace(/[()]/g, '').trim()
  if (/^EX\s+\w/i.test(stripped)) return false
  // Sentences (contain verbs/connectors typical of free text)
  if (/\b(SE\s+LE|SE\s+DESCUENTA|SE\s+TRANSFIERE|DEBE\s+SALDO|CORRESPOND|TRANSFIERE|RESCISION|RESCINDE)\b/i.test(s)) return false
  if (/\b(POR\s+LO\s+TANTO|ENVIA|DESCONTAR|HACERSE)\b/i.test(s)) return false
  // More prose markers (caught by LJUBICIC's PROPIETARIOS cell full of notes)
  if (/\b(INFORMADA|INFORMAR|REENVIAR|MANTENER|REVISAR|FACTURACION|INQUILINOS)\b/i.test(s)) return false
  // Long word counts indicate prose, not a name. Real names rarely exceed 6
  // tokens. AGRELLO MAURO PAULO MATIAS JORGE is already 5 tokens, leave room.
  if (s.split(/\s+/).filter(Boolean).length > 6) return false
  // Must contain at least one letter run of 3+ chars
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(s)) return false
  return true
}

// Split landlord cell into co-owners. Separators: "/", " Y ", "|"
function splitLandlords(raw: string): string[] {
  if (!raw) return []
  const first = firstNonEmptyLine(raw)
  // Two-stage split:
  //   1) Split on "/" and "|" — these separate co-owners with DIFFERENT
  //      surnames (e.g. "LEIVA ADRIANA / KRUSE FLAVIO" — Krause is not a
  //      Leiva). Surname-borrow is wrong here.
  //   2) Within each part, split on " Y " — these are co-owners with the
  //      SAME surname (e.g. "BIRKHOFER MONICA Y SONIA"). Borrow OK here.
  //   The two-stage split also avoids matching a stray "Y" inside prose
  //   (e.g. LJUBICIC cell with "...revisar importe Y reenviar..." which
  //   used to create a fake landlord called "reenviar LJUBICIC").
  const slashGroups = first.split(/\s*[\/|]\s*/)
  const allParts: string[] = []
  for (const group of slashGroups) {
    const yParts = group.split(/\s+Y\s+/i).map(cleanName).filter(looksLikeName)
    if (yParts.length >= 2) {
      const multiWord = yParts.find(p => p.split(/\s+/).length >= 2)
      if (multiWord) {
        const surname = multiWord.split(/\s+/)[0]
        for (let i = 0; i < yParts.length; i++) {
          const tokens = yParts[i].split(/\s+/)
          if (tokens.length === 1 && tokens[0] !== surname) {
            yParts[i] = `${surname} ${tokens[0]}`
          }
        }
      }
    }
    allParts.push(...yParts)
  }
  return [...new Set(allParts)]
}

// Split tenant cell into co-tenants. Separators: "|", "/", "//"
// Returns true if the tenant cell represents a vacant property or
// otherwise-not-a-real-tenant marker. The schema models vacancies as
// properties without contracts, so we skip the contract creation here.
function isVacantOrNotManaged(raw: string): boolean {
  const first = (raw || '').split('\n')[0].toUpperCase()
  if (/\bVAC[IÍ]?[OA]\b/.test(first)) return true              // VACIO, VACÍA, VACIA
  if (/\bLOCAL\s+VAC/.test(first)) return true                  // LOCAL VACIO
  if (/^[\dABC]+\s+VAC/.test(first)) return true                // "2B VACIO", "3A VACIO"
  if (/^[\dABC]+\s+HIJA?\b/.test(first)) return true            // "1A HIJA ADRIAN"
  if (/ALQUILADO\s+POR\s+ELLOS/.test(first)) return true        // owner-managed
  if (/MONOAMBIENTE.*RADA\s+TILLY/.test(first)) return true     // vacant monoambiente note
  if (/^DUPLEX\b/.test(first)) return true                      // property-only nickname
  return false
}

function splitTenants(raw: string): string[] {
  if (!raw) return []
  const first = firstNonEmptyLine(raw)
  // Reject vacant marker and header literal
  if (/^\s*(VACIO|VAC[ÍI]O|INQUILINOS)\s*$/i.test(first)) return []
  if (isVacantOrNotManaged(raw)) return []
  // Remove the COMERCIAL marker before splitting
  const cleaned = first.replace(/\/+\s*COMERCIAL/gi, '')
  const parts = cleaned.split(/\s*\|\s*|\s*\/+\s*/).map(cleanName).filter(looksLikeName)
  return [...new Set(parts)]
}

// Detect property type from tenant free text
function detectPropertyType(tenantText: string): string {
  const t = tenantText.toUpperCase()
  if (/\bCOMERCIAL\b|\bLOCAL\b/.test(t)) return 'local'
  if (/\bOFICINA\b/.test(t)) return 'oficina'
  if (/\bCOCHERA\b/.test(t)) return 'cochera'
  if (/\bDEPOSITO\b/.test(t)) return 'deposito'
  return 'vivienda'
}

// Extract a property address from the tenant cell when one is clearly present.
// Pattern A: address in parentheses, e.g. "RODIÑO MARIA (ameghino 580 DEPTO N°1)"
// Pattern B: street name + DEPTO in free text, e.g. "LUDUEÑA AMEGHINO 580 DEPTO 3"
// Returns null when no confident match — caller falls back to "Propiedad de
// <landlord>". Conservative: phones, gender markers, and plain numeric IDs are
// rejected.
function extractAddressFromTenantCell(raw: string): string | null {
  if (!raw) return null
  const firstLine = raw.split('\n')[0]

  // Pattern A — parenthetical with address keyword
  const parens = [...firstLine.matchAll(/\(([^)]+)\)/g)]
  for (const m of parens) {
    const inside = m[1].trim()
    if (/\+?54|^\d{4}[-\s]?\d/.test(inside)) continue            // phone
    if (/^[FfAaLl]$/.test(inside)) continue                       // gender marker
    if (/^\d{6,}$/.test(inside)) continue                         // bare number
    if (/^FACTURAN?$/i.test(inside)) continue                     // invoicing note
    // Address indicators
    if (/depto|piso|n°|avda|avenida|\bcalle\b/i.test(inside)) return cleanAddress(inside)
    // Known street/building names from this dataset
    if (/\b(ameghino|polonia|alamos|chacabuco|ang[oó]n|rada\s+tilly|tipuana?|typac)\b/i.test(inside)) {
      return cleanAddress(inside)
    }
  }

  // Pattern B — free text after the tenant name contains street + apartment
  // e.g. "LUDUEÑA MICAELA (+54...) AMEGHINO 580 DEPTO 3 TRIMESTRAL..."
  const afterParens = firstLine.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ')
  const m = afterParens.match(
    /\b(AMEGHINO|POLONIA|ALAMOS|CHACABUCO|ANG[ÓO]N|RADA\s+TILLY|TIPUANA?|TYPAC)\s+\d+[\d\s°ºA-Za-z\-]*(?:DEPTO\s+\S+)?/i
  )
  if (m) return cleanAddress(m[0])

  return null
}

function cleanAddress(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s,\-]+|[\s,\-]+$/g, '')
    .trim()
}

// Map L/F/A code to administrator name
function partnerFromCode(code: string): string[] {
  const c = (code || '').trim().toUpperCase()
  if (c === 'F') return ['Flavio H.']
  if (c === 'L') return ['Lisa H.']
  if (c === 'A') return ['Alejandro H.']
  if (c === 'FL') return ['Flavio H.', 'Lisa H.']
  if (c === 'D') return ['Dorso']
  return []
}

// Map bank-name text from column 2 → seeded bank short_code
function detectBank(raw: string): string | null {
  if (!raw) return null
  const t = raw.toUpperCase()
  if (/GALICIA/.test(t)) return 'GALICIA'
  if (/SANTANDER/.test(t)) return 'SANTANDER'
  if (/MACRO/.test(t)) return 'MACRO'
  if (/BBVA|FRANC[EÉ]S/.test(t)) return 'BBVA' // Frances was acquired by BBVA
  if (/NACI[OÓ]N/.test(t)) return 'NACION'
  if (/PROVINCIA/.test(t)) return 'PROVINCIA'
  if (/CIUDAD/.test(t)) return 'CIUDAD'
  if (/PATAGONIA/.test(t)) return 'PATAGONIA'
  if (/HIPOTECARIO/.test(t)) return 'HIPOTECARIO'
  if (/SUPERVIELLE/.test(t)) return 'SUPERVIELLE'
  if (/ITA[UÚ]/.test(t)) return 'ITAU'
  if (/CREDICOOP/.test(t)) return 'CREDICOOP'
  if (/ICBC/.test(t)) return 'ICBC'
  if (/COMAFI/.test(t)) return 'COMAFI'
  if (/RIO|R[ÍI]O/.test(t)) return 'SANTANDER' // Banco Rio rebranded to Santander Rio
  return null
}

// Classify a row's PERIODO/description into a transaction_type code.
// Returns null if it's not a transaction row (totals, blank, etc.).
function classifyTransaction(periodo: string, descr: string, ingresos: number | null): string | null {
  if (ingresos == null || ingresos <= 0) return null
  const p = (periodo || '').toUpperCase()
  const d = (descr || '').toUpperCase()
  const all = p + ' ' + d
  if (/RESCISI[OÓ]N/.test(all)) return 'OTHER_IN'
  if (/CAMUZZI|METROGAS|GAS\b/.test(all)) return 'METROGAS_OUT'
  if (/EDESUR|EDELAP|ELECTRIC/.test(all)) return 'EDESUR_OUT'
  if (/AYSA|AGUA/.test(all)) return 'AYSA_OUT'
  if (/ABL|TASA/.test(all)) return 'ABL_OUT'
  if (/AFIP/.test(all)) return 'AFIP_OUT'
  if (/SEGURO/.test(all)) return 'INSURANCE_OUT'
  if (/DEP[OÓ]SITO|DEPOSITO|GARANTIA/.test(all)) return 'DEPOSIT_IN'
  if (/MAYO|ABRIL|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE|ENERO|FEBRERO|MARZO|SALDO|A CTA/.test(all)) return 'RENT_IN'
  return 'OTHER_IN'
}

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------
const ROOT = join(import.meta.dirname, '..')
const csvPath = join(ROOT, 'client-data', 'alejandro-sheet.csv')
const outSqlPath = join(ROOT, 'db', 'seed-from-sheet.sql')
const outReportPath = join(ROOT, 'db', 'seed-report.txt')

const csvText = readFileSync(csvPath, 'utf8')
const rows = parseCSV(csvText)

// Column indices (0-based)
const COL = {
  OBSERVACION: 1,
  BANK_TEXT:   1,  // sometimes bank info lives here too
  LFA:         2,
  FECHA_BANCO: 3,
  PROPIETARIOS: 4,
  EXPENSAS:    5,
  INQUILINOS:  6,
  PCT:         7,
  CONTRATO:    8,
  DEUDA:       9,
  PERIODO:     10,
  INGRESOS:    11,
  TRANSFERENCIA: 12,
  OTROS:       13,
  DIA_TRANSF:  14,
  E:           15,
  ADMI:        16,
  ADM_GALICIA: 17,
  ADM_FRANCES_50_9: 18,
  ADM_FRANCES_51_6: 19,
}

// ---------------------------------------------------------------------------
// 4. Entity collectors (dedup by canonical name)
// ---------------------------------------------------------------------------
type LandlordRec = { id: string; name: string }
type TenantRec   = { id: string; name: string; phone: string | null }
type PropertyRec = { id: string; landlord_ids: string[]; address: string; property_type: string }
type ContractRec = {
  id: string
  property_id: string
  landlord_ids: string[]
  tenant_ids: string[]
  administrator_codes: string[]   // raw L/F/A codes
  commission_pct: number
  start_date: string | null
  end_date: string | null
  current_rent: number
  cadence: string | null
  bank_code: string | null
  notes: string
  status: string
}
type TransactionRec = {
  contract_id: string | null
  type_code: string
  amount: number
  period: string | null
  bank_date: string | null
  description: string
}

const landlords = new Map<string, LandlordRec>()
const tenants   = new Map<string, TenantRec>()
const properties: PropertyRec[] = []
const contracts: ContractRec[] = []
const transactions: TransactionRec[] = []

// Aggressive dedup key: uppercase, strip parens + punctuation, collapse spaces.
// "(BIRKHOFER) PEREZ ENRIQUE" and "BIRKHOFER- PEREZ ENRIQUE" both → "BIRKHOFER PEREZ ENRIQUE"
function dedupKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[()\-,.;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Strip enclosing parens + leading/trailing punctuation from display name.
// "(BIRKHOFER) PEREZ ENRIQUE" → "BIRKHOFER PEREZ ENRIQUE"
// "BARTL--COMERCIAL" → "BARTL COMERCIAL"
function cleanDisplayName(name: string): string {
  return name
    .replace(/[()]+/g, ' ')
    .replace(/[-]{2,}/g, ' ')
    .replace(/^[\s\-,]+|[\s\-,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getOrCreateLandlord(name: string): LandlordRec {
  const key = dedupKey(name)
  if (!landlords.has(key)) landlords.set(key, { id: randomUUID(), name: cleanDisplayName(name) })
  return landlords.get(key)!
}

function getOrCreateTenant(name: string, phone: string | null): TenantRec {
  const key = dedupKey(name)
  if (!tenants.has(key)) tenants.set(key, { id: randomUUID(), name: cleanDisplayName(name), phone })
  const t = tenants.get(key)!
  if (!t.phone && phone) t.phone = phone
  return t
}

// ---------------------------------------------------------------------------
// 5. Walk the rows
// ---------------------------------------------------------------------------
const report = {
  totalRows: rows.length,
  skippedMetadata: 0,
  contractsCreated: 0,
  transactionsCreated: 0,
  landlordsInherited: 0,
  ambiguous: [] as string[],
}

let currentLandlordNames: string[] = []
let currentContract: ContractRec | null = null

// Data rows start after the header section. The first row with PROPIETARIOS set
// is row 22 (0-indexed 21). We skip everything before that.
let dataStart = 0
for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  if (!r || r.length < 12) continue
  const landlord = (r[COL.PROPIETARIOS] || '').trim()
  // Skip the header row explicitly
  if (/^PROPIETARIOS$/i.test(landlord)) continue
  const hasTenant = (r[COL.INQUILINOS] || '').trim().length > 0
  const hasAmount = parseAmount(r[COL.INGRESOS] || '') != null
  // First real data row needs landlord + tenant + amount
  if (landlord && hasTenant && hasAmount) {
    dataStart = i
    break
  }
}
report.skippedMetadata = dataStart

for (let i = dataStart; i < rows.length; i++) {
  const r = rows[i]
  if (!r || r.length < 12) continue

  // Detect totals row and stop
  if ((r[COL.PERIODO] || '').toUpperCase().includes('TOTALES')) break

  const landlordCell = (r[COL.PROPIETARIOS] || '').trim()
  const tenantCell   = (r[COL.INQUILINOS]   || '').trim()
  const pctRaw       = (r[COL.PCT]          || '').trim()
  const contractRange = (r[COL.CONTRATO]    || '').trim()
  const deuda        = (r[COL.DEUDA]        || '').trim()
  const periodo      = (r[COL.PERIODO]      || '').trim()
  const ingresos     = parseAmount(r[COL.INGRESOS]     || '')
  const transferencia = parseAmount(r[COL.TRANSFERENCIA] || '')
  const admi         = parseAmount(r[COL.ADMI]         || '')
  const admGalicia   = parseAmount(r[COL.ADM_GALICIA]  || '')
  const admFr509     = parseAmount(r[COL.ADM_FRANCES_50_9] || '')
  const admFr516     = parseAmount(r[COL.ADM_FRANCES_51_6] || '')
  const bankRaw      = (r[COL.OBSERVACION]  || '').trim()
  const lfaCode      = (r[COL.LFA]          || '').trim()
  const fechaBanco   = (r[COL.FECHA_BANCO]  || '').trim()

  // If landlord cell has names, update context. Otherwise, inherit (carry-down).
  let landlordNamesForThisRow: string[]
  if (landlordCell) {
    landlordNamesForThisRow = splitLandlords(landlordCell)
    if (landlordNamesForThisRow.length) currentLandlordNames = landlordNamesForThisRow
  } else {
    landlordNamesForThisRow = currentLandlordNames
    if (currentLandlordNames.length) report.landlordsInherited++
  }

  // Detect "new contract row": has tenant + (rent or commission %).
  // Reject header bleed + vacant markers — those become properties-only.
  const isHeaderRow = /^INQUILINOS$/i.test(tenantCell.trim())
  const isVacantRow = isVacantOrNotManaged(tenantCell)
  const isNewContractRow =
    tenantCell.length > 0 &&
    !isHeaderRow &&
    !isVacantRow &&
    (pctRaw.length > 0 || ingresos != null)

  // Even if it's a vacant row, create the property under the current landlord
  // so it shows up as a vacancy in the app.
  if (isVacantRow && currentLandlordNames.length) {
    const primary = getOrCreateLandlord(currentLandlordNames[0])
    properties.push({
      id: randomUUID(),
      landlord_ids: [primary.id],
      address: `Propiedad de ${primary.name} (vacante)`,
      property_type: detectPropertyType(tenantCell),
    })
  }

  if (isNewContractRow) {
    // Build landlord records
    if (!landlordNamesForThisRow.length) {
      report.ambiguous.push(`Row ${i + 1}: tenant "${tenantCell.split('\n')[0]}" has no landlord context`)
    }
    const landlordRecs = landlordNamesForThisRow.map(getOrCreateLandlord)

    // Property — one per contract. Try to extract the real address from the
    // tenant cell; fall back to a "Propiedad de <landlord>" placeholder.
    const primaryLandlord = landlordRecs[0]
    const detectedAddress = extractAddressFromTenantCell(tenantCell)
    let property: PropertyRec
    if (primaryLandlord) {
      // Co-ownership at the property level mirrors the contract co-ownership.
      // ALL contract landlords own the property, not just the primary.
      property = {
        id: randomUUID(),
        landlord_ids: landlordRecs.map(l => l.id),
        address: detectedAddress ?? `Propiedad de ${primaryLandlord.name}`,
        property_type: detectPropertyType(tenantCell),
      }
      properties.push(property)
    } else {
      // No landlord context — create a placeholder landlord
      const placeholder = getOrCreateLandlord(`Sin propietario asignado (fila ${i + 1})`)
      property = {
        id: randomUUID(),
        landlord_ids: [placeholder.id],
        address: detectedAddress ?? `Propiedad sin asignar (fila ${i + 1})`,
        property_type: detectPropertyType(tenantCell),
      }
      properties.push(property)
    }

    // Tenants
    const tenantNames = splitTenants(tenantCell)
    const phone = extractPhone(tenantCell)
    const tenantRecs = tenantNames.map((n) => getOrCreateTenant(n, phone))

    // Contract
    const { start, end } = parseDateRange(contractRange)
    const cadence = detectCadence(tenantCell + ' ' + deuda + ' ' + contractRange)
    const pct = parseFloat(pctRaw.replace(',', '.'))
    const bank_code = detectBank(bankRaw)
    // Status logic — distinguish:
    //   • RESCIND / RESCISI / RESCIOON (typo) → forced termination, mark
    //     'rescinded' regardless of whether there's a final payment.
    //   • FINALIZA CONTRATO → natural end. If there's a current-month payment,
    //     the contract was almost certainly RENEWED (e.g. CORCOY/AGUAISOL row
    //     120: old contract finalized April 2026, new $550K rent starts May).
    //     With a payment → 'active' (renewed). Without → 'ended'.
    //   • VACIO → 'rescinded' (vacant — usually already filtered earlier).
    //   • Note on VACIO regex: \b word boundary needed because the substring
    //     appears inside RENOVACION (renovation) — BOGADO's contract has
    //     "VALORES POR RENOVACION" and was previously mismarked.
    const statusText = (tenantCell + ' ' + deuda + ' ' + periodo).toUpperCase()
    const hasCurrentPayment = ingresos != null && ingresos > 0
    let status: string
    if (/\bRESCIND|\bRESCISI|\bRESCIOON/.test(statusText)) {
      status = 'rescinded'
    } else if (/\bFINALIZA\s+CONTRATO/.test(statusText)) {
      status = hasCurrentPayment ? 'active' : 'ended'
    } else if (/\bVAC[ÍI]?O\b/.test(statusText)) {
      status = 'rescinded'
    } else {
      status = 'active'
    }

    // current_rent: prefer INGRESOS, but fall back to first $-amount in DEUDA
    // when (a) INGRESOS is empty (CHAILE-style debt) OR (b) PERIODO is
    // SALDO/A CTA (BRUGGER-style partial payment — the SALDO amount is not
    // the contractual rent). DEUDA holds the contractual rent in both cases.
    let current_rent = ingresos ?? 0
    const isPartialRow = /SALDO|A\s*CTA/i.test(periodo)
    if (!current_rent || isPartialRow) {
      // Try arrears-table extraction first (PASCUAL style: multi-month debt
      // schedule — the latest month's rent is current). Fall back to first
      // $-amount if no arrears table detected.
      const fromArrears = extractCurrentRentFromArrears(deuda)
      const fromDeuda = fromArrears ?? extractFirstAmount(deuda)
      if (fromDeuda && fromDeuda > current_rent) current_rent = fromDeuda
    }

    const contract: ContractRec = {
      id: randomUUID(),
      property_id: property.id,
      landlord_ids: landlordRecs.length ? landlordRecs.map(l => l.id) : property.landlord_ids,
      tenant_ids: tenantRecs.map(t => t.id),
      administrator_codes: partnerFromCode(lfaCode),
      commission_pct: isFinite(pct) ? pct : 6,
      start_date: start,
      end_date: end,
      current_rent,
      cadence,
      bank_code,
      notes: deuda.split('\n')[0].slice(0, 200),
      status,
    }
    contracts.push(contract)
    currentContract = contract
    report.contractsCreated++

    // Main rent transaction
    if (ingresos != null && ingresos > 0) {
      transactions.push({
        contract_id: contract.id,
        type_code: 'RENT_IN',
        amount: ingresos,
        period: periodo || 'MAYO',
        bank_date: parseShortDate(fechaBanco),
        description: `Alquiler ${periodo || 'MAYO'} — ${tenantNames[0] || ''}`.slice(0, 200),
      })
      report.transactionsCreated++
    }
    if (transferencia != null && transferencia > 0) {
      transactions.push({
        contract_id: contract.id,
        type_code: 'LANDLORD_PAYOUT',
        amount: transferencia,
        period: periodo || 'MAYO',
        bank_date: parseShortDate(fechaBanco),
        description: `Transferencia a propietario — ${landlordRecs[0]?.name || ''}`.slice(0, 200),
      })
      report.transactionsCreated++
    }
    // Commission transactions (one per destination column that has a value)
    pushCommission(contract.id, admi, 'ADMI', periodo, fechaBanco)
    pushCommission(contract.id, admGalicia, 'ADM_GALICIA', periodo, fechaBanco)
    pushCommission(contract.id, admFr509, 'ADM_FRANCES_50_9', periodo, fechaBanco)
    pushCommission(contract.id, admFr516, 'ADM_FRANCES_51_6', periodo, fechaBanco)

    // OTROS DEDUC — only emit when math confirms it's a real deduction
    const otros = parseAmount(r[COL.OTROS] || '')
    if (isOtrosRealDeduction(ingresos, transferencia, admi, otros)) {
      transactions.push({
        contract_id: contract.id,
        type_code: 'OTHER_OUT',
        amount: otros!,
        period: periodo || 'MAYO',
        bank_date: parseShortDate(fechaBanco),
        description: ('Otros descuentos — ' + (deuda.split('\n')[0] || '')).slice(0, 200),
      })
      report.transactionsCreated++
    }
  } else {
    // Supplement row — additional transaction(s) for current contract
    const typeCode = classifyTransaction(periodo, deuda, ingresos)
    if (typeCode && ingresos != null && ingresos !== 0 && currentContract) {
      transactions.push({
        contract_id: currentContract.id,
        type_code: typeCode,
        amount: Math.abs(ingresos),
        period: periodo || 'MAYO',
        bank_date: parseShortDate(fechaBanco),
        description: (periodo + ' — ' + (deuda.split('\n')[0] || '')).slice(0, 200),
      })
      report.transactionsCreated++
    }
    // Supplement rows that have TRANSF + ADMI columns are full money-flow
    // events (TASA, SERVICIOS, ACT DEPOSITO) — they need landlord payout +
    // commission rows to balance the books, the same way main rows do.
    // Without these, ~$1M of landlord payouts get silently dropped (BATTEZZATI
    // TASA $27,767, AGUAISOL SERVICIOS $107,208, etc.)
    if (transferencia != null && transferencia > 0 && currentContract) {
      transactions.push({
        contract_id: currentContract.id,
        type_code: 'LANDLORD_PAYOUT',
        amount: transferencia,
        period: periodo || 'MAYO',
        bank_date: parseShortDate(fechaBanco),
        description: ('Transferencia ' + (periodo || 'suplemento')).slice(0, 200),
      })
      report.transactionsCreated++
    }
    if (currentContract) {
      pushCommission(currentContract.id, admGalicia, 'ADM_GALICIA', periodo, fechaBanco)
      pushCommission(currentContract.id, admFr509, 'ADM_FRANCES_50_9', periodo, fechaBanco)
      pushCommission(currentContract.id, admFr516, 'ADM_FRANCES_51_6', periodo, fechaBanco)
    }
    // OTROS DEDUC in supplement rows (e.g. BOGADO's ACT DEPOSITO row 72 has
    // $273,665 in OTROS that math confirms is a real deduction)
    const otros = parseAmount(r[COL.OTROS] || '')
    if (isOtrosRealDeduction(ingresos, transferencia, admi, otros) && currentContract) {
      transactions.push({
        contract_id: currentContract.id,
        type_code: 'OTHER_OUT',
        amount: otros!,
        period: periodo || 'MAYO',
        bank_date: parseShortDate(fechaBanco),
        description: ('Otros — ' + (periodo + ': ' + (deuda.split('\n')[0] || ''))).slice(0, 200),
      })
      report.transactionsCreated++
    }
  }
}

// OTROS DEDUC column sometimes carries informational text (THU debts the
// tenant owes) and sometimes a REAL deduction (gas regulator deducted from
// landlord's transfer, BOGADO's $529K repair deduction, etc.). The only
// reliable signal is the math: when INGRESOS - TRANSF - ADMI - OTROS ≈ 0,
// OTROS is a real money flow that closes the books. Otherwise it's a note.
function isOtrosRealDeduction(
  ingresos: number | null,
  transferencia: number | null,
  admi: number | null,
  otros: number | null,
): boolean {
  if (!otros || otros <= 0 || ingresos == null) return false
  const t = transferencia ?? 0
  const a = admi ?? 0
  const balWithout = Math.abs(ingresos - t - a)
  const balWith    = Math.abs(ingresos - t - a - otros)
  // Real deduction = adding OTROS closes the gap to < $5 (rounding tolerance)
  return balWith < balWithout && balWith < 5
}

function pushCommission(
  contractId: string,
  amount: number | null,
  destinationLabel: string,
  periodo: string,
  fechaBanco: string,
) {
  if (amount == null || amount <= 0) return
  // ADMI is the total (sum of the three destination columns), so only emit the
  // destination-specific rows to avoid double-counting.
  if (destinationLabel === 'ADMI') return
  transactions.push({
    contract_id: contractId,
    type_code: 'COMMISSION_OUT',
    amount,
    period: periodo || 'MAYO',
    bank_date: parseShortDate(fechaBanco),
    description: `Comisión → ${destinationLabel}`,
  })
  report.transactionsCreated++
}

function parseShortDate(raw: string): string | null {
  if (!raw) return null
  // formats: "11-may", "8-may", "30-abr"
  const m = raw.match(/(\d{1,2})[\s-]+([a-zA-ZáéíóúÁÉÍÓÚ]+)/)
  if (!m) return null
  const monthMap: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  }
  const mon = monthMap[m[2].slice(0, 3).toLowerCase()]
  if (!mon) return null
  return snapToValidDate(2026, mon, +m[1])
}

// ---------------------------------------------------------------------------
// 6. Emit SQL
// ---------------------------------------------------------------------------
const sql: string[] = []
sql.push('-- Auto-generated by scripts/import-from-sheet.ts')
sql.push('-- Source: client-data/alejandro-sheet.csv')
sql.push('-- Run in Supabase SQL Editor AFTER schema.sql.')
sql.push('--')
sql.push('-- IDEMPOTENT: this script first WIPES all Pampa Administración data')
sql.push('-- (landlords, tenants, properties, contracts, transactions, etc.) and')
sql.push('-- then reloads from the spreadsheet. Safe to re-run any number of times.')
sql.push('-- The base seeds — administrations, administrators, banks, transaction_types,')
sql.push('-- external_accountants — are NOT touched.')
sql.push('')
sql.push('-- Resolve the seeded administration + administrators once into temp vars.')
sql.push('do $$')
sql.push('declare')
sql.push('  v_admin_id uuid;')
sql.push('  v_flavio_id uuid;')
sql.push('  v_lisa_id uuid;')
sql.push('  v_alejandro_id uuid;')
sql.push('  v_dorso_id uuid;')
sql.push('begin')
sql.push('  -- Accepts the new name ("Patagonia Propiedades", post-rename) or the')
sql.push('  -- legacy placeholder ("Pampa Administración") for re-running against')
sql.push("  -- environments that haven't applied the rename migration yet.")
sql.push('  select id into v_admin_id from administrations')
sql.push("   where name in ('Patagonia Propiedades', 'Pampa Administración', 'Pampa Administración SRL')")
sql.push('   order by created_at')
sql.push('   limit 1;')
sql.push('  if v_admin_id is null then')
sql.push("    raise exception 'No administration row found. Run db/schema.sql first.';")
sql.push('  end if;')
sql.push("  select id into v_flavio_id    from administrators where name = 'Flavio H.'    and administration_id = v_admin_id;")
sql.push("  select id into v_lisa_id      from administrators where name = 'Lisa H.'      and administration_id = v_admin_id;")
sql.push("  select id into v_alejandro_id from administrators where name = 'Alejandro H.' and administration_id = v_admin_id;")
sql.push("  select id into v_dorso_id     from administrators where name = 'Dorso'        and administration_id = v_admin_id;")
sql.push('')
sql.push('  -- ============================================================')
sql.push('  -- WIPE existing Pampa data (idempotent re-runs)')
sql.push('  -- Order matters: child rows first, parents last, to respect FK')
sql.push('  -- restrictions (liquidaciones → contracts, contracts → properties).')
sql.push('  -- CASCADE deletes handle the junction tables automatically.')
sql.push('  -- ============================================================')
sql.push('  delete from liquidacion_lines where liquidacion_id in (select id from liquidaciones where administration_id = v_admin_id);')
sql.push('  delete from liquidaciones where administration_id = v_admin_id;')
sql.push('  delete from transactions where administration_id = v_admin_id;')
sql.push('  delete from contracts where administration_id = v_admin_id;')
sql.push('  delete from properties where administration_id = v_admin_id;')
sql.push('  delete from bank_accounts where administration_id = v_admin_id')
sql.push('     or landlord_id in (select id from landlords where administration_id = v_admin_id);')
sql.push('  delete from landlords where administration_id = v_admin_id;')
sql.push('  delete from external_accountants where administration_id = v_admin_id;')
sql.push('  delete from tenants where administration_id = v_admin_id;')
sql.push('')
sql.push('  -- ============================================================')
sql.push('  -- RELOAD from spreadsheet')
sql.push('  -- ============================================================')
sql.push('')

// Landlords
sql.push('  -- Landlords')
for (const l of landlords.values()) {
  sql.push(`  insert into landlords (id, administration_id, name) values (${sqlString(l.id)}, v_admin_id, ${sqlString(l.name)}) on conflict (id) do nothing;`)
}
sql.push('')

// Tenants
sql.push('  -- Tenants')
for (const t of tenants.values()) {
  sql.push(`  insert into tenants (id, administration_id, name, phone) values (${sqlString(t.id)}, v_admin_id, ${sqlString(t.name)}, ${sqlString(t.phone)}) on conflict (id) do nothing;`)
}
sql.push('')

// Properties
sql.push('  -- Properties (one per contract — addresses are placeholders)')
for (const p of properties) {
  sql.push(`  insert into properties (id, administration_id, address, property_type) values (${sqlString(p.id)}, v_admin_id, ${sqlString(p.address)}, ${sqlString(p.property_type)}) on conflict (id) do nothing;`)
}
sql.push('')

// Contracts
sql.push('  -- Contracts')
for (const c of contracts) {
  sql.push(
    `  insert into contracts (id, administration_id, property_id, current_rent, initial_rent, start_date, end_date, cadence, status, notes)` +
    ` values (${sqlString(c.id)}, v_admin_id, ${sqlString(c.property_id)}, ${sqlNumber(c.current_rent)}, ${sqlNumber(c.current_rent)},` +
    ` ${sqlDate(c.start_date || '2024-01-01')}, ${sqlDate(c.end_date || '2027-12-31')},` +
    ` ${sqlString(c.cadence || 'trimestral')}, ${sqlString(c.status)}, ${sqlString(c.notes)}) on conflict (id) do nothing;`,
  )
}
sql.push('')

// Junction: contract_landlords
sql.push('  -- contract_landlords (co-ownership at the contract level)')
for (const c of contracts) {
  const share = +(100 / Math.max(c.landlord_ids.length, 1)).toFixed(2)
  for (const lid of c.landlord_ids) {
    sql.push(`  insert into contract_landlords (contract_id, landlord_id, ownership_pct) values (${sqlString(c.id)}, ${sqlString(lid)}, ${share}) on conflict do nothing;`)
  }
}
sql.push('')

// Junction: property_landlords (direct property↔landlord, includes vacancies)
sql.push('  -- property_landlords (direct ownership — includes vacancies)')
for (const p of properties) {
  const share = +(100 / Math.max(p.landlord_ids.length, 1)).toFixed(2)
  for (const lid of p.landlord_ids) {
    sql.push(`  insert into property_landlords (property_id, landlord_id, ownership_pct) values (${sqlString(p.id)}, ${sqlString(lid)}, ${share}) on conflict do nothing;`)
  }
}
sql.push('')

// Junction: contract_tenants
sql.push('  -- contract_tenants (primary = first)')
for (const c of contracts) {
  c.tenant_ids.forEach((tid, idx) => {
    sql.push(`  insert into contract_tenants (contract_id, tenant_id, is_primary) values (${sqlString(c.id)}, ${sqlString(tid)}, ${idx === 0}) on conflict do nothing;`)
  })
}
sql.push('')

// Junction: contract_administrators
// Intentionally NOT emitted. The screenshot of rows 19-35 proved that the
// L/F/A column ("FL", "F", "L", "A") doesn't encode a partner share — it's
// just a label for the responsible manager. The commission flows to ONE
// destination bank account (ADM_GALICIA / ADM_FRANCES_50_9 / ADM_FRANCES_51_6),
// which is account routing, not partner allocation. Without knowing the real
// internal partner-share rule from Alejandro, any auto-derivation would be
// wrong. Leave contract_administrators empty so the UI can prompt for it.
sql.push('  -- contract_administrators: deliberately left empty.')
sql.push('  -- Fill via the UI once Alejandro confirms the partner-share rule.')
sql.push('')

// Transactions
sql.push('  -- Transactions (May snapshot)')
for (const tx of transactions) {
  sql.push(
    `  insert into transactions (administration_id, contract_id, transaction_type_id, amount, period, bank_date, description)` +
    ` select v_admin_id, ${sqlString(tx.contract_id)}, tt.id, ${sqlNumber(tx.amount)}, ${sqlDate(periodToDate(tx.period))},` +
    ` ${sqlDate(tx.bank_date)}, ${sqlString(tx.description)} from transaction_types tt where tt.code = ${sqlString(tx.type_code)};`,
  )
}

sql.push('')
sql.push('end $$;')

function periodToDate(p: string | null): string {
  if (!p) return '2026-05-01'
  const t = p.toUpperCase()
  const monthMap: Record<string, string> = {
    ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
    JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
  }
  for (const [name, num] of Object.entries(monthMap)) {
    if (t.includes(name)) return `2026-${num}-01`
  }
  return '2026-05-01'
}

writeFileSync(outSqlPath, sql.join('\n'), 'utf8')

// ---------------------------------------------------------------------------
// 7. Emit report
// ---------------------------------------------------------------------------
const rep: string[] = []
rep.push('IPC-ANALYZE — Sheet Import Report')
rep.push('==================================')
rep.push(`Source: client-data/alejandro-sheet.csv`)
rep.push(`Generated: ${new Date().toISOString()}`)
rep.push('')
rep.push('Totals')
rep.push(`  CSV rows scanned:       ${report.totalRows}`)
rep.push(`  Metadata rows skipped:  ${report.skippedMetadata}`)
rep.push(`  Landlords found:        ${landlords.size}`)
rep.push(`  Tenants found:          ${tenants.size}`)
rep.push(`  Properties created:     ${properties.length}`)
rep.push(`  Contracts created:      ${report.contractsCreated}`)
rep.push(`  Transactions created:   ${report.transactionsCreated}`)
rep.push(`  Rows where landlord inherited from above: ${report.landlordsInherited}`)
rep.push('')

rep.push('Top 30 landlords by appearance')
rep.push(`  ${[...landlords.values()].slice(0, 30).map(l => l.name).join('\n  ')}`)
rep.push('')

rep.push('Top 30 tenants by appearance')
rep.push(`  ${[...tenants.values()].slice(0, 30).map(t => t.name + (t.phone ? ' — ' + t.phone : '')).join('\n  ')}`)
rep.push('')

rep.push('Cadence distribution (across contracts)')
const cadenceCount: Record<string, number> = {}
for (const c of contracts) {
  const k = c.cadence || '(unknown)'
  cadenceCount[k] = (cadenceCount[k] || 0) + 1
}
for (const [k, v] of Object.entries(cadenceCount)) rep.push(`  ${k}: ${v}`)
rep.push('')

rep.push('Commission % distribution')
const pctCount: Record<string, number> = {}
for (const c of contracts) {
  const k = c.commission_pct.toString()
  pctCount[k] = (pctCount[k] || 0) + 1
}
for (const [k, v] of Object.entries(pctCount).sort()) rep.push(`  ${k}%: ${v}`)
rep.push('')

rep.push('Transaction type distribution')
const txCount: Record<string, number> = {}
for (const tx of transactions) {
  txCount[tx.type_code] = (txCount[tx.type_code] || 0) + 1
}
for (const [k, v] of Object.entries(txCount).sort()) rep.push(`  ${k}: ${v}`)
rep.push('')

rep.push('Ambiguous rows (needing review)')
if (report.ambiguous.length === 0) rep.push('  (none)')
else for (const a of report.ambiguous.slice(0, 50)) rep.push(`  ${a}`)

writeFileSync(outReportPath, rep.join('\n'), 'utf8')

console.log(`✔ Wrote ${outSqlPath}`)
console.log(`✔ Wrote ${outReportPath}`)
console.log('')
console.log(`Summary: ${landlords.size} landlords, ${tenants.size} tenants, ${properties.length} properties, ${report.contractsCreated} contracts, ${report.transactionsCreated} transactions`)
