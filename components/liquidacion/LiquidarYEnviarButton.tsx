'use client'

// ============================================================================
// LiquidarYEnviarButton — per-row "Liquidar y enviar mail" action.
//
// Flow (after the redesign):
//   1. Click button on a row → modal opens.
//   2. Server prepares the email draft (PURE READ — no state change yet).
//      The summary, subject, body, and recipient fill the modal.
//   3. Encargada reviews / edits:
//        • Mi email (firma)   — her own address; persists in localStorage so
//                                she only types it once. Used as the
//                                authuser hint for Gmail and as a signature
//                                line in the body.
//        • Email del propietario — the recipient (prefilled if on file).
//        • Asunto y cuerpo    — both editable.
//   4. She clicks ONE of two Send buttons:
//        • "Abrir en Gmail" (PRIMARY) — opens Gmail compose in a new tab
//          via https://mail.google.com/mail/?view=cm&...&authuser=<senderEmail>
//          Works on any browser/OS without OS configuration.
//        • "Abrir programa de mail" (SECONDARY) — mailto: handoff for
//          encargadas with Outlook/Thunderbird configured.
//   5. The instant she clicks one of those buttons, markLiquidacionAsSent
//      fires on the server (status → sent + sent_at stamp). Cancelar does
//      NOT mark anything as sent — the fix for the previous bug.
//
// Respects the saved communication-model rule: drafting + recommendation
// are automated; sending is always done by the encargada in her own mail UI.
// ============================================================================

import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  prepareEmailDraft,
  markLiquidacionAsSent,
} from '@/lib/liquidacion/email-actions'
import { fmtMoney } from '@/lib/format'

const SENDER_EMAIL_KEY = 'liquidacion.senderEmail'

interface Props {
  contractId:   string
  landlordId:   string
  period:       string
  landlordName: string
  landlordEmail: string | null
  status:       'draft' | 'sent' | 'paid'
}

export function LiquidarYEnviarButton({
  contractId, landlordId, period, landlordName, landlordEmail, status,
}: Props) {
  const [open, setOpen]                     = useState(false)
  const [pending, startTransition]          = useTransition()
  const [error, setError]                   = useState<string | null>(null)
  const [senderEmail, setSenderEmail]       = useState('')
  const [recipientDraft, setRecipientDraft] = useState(landlordEmail ?? '')
  const [subjectDraft, setSubjectDraft]     = useState('')
  const [bodyDraft, setBodyDraft]           = useState('')
  const [summary, setSummary]               = useState<{
    gross: number; commission: number; otros: number
    ajusteLines: { label: string; amount: number }[]; ajustes: number
    netToLandlord: number
  } | null>(null)
  const router = useRouter()

  // Hydrate sender email from localStorage on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SENDER_EMAIL_KEY)
      if (stored) setSenderEmail(stored)
    } catch { /* ignore disabled storage */ }
  }, [])

  // Persist sender email whenever it changes (debounced via natural typing).
  useEffect(() => {
    if (!senderEmail) return
    try { window.localStorage.setItem(SENDER_EMAIL_KEY, senderEmail) } catch { /* ignore */ }
  }, [senderEmail])

  function openModal() {
    setError(null)
    setOpen(true)
    setSubjectDraft('')
    setBodyDraft('')
    setSummary(null)
    startTransition(async () => {
      // prepareEmailDraft is pure READ — does NOT transition the liquidación.
      const res = await prepareEmailDraft(contractId, landlordId, period, senderEmail || null)
      if (!res.ok) {
        setError(res.error ?? 'Error al preparar el email.')
        return
      }
      setRecipientDraft(res.recipient ?? landlordEmail ?? '')
      setSubjectDraft(res.subject ?? '')
      setBodyDraft(res.body ?? '')
      setSummary(res.summary ?? null)
    })
  }

  function closeModal() {
    if (pending) return
    setOpen(false)
  }

  // Common send sequence: validate, mark as sent on the server, open the
  // chosen mail UI, close the modal, refresh.
  function send(mode: 'gmail' | 'mailto') {
    if (!recipientDraft.trim()) {
      setError('Falta el email del propietario.')
      return
    }
    setError(null)
    startTransition(async () => {
      // Mark sent only NOW — not when the modal opened. Cancel preserves
      // the draft status as it should.
      const sentRes = await markLiquidacionAsSent(contractId, landlordId, period)
      if (!sentRes.ok) {
        setError(sentRes.error ?? 'Error al marcar como enviada')
        return
      }
      // Open the chosen mail UI.
      if (mode === 'gmail') {
        // Gmail compose URL. Works on any browser/OS. Pre-fills to, subject,
        // body. authuser lets Gmail pick the right account when she has
        // multiple logged in.
        const url = new URL('https://mail.google.com/mail/')
        url.searchParams.set('view', 'cm')
        url.searchParams.set('fs', '1')
        url.searchParams.set('to', recipientDraft.trim())
        url.searchParams.set('su', subjectDraft)
        url.searchParams.set('body', bodyDraft)
        if (senderEmail.trim()) url.searchParams.set('authuser', senderEmail.trim())
        window.open(url.toString(), '_blank', 'noopener,noreferrer')
      } else {
        // mailto: fallback for Outlook / Thunderbird users.
        const href =
          `mailto:${encodeURIComponent(recipientDraft.trim())}` +
          `?subject=${encodeURIComponent(subjectDraft)}` +
          `&body=${encodeURIComponent(bodyDraft)}`
        window.location.href = href
      }
      setOpen(false)
      router.refresh()
    })
  }

  // Hide the button on already-paid liquidaciones.
  if (status === 'paid') {
    return <span className="text-[10px] text-info" title="Liquidación ya pagada">●</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Liquidar este período y enviar mail al propietario"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-paper bg-ink hover:opacity-90 transition-opacity"
      >
        ✉ Enviar
      </button>

      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeModal}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <div className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[640px] max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="font-display text-[15px] font-medium text-ink">Liquidar y enviar mail</h2>
              <p className="text-[11.5px] text-gray-500 mt-0.5">
                Propietario: <strong className="text-ink">{landlordName}</strong>
              </p>
            </div>

            <div className="px-5 py-4 space-y-3">
              {pending && !summary && (
                <p className="text-[12px] text-gray-500 italic">Preparando borrador…</p>
              )}

              {summary && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3 text-[12px]">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-600">Total cobrado:</span>
                    <span className="text-right tabular-nums text-ink font-medium">{fmtMoney(summary.gross)}</span>
                    <span className="text-gray-600">Comisión administración:</span>
                    <span className="text-right tabular-nums text-ink">{fmtMoney(summary.commission)}</span>
                    {summary.otros > 0 && (
                      <>
                        <span className="text-gray-600">Otros descuentos:</span>
                        <span className="text-right tabular-nums text-ink">{fmtMoney(summary.otros)}</span>
                      </>
                    )}
                    {summary.ajusteLines.map((l, i) => (
                      <Fragment key={i}>
                        <span className="text-gray-600">{l.label}:</span>
                        <span className={`text-right tabular-nums ${l.amount < 0 ? 'text-danger' : 'text-success'}`}>
                          {l.amount < 0 ? '− ' : '+ '}{fmtMoney(Math.abs(l.amount))}
                        </span>
                      </Fragment>
                    ))}
                    <span className="text-gray-700 font-medium border-t border-gray-300 pt-1 mt-1">Neto a transferir:</span>
                    <span className="text-right tabular-nums text-success font-display font-medium border-t border-gray-300 pt-1 mt-1">
                      {fmtMoney(summary.netToLandlord)}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Sender (remitente) — persists in localStorage ── */}
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
                  Tu email (remitente / firma)
                  <span className="text-gray-400 ml-1 normal-case font-normal">— se guarda para la próxima vez</span>
                </span>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                  placeholder="tu-email@gmail.com"
                  className="w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info"
                />
              </label>

              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">
                  Email del propietario {!landlordEmail && <span className="text-warn">(no estaba cargado — ingresá uno)</span>}
                </span>
                <input
                  type="email"
                  value={recipientDraft}
                  onChange={e => setRecipientDraft(e.target.value)}
                  placeholder="propietario@example.com"
                  className="w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info"
                />
              </label>

              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Asunto</span>
                <input
                  type="text"
                  value={subjectDraft}
                  onChange={e => setSubjectDraft(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info"
                />
              </label>

              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-1">Cuerpo del mail (editable)</span>
                <textarea
                  value={bodyDraft}
                  onChange={e => setBodyDraft(e.target.value)}
                  rows={11}
                  className="w-full px-2 py-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info font-mono leading-relaxed resize-y"
                />
              </label>

              {error && (
                <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <p className="text-[10.5px] text-gray-500 italic leading-snug">
                <strong>Abrir en Gmail</strong> abre Gmail web en una pestaña nueva con el mensaje listo — funciona sin configurar nada.
                <br />
                <strong>Abrir programa de mail</strong> usa el programa de mail del sistema (Outlook, Thunderbird) si está configurado.
                <br />
                En ambos casos vos confirmás el envío desde tu mail. El sistema nunca manda mails por su cuenta.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 sticky bottom-0 flex-wrap">
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                className="px-3 py-1.5 rounded border border-gray-300 text-[12px] text-slate-dark hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => send('mailto')}
                disabled={pending || !summary}
                title="Abrir Outlook / Thunderbird / programa de mail predeterminado"
                className="px-3 py-1.5 rounded border border-gray-400 text-[12px] text-slate-dark hover:bg-gray-100 disabled:opacity-60 transition-colors"
              >
                Abrir programa de mail
              </button>
              <button
                type="button"
                onClick={() => send('gmail')}
                disabled={pending || !summary}
                title="Abrir Gmail en una pestaña nueva"
                className="px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity inline-flex items-center gap-1.5"
              >
                ✉ Abrir en Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
