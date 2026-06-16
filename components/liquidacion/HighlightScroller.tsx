'use client'

// ============================================================================
// HighlightScroller — reads the `highlight` URL param on mount and:
//   1. Finds the matching <tr data-contract-id="…"> in the planilla
//   2. Scrolls it into view (centered) inside the grid's scroll container
//   3. Pulses its background yellow ~3 times to draw the encargada's eye
//
// Used by the "Ver fila →" buttons on /pendientes to jump-and-spotlight
// the affected contract row.
//
// Pure browser-side: no server data, no React state changes that would
// re-render the grid. The DOM manipulation is intentionally direct (style
// + setTimeout) because the highlight class would not be present in the
// Tailwind CSS bundle unless declared statically — direct inline styles
// always work.
// ============================================================================

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const HIGHLIGHT_COLOR = 'rgb(254 240 138)'  // Tailwind yellow-200
const PULSE_MS        = 600                  // each pulse-on / pulse-off step
const TOTAL_MS        = 3000                 // total spotlight duration

export function HighlightScroller() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const id = searchParams.get('highlight')
    if (!id) return

    // Defer two frames: lets Next.js commit the page + the grid table to the
    // DOM before we try to query for the row.
    let raf1 = 0, raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const row = document.querySelector(`tr[data-contract-id="${id}"]`) as HTMLElement | null
        if (!row) return

        row.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // Pulse: yellow → none → yellow → none → yellow → fade out.
        row.style.transition = 'background-color 0.4s ease-in-out'
        let on = true
        row.style.backgroundColor = HIGHLIGHT_COLOR
        const interval = window.setInterval(() => {
          on = !on
          row.style.backgroundColor = on ? HIGHLIGHT_COLOR : ''
        }, PULSE_MS)
        window.setTimeout(() => {
          clearInterval(interval)
          row.style.backgroundColor = ''
          // Clear transition after the fade-out completes so any subsequent
          // user hover doesn't inherit our timing.
          window.setTimeout(() => { row.style.transition = '' }, 500)
        }, TOTAL_MS)
      })
    })

    return () => {
      if (raf1) cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [searchParams])

  return null
}
