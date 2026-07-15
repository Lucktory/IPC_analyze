// Small avatar: shows the photo when present, else the name's initial.
// Uses a plain <img> (the URL is an external Supabase Storage public URL, so
// next/image would need remotePatterns config for no real benefit here).
export function Avatar({ url, name, size = 32 }: { url: string | null; name?: string | null; size?: number }) {
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
      className="rounded-full bg-info/15 text-info flex items-center justify-center font-medium shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  )
}
