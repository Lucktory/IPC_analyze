'use client'

// A two-stage button: click → armed countdown → fire.
//
// Used for money-touching mutations (Guardar / Eliminar / Marcar enviado).
// While armed, the user has `delaySeconds` to hit Cancelar and back out,
// or hit Confirmar ahora to skip the wait. After the countdown reaches 0
// onConfirm() runs.
//
// The component owns its arm/cancel/countdown state — the parent only
// passes `pending` (true while the server action is actually running) so
// the label can switch to "Guardando…" etc.

import { useEffect, useRef, useState } from 'react'

type Variant = 'primary' | 'danger'

interface Props {
  /** Seconds to wait while armed. Default 10. */
  delaySeconds?: number
  /** Called once the countdown elapses (or the user clicks Confirmar ahora). */
  onConfirm:     () => void
  /** True while the server action is actually running (after onConfirm fired). */
  pending?:      boolean
  disabled?:     boolean
  /** Initial label. */
  label:         string
  /** Label while pending. Default: "<label>…". */
  pendingLabel?: string
  variant?:      Variant
  title?:        string
}

const IDLE_CLS: Record<Variant, string> = {
  primary: 'bg-ink    text-paper hover:opacity-90',
  danger:  'bg-danger text-paper hover:opacity-90',
}

// Armed = countdown running. Use warn/danger ring to make the change of
// state obvious, plus tabular-nums so the counter doesn't jitter.
const ARMED_CLS: Record<Variant, string> = {
  primary: 'bg-warn   text-ink   ring-2 ring-warn/40',
  danger:  'bg-danger text-paper ring-2 ring-danger/50 animate-pulse',
}

export function DelayedActionButton({
  delaySeconds = 10,
  onConfirm,
  pending      = false,
  disabled     = false,
  label,
  pendingLabel,
  variant      = 'primary',
  title,
}: Props) {
  const [armed,       setArmed]       = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(delaySeconds)

  // Use a ref for onConfirm so the effect doesn't re-run when the parent
  // passes a fresh lambda each render.
  const onConfirmRef = useRef(onConfirm)
  useEffect(() => { onConfirmRef.current = onConfirm })

  useEffect(() => {
    if (!armed) return
    if (secondsLeft <= 0) {
      setArmed(false)
      setSecondsLeft(delaySeconds)
      onConfirmRef.current()
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [armed, secondsLeft, delaySeconds])

  function arm() {
    setSecondsLeft(delaySeconds)
    setArmed(true)
  }

  function cancel() {
    setArmed(false)
    setSecondsLeft(delaySeconds)
  }

  function fireNow() {
    setArmed(false)
    setSecondsLeft(delaySeconds)
    onConfirmRef.current()
  }

  if (pending) {
    return (
      <button
        type="button"
        disabled
        className={`px-4 py-2 rounded text-[13px] font-medium opacity-50 cursor-not-allowed ${IDLE_CLS[variant]}`}
      >
        {pendingLabel ?? `${label}…`}
      </button>
    )
  }

  if (armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={cancel}
          className="px-3 py-2 text-[12px] text-slate hover:text-ink transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={fireNow}
          title="Tocá para confirmar ahora sin esperar"
          className={`px-4 py-2 rounded text-[13px] font-medium tabular-nums transition-colors ${ARMED_CLS[variant]}`}
        >
          Confirmar en {secondsLeft}s
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={arm}
      disabled={disabled}
      title={title}
      className={`px-4 py-2 rounded text-[13px] font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${IDLE_CLS[variant]}`}
    >
      {label}
    </button>
  )
}
