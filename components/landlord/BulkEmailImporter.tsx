'use client'

// ============================================================================
// BulkEmailImporter — two-stage UI:
//
//   1. Paste textarea + "Analizar" button → calls previewEmailImport().
//   2. Preview table: per-line match + email + alt-emails + select/skip.
//      "Aplicar seleccionados" → calls applyEmailImport().
//
// Designed so the encargada can fix each ambiguous row without leaving the
// page: pick from a dropdown of candidate matches, edit the primary email
// directly, or skip the row. The server enforces validation, never trusts
// the client.
// ============================================================================

import { useState, useTransition } from 'react'
import {
  previewEmailImport,
  applyEmailImport,
  type PreviewLine,
  type PreviewResult,
  type ApplyDecision,
  type ApplyResult,
} from '@/lib/landlord/email-import'

interface RowState {
  lineNumber:    number
  rawText:       string
  parsedName:    string
  candidates:    PreviewLine['candidates']
  primaryEmail:  string
  altEmails:     string[]
  /** id selected from the candidates dropdown. Empty = skip this row. */
  selectedId:    string
  /** True when the user explicitly accepted (or the system did via exact match). */
  accepted:      boolean
}

export function BulkEmailImporter() {
  const [text, setText]         = useState('')
  const [preview, setPreview]   = useState<PreviewResult | null>(null)
  const [rows, setRows]         = useState<RowState[]>([])
  const [applyRes, setApplyRes] = useState<ApplyResult | null>(null)
  const [pending, startTrans]   = useTransition()
  const [error, setError]       = useState<string | null>(null)

  function handleAnalyze() {
    setError(null)
    setApplyRes(null)
    if (!text.trim()) {
      setError('Pegá al menos una línea con nombre + email.')
      return
    }
    startTrans(async () => {
      const res = await previewEmailImport(text)
      setPreview(res)
      setRows(res.lines.map<RowState>(l => ({
        lineNumber:   l.lineNumber,
        rawText:      l.rawText,
        parsedName:   l.parsedName,
        candidates:   l.candidates,
        primaryEmail: l.emails[0] ?? '',
        altEmails:    l.emails.slice(1),
        selectedId:   l.hasExactMatch && l.candidates[0] ? l.candidates[0].id : '',
        accepted:     l.hasExactMatch,
      })))
    })
  }

  function patchRow(lineNumber: number, patch: Partial<RowState>) {
    setRows(prev => prev.map(r => r.lineNumber === lineNumber ? { ...r, ...patch } : r))
  }

  function handleApply() {
    setError(null)
    setApplyRes(null)
    const decisions: ApplyDecision[] = rows
      .filter(r => r.accepted && r.selectedId)
      .map(r => ({
        lineNumber:   r.lineNumber,
        landlordId:   r.selectedId,
        primaryEmail: r.primaryEmail,
        altEmails:    r.altEmails,
      }))
    if (decisions.length === 0) {
      setError('No hay líneas marcadas para aplicar.')
      return
    }
    startTrans(async () => {
      const res = await applyEmailImport(decisions)
      setApplyRes(res)
    })
  }

  const acceptedCount = rows.filter(r => r.accepted && r.selectedId).length

  return (
    <div className="space-y-6">
      {/* ── Step 1: Paste textarea ─────────────────────────────────────── */}
      <section className="bg-paper border border-line rounded shadow-card p-5">
        <p className="label-cap text-slate mb-2">1. Pegá la lista</p>
        <p className="text-[12px] text-slate-dark mb-3">
          Un propietario por línea. Acepta tabuladores, comas, pipes o slashes
          como separadores. Si hay dos emails en la línea el primero queda como
          principal y el resto como alternativos.
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          placeholder={'ALASSIA JOSE LUIS\tjalassia@hotmail.com\nLODDO ALBERTO\tadmin@example.com | alberto@example.com\n…'}
          className="w-full px-3 py-2 rounded border border-gray-300 bg-white text-[12.5px] font-mono outline-none focus:border-info"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-slate">
            {text.split(/\r?\n/).filter(l => l.trim()).length} línea{text.split(/\r?\n/).filter(l => l.trim()).length === 1 ? '' : 's'} pegada{text.split(/\r?\n/).filter(l => l.trim()).length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={pending}
            className="px-3 py-1.5 bg-ink text-paper rounded text-[12px] font-medium hover:opacity-90 disabled:opacity-60"
          >
            {pending ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[12px] text-danger">{error}</p>
        )}
      </section>

      {/* ── Step 2: Preview table ──────────────────────────────────────── */}
      {preview && (
        <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <p className="label-cap text-slate">2. Revisá las coincidencias</p>
              <p className="text-[12px] text-slate-dark mt-0.5">
                {rows.length} línea{rows.length === 1 ? '' : 's'} parseada{rows.length === 1 ? '' : 's'} ·
                {' '}{acceptedCount} listas para aplicar
                {preview.skippedLines.length > 0 && (
                  <> · <span className="text-warn">{preview.skippedLines.length} ignoradas</span></>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={pending || acceptedCount === 0}
              className="px-3 py-1.5 bg-ink text-paper rounded text-[12px] font-medium hover:opacity-90 disabled:opacity-60"
            >
              {pending ? 'Aplicando…' : `Aplicar ${acceptedCount} seleccionado${acceptedCount === 1 ? '' : 's'}`}
            </button>
          </div>

          {preview.skippedLines.length > 0 && (
            <div className="px-5 py-3 bg-warn/10 border-b border-warn/30 text-[12px] text-ink">
              <p className="font-medium mb-1">Líneas ignoradas (sin email detectado):</p>
              <ul className="space-y-0.5 list-disc pl-5">
                {preview.skippedLines.map(s => (
                  <li key={s.lineNumber} className="font-mono text-[11px]">
                    L{s.lineNumber}: {s.rawText} <span className="text-slate">— {s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[900px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left px-3 py-1.5 label-cap font-medium border-r border-line/50 w-12">✓</th>
                  <th className="text-left px-3 py-1.5 label-cap font-medium border-r border-line/50">Nombre del listado</th>
                  <th className="text-left px-3 py-1.5 label-cap font-medium border-r border-line/50">Match en DB</th>
                  <th className="text-left px-3 py-1.5 label-cap font-medium border-r border-line/50">Email primario</th>
                  <th className="text-left px-3 py-1.5 label-cap font-medium">Alternativos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.lineNumber} className={`border-b border-line/30 align-top ${row.accepted ? 'bg-success/5' : ''}`}>
                    <td className="px-3 py-1.5 border-r border-line/30">
                      <input
                        type="checkbox"
                        checked={row.accepted && !!row.selectedId}
                        onChange={e => patchRow(row.lineNumber, { accepted: e.target.checked })}
                        disabled={!row.selectedId}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-ink border-r border-line/30">
                      <div className="font-medium">{row.parsedName || <span className="text-slate italic">(sin nombre)</span>}</div>
                      <div className="text-[10px] text-slate font-mono mt-0.5">L{row.lineNumber}</div>
                    </td>
                    <td className="px-3 py-1.5 border-r border-line/30">
                      <select
                        value={row.selectedId}
                        onChange={e => patchRow(row.lineNumber, { selectedId: e.target.value, accepted: !!e.target.value })}
                        className="w-full h-7 px-1.5 text-[11.5px] border border-gray-300 rounded bg-white outline-none focus:border-info"
                      >
                        <option value="">— omitir esta línea —</option>
                        {row.candidates.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.similarity >= 0.95 ? '(coincide)' : `(${Math.round(c.similarity * 100)}%)`}
                            {c.currentEmail ? `  · actual: ${c.currentEmail}` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 border-r border-line/30">
                      <input
                        type="email"
                        value={row.primaryEmail}
                        onChange={e => patchRow(row.lineNumber, { primaryEmail: e.target.value })}
                        className="w-full h-7 px-1.5 text-[11.5px] border border-gray-300 rounded bg-white outline-none focus:border-info font-mono"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      {row.altEmails.length === 0 ? (
                        <span className="text-[11px] text-slate/60">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {row.altEmails.map((e, i) => (
                            <li key={i} className="text-[11px] font-mono text-slate-dark flex items-center gap-1.5">
                              <span>{e}</span>
                              <button
                                type="button"
                                onClick={() => patchRow(row.lineNumber, {
                                  altEmails: row.altEmails.filter((_, j) => j !== i),
                                })}
                                className="text-gray-400 hover:text-danger text-[14px] leading-none"
                                title="Quitar este alternativo"
                              >×</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Step 3: Apply result ───────────────────────────────────────── */}
      {applyRes && (
        <section className="bg-paper border border-success/40 rounded shadow-card p-5">
          <p className="label-cap text-slate mb-2">3. Resultado</p>
          {applyRes.applied.length > 0 && (
            <>
              <p className="text-[13px] text-success font-medium mb-2">
                ✓ {applyRes.applied.length} propietario{applyRes.applied.length === 1 ? '' : 's'} actualizado{applyRes.applied.length === 1 ? '' : 's'}.
              </p>
              <ul className="text-[12px] text-slate-dark space-y-0.5">
                {applyRes.applied.map(a => (
                  <li key={a.landlordId}>
                    <strong>{a.landlordName}</strong> → {a.email}
                    {a.altCount > 0 && <span className="text-slate"> · +{a.altCount} alt</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {applyRes.skipped.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] text-warn font-medium mb-1">
                ⚠ {applyRes.skipped.length} omitido{applyRes.skipped.length === 1 ? '' : 's'}:
              </p>
              <ul className="text-[12px] text-slate-dark space-y-0.5">
                {applyRes.skipped.map((s, i) => (
                  <li key={i}><span className="font-mono">{s.landlordId}</span> — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {applyRes.error && (
            <p className="mt-2 text-[12px] text-danger">{applyRes.error}</p>
          )}
        </section>
      )}
    </div>
  )
}
