import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { listBanks, listBankAccounts } from '@/lib/entities/queries'

export default async function BancosPage() {
  const [banks, accounts] = await Promise.all([listBanks(), listBankAccounts()])

  const totalBanks         = banks.length
  const totalAccounts      = accounts.length
  const adminAccounts      = accounts.filter(a => a.ownerType === 'admin'    ).length
  const landlordAccounts   = accounts.filter(a => a.ownerType === 'landlord' ).length

  const kpis = [
    { label: 'Bancos disponibles',  value: totalBanks.toString(),       delta: 'lista maestra',           tone: 'neutral' as const },
    { label: 'Cuentas registradas', value: totalAccounts.toString(),    delta: 'todas las cuentas',       tone: 'neutral' as const },
    { label: 'De la administración', value: adminAccounts.toString(),    delta: 'cuentas operativas',     tone: 'positive' as const },
    { label: 'De propietarios',     value: landlordAccounts.toString(), delta: 'CBUs para transferir',   tone: 'neutral' as const },
  ]

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Bancos y cuentas</strong>
          </p>
          <p className="label-cap text-slate">Datos en vivo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Cuentas bancarias</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Las cuentas operativas (administración) reciben las comisiones; las de propietarios reciben las transferencias.
          </p>
        </div>
        <div className="overflow-x-auto">
          {accounts.length > 0 ? (
            <table className="w-full text-[13px] min-w-[860px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Alias</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Banco</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Tipo</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">CBU</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Titular</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, idx) => (
                  <tr key={a.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors`}>
                    <td className="px-5 py-3 text-ink font-medium">
                      <Link href={`/bancos/${a.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                        {a.alias}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-dark">{a.bankName}</td>
                    <td className="px-5 py-3 text-slate-dark">{a.accountType}</td>
                    <td className="px-5 py-3 text-slate-dark tabular-nums">{a.cbu ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-5 py-3 text-slate-dark">{a.ownerLabel}</td>
                    <td className="px-5 py-3 text-slate-dark capitalize">{categoryLabel(a.ownerType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate mb-2">Aún no hay cuentas cargadas</p>
              <p className="text-[12px] text-slate">
                Cuando Alejandro cargue los CBUs de Pampa y de los propietarios, aparecerán acá.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Lista maestra de bancos</h2>
          <p className="text-[12px] text-slate mt-0.5">
            {banks.length} bancos disponibles para crear cuentas
          </p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {banks.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-2 border border-line text-[12px] text-slate-dark"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-dark/40" />
                {b.name}
                {b.shortCode && (
                  <span className="text-[10px] text-slate ml-1 uppercase tracking-wider">{b.shortCode}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function categoryLabel(t: 'admin' | 'administrator' | 'landlord' | 'unknown') {
  switch (t) {
    case 'admin':         return 'Administración'
    case 'administrator': return 'Socio'
    case 'landlord':      return 'Propietario'
    default:              return '—'
  }
}
