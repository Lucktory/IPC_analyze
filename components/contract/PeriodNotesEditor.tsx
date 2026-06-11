'use client'

import { useRef, useState, useTransition } from 'react'
import { saveContractPeriodNote } from '@/lib/contract/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

interface PeriodNotesEditorProps {
  contractId: string
  period:     string          // YYYY-MM-DD (first-of-month)
  periodLabel: string         // "Mayo 2026" — shown in the header
  initialBody: string
  initialUpdatedAt: string | null
  initialUpdatedBy: string | null
}

export function PeriodNotesEditor({
  contractId,
  period,
  periodLabel,
  initialBody,
  initialUpdatedAt,
  initialUpdatedBy,
}: PeriodNotesEditorProps) {
  const [pending, startTransition] = useTransition()
  const [body, setBody]            = useState(initialBody)
  const [error, setError]          = useState<string | null>(null)
  const [meta, setMeta]            = useState<{ at: string; by: string | null }>({
    at: initialUpdatedAt ?? '',
    by: initialUpdatedBy,
  })
  const [dirty, setDirty]          = useState(false)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await saveContractPeriodNote(contractId, period, formData)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      setMeta({ at: new Date().toISOString(), by: meta.by })
      setDirty(false)
    })
  }

  const fmtMeta = meta.at
    ? `Guardado ${new Date(meta.at).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })}${meta.by ? ' por ' + meta.by : ''}`
    : 'Sin notas guardadas para este período.'

  return (
    <form ref={formRef} action={handleSubmit}>
      <textarea
        name="body"
        value={body}
        onChange={(e) => { setBody(e.target.value); setDirty(true) }}
        rows={6}
        placeholder={`Notas para ${periodLabel}:
• Alquiler vigente: $___
• Recuperos pendientes: THU, ABL, etc.
• Otras observaciones: pagos parciales, deuda, cobros en efectivo…`}
        className="w-full px-3 py-2.5 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors resize-y font-mono leading-relaxed"
      />

      {error && (
        <p className="mt-3 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate">
          {dirty ? <span className="text-ink">Cambios sin guardar · se guardan 10s después de confirmar</span> : fmtMeta}
        </p>
        <DelayedActionButton
          variant="primary"
          label="Guardar notas"
          pendingLabel="Guardando…"
          onConfirm={() => formRef.current?.requestSubmit()}
          pending={pending}
          disabled={!dirty}
        />
      </div>
    </form>
  )
}
