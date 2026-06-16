'use client'

// ============================================================================
// useFloatingPopover — positions a floating popover below an anchor element.
//
// Used by every in-cell editor on the /liquidacion grid (Numbers, Dates,
// Selects, Autocomplete). Computes the popover's screen-relative position
// from the anchor's getBoundingClientRect, and recomputes on scroll/resize
// so it stays glued even as the grid scrolls horizontally.
//
// Returns null while closed — callers conditionally render only when `rect`
// is non-null. The popover should be portal-rendered to document.body so
// it escapes any overflow + sticky stacking contexts on its way out.
// ============================================================================

import { useEffect, useState } from 'react'

export interface PopoverRect {
  top:   number
  left:  number
  width: number
}

export function useFloatingPopover(opts: {
  open:        boolean
  anchor:      HTMLElement | null
  minWidth?:   number
}): PopoverRect | null {
  const { open, anchor, minWidth = 280 } = opts
  const [rect, setRect] = useState<PopoverRect | null>(null)

  useEffect(() => {
    if (!open || !anchor) {
      setRect(null)
      return
    }
    const compute = () => {
      const r            = anchor.getBoundingClientRect()
      const width        = Math.max(r.width, minWidth)
      const viewportW    = window.innerWidth
      const SAFE_MARGIN  = 8

      // ── Horizontal placement
      // Default: align the popover's left edge with the anchor's left edge.
      // If that would push the popover past the right edge of the viewport
      // (e.g. for cells near the right of the grid like the "Check" column),
      // shift it leftward so its right edge sits SAFE_MARGIN px from the
      // viewport edge. Clamp to SAFE_MARGIN on the left so it never escapes
      // the left edge either.
      let leftViewport = r.left
      if (leftViewport + width > viewportW - SAFE_MARGIN) {
        leftViewport = Math.max(SAFE_MARGIN, viewportW - width - SAFE_MARGIN)
      }

      setRect({
        top:   r.bottom + window.scrollY + 2,
        left:  leftViewport + window.scrollX,
        width,
      })
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open, anchor, minWidth])

  return rect
}
