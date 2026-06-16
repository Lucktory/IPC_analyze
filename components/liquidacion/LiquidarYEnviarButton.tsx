'use client'

// ============================================================================
// LiquidarYEnviarButton — per-row action that prepares + sends the
// liquidación email to the propietario.
//
// Flow:
//   1. Click button on a row → confirm modal opens with computed summary.
//   2. The modal shows: propietario name, period, gross/comisión/otros/neto,
//      editable subject + body (so the encargada can adjust before sending).
//   3. Click "Enviar" → app calls liquidarAndPrepareEmail which:
//        a. Transitions the liquidación status to "sent" on the server.
//        b. Returns the prepared subject/body/recipient.
//      Then the browser opens a mailto: link with the prefilled content,
//      using the encargada's OWN email client. She reviews and clicks
//      Send inside her mail program — the system never sends an email
//      on its own.
//
// Respects the saved communication-model rule: drafting + recommendation
// are automated; the decision to send stays with the encargada.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { liquidarAndPrepareEmail } from '@/lib/liquidacion/email-actions'
import { fmtMoney } from '@/lib/format'

interface Props {
  contractId:   string
  landlordId:   string
  period:       string
  /** Propietario name — used in the confirm modal title. */
  landlordName: string
  /** Already-known landlord email; null if not on file. The confirm modal
   *  surfaces this to the encargada so she can correct it. */
  landlordEmail: string | null
  /** Display status — button hides itself when status is already paid. */
  status:       'draft' | 'sent' | 'paid'
}

export function LiquidarYEnviarButton({
  contractId, landlordId, period, landlordName, landlordEmail, status,
}: Props) {
  const [open, setOpen]                       = useState(false)
  const [pending, startTransition]            = useTransition()
  const [error, setError]                     = useState<string | null>(null)
  const [recipientDraft, setRecipientDraft]   = useState(landlordEmail ?? '')
  const [subjectDraft, setSubjectDraft]       = useState('')
  const [bodyDraft, setBodyDraft]             = useState('')
  const [summary, setSummary]                 = useState<{
    gross: number; commission: number; otros: number; netToLandlord: number
  } | null>(null)
  const router = useRouter()

  function openModal() {
    setError(null)
    setOpen(true)
    // Compute & prepare immediately on open so the encargada sees the
    // summary right away — even before she clicks Send. The transition
    // is reversible (cancel doesn't undo it on the server side; that's
    // a known trade-off for the MVP. Phase 5 can defer the transition
    // until the actual click).
    setSubjectDraft('')
    setBodyDraft('')
    setSummary(null)
    startTransition(async () => {
      const res = await liquidarAndPrepareEmail(contractId, landlordId, period)
      if (!res.ok) {
        setError(res.error ?? 'Error al preparar el email.')
        return
      }
      setRecipientDraft(res.recipient ?? '')
      setSubjectDraft(res.subject ?? '')
      setBodyDraft(res.body ?? '')
      setSummary(res.summary ?? null)
    })
  }

  function closeModal() {
    if (pending) return
    setOpen(false)
  }

  function send() {
    if (!recipientDraft.trim()) {
      setError('Faltan el email del propietario.')
      return
    }
    // Build the mailto: URL with prefilled subject + body.
    //
    // Important encoding notes (the previous version silently failed):
    //   • URLSearchParams encodes spaces as "+" (HTML form-encoding) —
    //     mailto: follows RFC 6068 which wants standard URI escapes (%20).
    //     Use encodeURIComponent instead.
    //   • window.open(href, '_blank') is unreliable for mailto:; many
    //     browsers ignore the _blank target AND popup-style window.open
    //     may be silently blocked. location.href is the right tool — it
    //     delegates the URL scheme to the OS, which routes mailto: to
    //     the user's default mail handler.
    //
    // If the OS has no mail handler registered nothing visible happens
    // — that's an OS configuration issue, not a code bug.
    const to      = encodeURIComponent(recipientDraft.trim())
    const subject = encodeURIComponent(subjectDraft)
    const body    = encodeURIComponent(bodyDraft)
    const href    = `mailto:${to}?subject=${subject}&body=${body}`
    window.location.href = href
    setOpen(false)
    // The liquidación was already transitioned to "sent" when the modal
    // opened. Refresh to reflect the new status dot on the row.
    router.refresh()
  }

  // Don't show the button on already-paid liquidaciones.
  if (status === 'paid') {
    return (
      <span className="text-[10px] text-info" title="Liquidación ya pagada">●</span>
    )
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
                    <span className="text-gray-700 font-medium border-t border-gray-300 pt-1 mt-1">Neto a transferir:</span>
                    <span className="text-right tabular-nums text-success font-display font-medium border-t border-gray-300 pt-1 mt-1">
                      {fmtMoney(summary.netToLandlord)}
                    </span>
                  </div>
                </div>
              )}

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
                  rows={12}
                  className="w-full px-2 py-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info font-mono leading-relaxed resize-y"
                />
              </label>

              {error && (
                <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <p className="text-[10.5px] text-gray-500 italic leading-snug">
                Al tocar <strong>Enviar</strong> se va a abrir tu programa de mail con el mensaje precargado.
                El sistema NUNCA manda mails por su cuenta — vos confirmás el envío desde tu mail.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 sticky bottom-0">
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
                onClick={send}
                disabled={pending || !summary}
                className="px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity inline-flex items-center gap-1.5"
              >
                ✉ Abrir mail y enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
