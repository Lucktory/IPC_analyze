'use client'

// ============================================================================
// useFloatingPopover — positions a floating popover next to an anchor element.
//
// Used by every in-cell editor on the /liquidacion grid (Numbers, Dates,
// Selects, Autocomplete) and the Check validation badge. Computes the
// popover's screen-relative position from the anchor's getBoundingClientRect
// and recomputes on scroll/resize so it stays glued as the grid scrolls.
//
// Vertical placement flips: it opens BELOW the anchor by default, but if the
// popover wouldn't fit below (anchor near the viewport bottom — e.g. the last
// rows of the planilla) it opens ABOVE instead, so the panel is never pushed
// off-screen. Pass the rendered popover element via `popover` so its measured
// height drives the flip; without it the hook falls back to opening below.
//
// Returns null while closed — callers conditionally render only when `rect`
// is non-null. The popover should be portal-rendered to document.body so it
// escapes any overflow + sticky stacking contexts on its way out.
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
  /** The rendered popover element — its height drives the up/down flip.
   *  Wire it in with a callback ref (`ref={setPopoverEl}`) held in state. */
  popover?:    HTMLElement | null
  minWidth?:   number
}): PopoverRect | null {
  const { open, anchor, popover = null, minWidth = 280 } = opts
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
      const viewportH    = window.innerHeight
      const SAFE_MARGIN  = 8

      // ── Horizontal placement
      // Default: align the popover's left edge with the anchor's left edge.
      // If that would push it past the right edge, shift it leftward; clamp
      // to SAFE_MARGIN on the left so it never escapes the left edge either.
      let leftViewport = r.left
      if (leftViewport + width > viewportW - SAFE_MARGIN) {
        leftViewport = Math.max(SAFE_MARGIN, viewportW - width - SAFE_MARGIN)
      }

      // ── Vertical placement (flip)
      // Open below by default. If the popover's measured height wouldn't fit
      // below but fits above, flip up. As a final guard, clamp so it never
      // spills past the top/bottom of the viewport.
      const popH        = popover?.offsetHeight ?? 0
      const below       = r.bottom + 2
      const above       = r.top - popH - 2
      let topViewport: number
      if (popH > 0 && r.bottom + popH + SAFE_MARGIN > viewportH && above >= SAFE_MARGIN) {
        topViewport = above            // not enough room below, room above → flip up
      } else {
        topViewport = below
      }
      if (popH > 0) {
        topViewport = Math.min(topViewport, viewportH - popH - SAFE_MARGIN)
      }
      topViewport = Math.max(SAFE_MARGIN, topViewport)

      setRect({
        top:   topViewport + window.scrollY,
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
  }, [open, anchor, minWidth, popover])

  return rect
}
