'use client'

// Table row whose entire surface acts as a link. Click anywhere outside an
// existing `<a>` or interactive element navigates; clicking an inner link
// still works as expected (no double-navigation).

import { useRouter } from 'next/navigation'

interface ClickableRowProps {
  href:       string
  className?: string
  children:   React.ReactNode
  title?:     string
}

export function ClickableRow({ href, className = '', children, title }: ClickableRowProps) {
  const router = useRouter()

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    // Don't hijack clicks on existing links, buttons, or inputs
    const target = e.target as HTMLElement
    if (target.closest('a, button, input, label, select, textarea')) return
    router.push(href)
  }

  return (
    <tr
      onClick={handleClick}
      title={title}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </tr>
  )
}
