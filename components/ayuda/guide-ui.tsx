// Shared presentational bits for the in-app help guides (/ayuda/*). Pure server
// components (no state) styled with the app tokens, so every chapter looks the
// same and follows light/dark automatically.
import React from 'react'

export function GuideCard({ title, tint, children }: { title: string; tint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-paper border border-line rounded-xl shadow-card p-5">
      <header className="mb-3 flex items-center gap-2.5">
        {tint && <span className="h-6 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tint }} />}
        <h2 className="font-display text-[15.5px] font-semibold text-ink leading-tight">{title}</h2>
      </header>
      {children}
    </section>
  )
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-info/12 text-info text-[11px] font-semibold flex items-center justify-center tabular-nums">{n}</span>
      <span className="text-[13.5px] text-slate-dark leading-relaxed">{children}</span>
    </li>
  )
}

export function Callout({
  tone = 'info', title, children,
}: { tone?: 'info' | 'warn' | 'tip'; title?: string; children: React.ReactNode }) {
  const box = {
    info: 'border-info/30 bg-info/5',
    warn: 'border-warn/30 bg-warn/10',
    tip:  'border-success/30 bg-success/5',
  }[tone]
  const dot = { info: '#3B82F6', warn: '#CA8A04', tip: '#16A34A' }[tone]
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 ${box}`}>
      {title && (
        <p className="text-[12.5px] font-semibold text-ink mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dot }} /> {title}
        </p>
      )}
      <div className="text-[13px] text-slate-dark leading-relaxed">{children}</div>
    </div>
  )
}

// A field-reference table (Campo | Qué es | Obligatorio | Por defecto).
export function FieldTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse min-w-[540px]">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label-cap font-medium text-slate px-2 py-2 whitespace-nowrap">Campo</th>
            <th className="label-cap font-medium text-slate px-2 py-2">Qué es</th>
            <th className="label-cap font-medium text-slate px-2 py-2 text-center whitespace-nowrap">Oblig.</th>
            <th className="label-cap font-medium text-slate px-2 py-2 whitespace-nowrap">Por defecto</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Field({
  campo, obligatorio, porDefecto, children,
}: { campo: string; obligatorio?: boolean; porDefecto?: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="px-2 py-2 text-ink font-medium whitespace-nowrap">
        {campo}{obligatorio && <span className="text-danger ml-0.5">*</span>}
      </td>
      <td className="px-2 py-2 text-slate-dark leading-relaxed">{children}</td>
      <td className="px-2 py-2 text-center">
        {obligatorio ? <span className="text-danger font-medium">Sí</span> : <span className="text-slate">No</span>}
      </td>
      <td className="px-2 py-2 text-slate-dark whitespace-nowrap tabular-nums">{porDefecto ?? '—'}</td>
    </tr>
  )
}

// One "message -> cause -> fix" error entry.
export function ErrorRow({ msg, children }: { msg: string; children: React.ReactNode }) {
  return (
    <li className="border-b border-line/60 pb-2.5">
      <p className="text-[13px] text-danger font-medium">&ldquo;{msg}&rdquo;</p>
      <p className="text-[13px] text-slate-dark leading-relaxed mt-0.5">{children}</p>
    </li>
  )
}
