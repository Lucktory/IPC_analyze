'use client'

import { useEffect, useRef, useState } from 'react'

interface StickyHeaderProps {
  children:    React.ReactNode  // Default ("expanded") content
  condensed?:  React.ReactNode  // Optional single-line content shown after scroll
  threshold?:  number           // Scroll-top px where condensing kicks in. Default: 120
}

/**
 * Sticky page header. When `condensed` is provided, the header swaps to the
 * condensed slot once the scrolling container is past `threshold` pixels.
 *
 * Why a scroll listener instead of IntersectionObserver: the scrolling
 * container in this app is the <main> element (overflow-auto), not the
 * viewport — IO observers rooted on a non-default ancestor work but require
 * us to traverse to find the scroller anyway. A passive, rAF-throttled
 * scroll handler on that same ancestor is simpler and just as cheap.
 */
export function StickyHeader({ children, condensed, threshold = 120 }: StickyHeaderProps) {
  const [isCondensed, setIsCondensed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // hasCondensed is a stable boolean — using the raw `condensed` JSX prop in
  // deps would re-run the effect on every parent render (the JSX element is a
  // fresh object each time), which detaches+reattaches the scroll listener
  // mid-scroll and was contributing to the flicker.
  const hasCondensed = !!condensed

  useEffect(() => {
    if (!hasCondensed) return
    const el = rootRef.current
    if (!el) return

    let parent: HTMLElement | null = el.parentElement
    while (parent && parent !== document.body) {
      const style = getComputedStyle(parent)
      if (/(auto|scroll)/.test(style.overflowY)) break
      parent = parent.parentElement
    }
    const scrollEl = (parent ?? document.scrollingElement) as HTMLElement | null
    if (!scrollEl) return

    // Hysteresis (Schmitt trigger): condense at `threshold`, re-expand only
    // when scrollTop drops to `threshold - hysteresis`. Without this, mobile
    // scroll momentum bounces scrollTop around the threshold and the state
    // flips on every frame, producing visible KPI flicker.
    const hysteresis = 40
    const condenseAt = threshold
    const expandAt   = Math.max(0, threshold - hysteresis)

    let ticking = false
    function update() {
      ticking = false
      const top = (scrollEl as HTMLElement).scrollTop
      setIsCondensed(prev => {
        if (prev  && top < expandAt)   return false
        if (!prev && top > condenseAt) return true
        return prev
      })
    }
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    // Sync state on mount (handles reloads at non-zero scroll positions)
    update()
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [hasCondensed, threshold])

  return (
    <div
      ref={rootRef}
      className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-3 mb-2 bg-cream/95 backdrop-blur-sm border-b border-line/60"
      style={{ overflowAnchor: 'none' }}
    >
      {hasCondensed && isCondensed ? condensed : children}
    </div>
  )
}
