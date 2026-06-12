'use client'

// A two-stage button: click → armed countdown → fire.
//
// Used for money-touching mutations (Guardar / Eliminar / Marcar enviado).
// Click once to arm — the button starts a countdown and changes color.
// Click again during the countdown to cancel. After delaySeconds elapse
// without a second click, onConfirm() runs. There is no "fire now" escape:
// the wait is the safety buffer.
//
// The component owns its arm/cancel/countdown state — the parent only
// passes `pending` (true while the server action is actually running) so
// the label can switch to "Guardando…" etc.

import { useEffect, useRef, useState } from 'react'

type Variant = 'primary' | 'danger'
type Size    = 'md' | 'sm'

interface Props {
  /** Seconds to wait while armed. Default 10. */
  delaySeconds?: number
  /** Called once the countdown elapses. */
  onConfirm:     () => void
  /** True while the server action is actually running (after onConfirm fired). */
  pending?:      boolean
  disabled?:     boolean
  /** Initial label. */
  label:         string
  /** Label while pending. Default: "<label>…". */
  pendingLabel?: string
  variant?:      Variant
  /** `md` (default) for form footers, `sm` for inline table-cell usage. */
  size?:         Size
  title?:        string
}

const SIZE_CLS: Record<Size, string> = {
  md: 'px-4 py-2 text-[13px]',
  sm: 'px-2.5 py-1 text-[11px]',
}

const IDLE_CLS: Record<Variant, string> = {
  primary: 'bg-ink    text-paper hover:opacity-90',
  danger:  'bg-danger text-paper hover:opacity-90',
}

// Armed = countdown running. Use warn/danger ring to make the change of
// state obvious, plus tabular-nums so the counter doesn't jitter.
// Text on warn is always near-black (text-zinc-900) because the warn
// orange/yellow background is bright enough that white text would read
// poorly in dark mode.
const ARMED_CLS: Record<Variant, string> = {
  primary: 'bg-warn   text-zinc-900 ring-2 ring-warn/40',
  danger:  'bg-danger text-white    ring-2 ring-danger/50 animate-pulse',
}

export function DelayedActionButton({
  delaySeconds = 10,
  onConfirm,
  pending      = false,
  disabled     = false,
  label,
  pendingLabel,
  variant      = 'primary',
  size         = 'md',
  title,
}: Props) {
  const sizeCls = SIZE_CLS[size]
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

  function toggle() {
    if (armed) {
      setArmed(false)
      setSecondsLeft(delaySeconds)
    } else {
      setSecondsLeft(delaySeconds)
      setArmed(true)
    }
  }

  if (pending) {
    return (
      <button
        type="button"
        disabled
        className={`rounded font-medium ${sizeCls} opacity-50 cursor-not-allowed ${IDLE_CLS[variant]}`}
      >
        {pendingLabel ?? `${label}…`}
      </button>
    )
  }

  if (armed) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Tocá para cancelar"
        className={`rounded font-medium ${sizeCls} tabular-nums transition-colors ${ARMED_CLS[variant]}`}
      >
        Cancelar · {label} en {secondsLeft}s
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={title}
      className={`rounded font-medium ${sizeCls} transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${IDLE_CLS[variant]}`}
    >
      {label}
    </button>
  )
}
