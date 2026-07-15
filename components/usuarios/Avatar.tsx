// Small avatar: shows the photo when present, else the name's initial.
// Uses a plain <img> (the URL is an external Supabase Storage public URL, so
// next/image would need remotePatterns config for no real benefit here).
export function Avatar({
  url,
  name,
  size = 32,
  fallbackClassName = 'bg-info/15 text-info font-medium',
}: {
  url: string | null
  name?: string | null
  size?: number
  /** Color/weight classes for the initial fallback (lets each spot keep its look). */
  fallbackClassName?: string
}) {
  const initial = (name?.trim()?.charAt(0) ?? '?').toUpperCase()
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border border-line shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 ${fallbackClassName}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  )
}
