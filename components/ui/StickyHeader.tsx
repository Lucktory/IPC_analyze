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

  useEffect(() => {
    if (!condensed) return
    const el = rootRef.current
    if (!el) return

    // Walk up looking for the first scrolling ancestor
    let parent: HTMLElement | null = el.parentElement
    while (parent && parent !== document.body) {
      const style = getComputedStyle(parent)
      if (/(auto|scroll)/.test(style.overflowY)) break
      parent = parent.parentElement
    }
    const scrollEl = (parent ?? document.scrollingElement) as HTMLElement | null
    if (!scrollEl) return

    let ticking = false
    function update() {
      ticking = false
      const top = (scrollEl as HTMLElement).scrollTop
      setIsCondensed(top > threshold)
    }
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    // Sync state on mount
    update()
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [condensed, threshold])

  return (
    <div
      ref={rootRef}
      className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-3 mb-2 bg-cream/95 backdrop-blur-sm border-b border-line/60"
    >
      {condensed && isCondensed ? condensed : children}
    </div>
  )
}
