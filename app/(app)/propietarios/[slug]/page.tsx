import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Mail, Phone, IdCard, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface PropietarioData {
  nombre: string
  iniciales: string
  foto: string
  email: string
  telefono: string
  cuit: string
  desde: string
  comision: number
  banco: string
  cuenta: string
  alias: string
  ingresosMes: number
  liquidacionMes: number
  propiedades: Array<{ contrato: string; direccion: string; alquiler: number; inquilino: string; estado: 'Al día' | 'Atrasado' }>
  liquidaciones: Array<{ fecha: string; periodo: string; bruto: number; comision: number; deducciones: number; neto: number; estado: 'Pagada' | 'Pendiente' }>
}

const propietarios: Record<string, PropietarioData> = {
  bianchi: {
    nombre: 'Marco Bianchi',
    iniciales: 'MB',
    foto: 'https://i.pravatar.cc/200?img=33',
    email: 'marco.bianchi@example.com',
    telefono: '+54 11 4567-8910',
    cuit: '20-12345678-9',
    desde: 'Marzo 2022',
    comision: 8,
    banco: 'Banco Galicia',
    cuenta: '0070-0123-45-678901',
    alias: 'CC Galicia Principal',
    ingresosMes: 4250000,
    liquidacionMes: 3910000,
    propiedades: [
      { contrato: '#091', direccion: 'Av. Pueyrredón 1550, Recoleta',     alquiler: 410000, inquilino: 'Fernández', estado: 'Al día'    },
      { contrato: '#142', direccion: 'Av. Santa Fe 2480, Palermo',        alquiler: 180000, inquilino: 'Pérez',     estado: 'Atrasado'  },
      { contrato: '#205', direccion: 'Av. Rivadavia 7820, Caballito',     alquiler: 235000, inquilino: 'Ortiz',     estado: 'Al día'    },
      { contrato: '#118', direccion: 'Charcas 3290, Palermo',             alquiler: 285000, inquilino: 'Sánchez',   estado: 'Al día'    },
      { contrato: '#172', direccion: 'Gorriti 4555, Palermo',             alquiler: 295000, inquilino: 'Torres',    estado: 'Al día'    },
    ],
    liquidaciones: [
      { fecha: '03/06/26', periodo: 'Mayo 2026',    bruto: 4250000, comision: 340000, deducciones: 0,     neto: 3910000, estado: 'Pagada'    },
      { fecha: '05/05/26', periodo: 'Abril 2026',   bruto: 4250000, comision: 340000, deducciones: 12500, neto: 3897500, estado: 'Pagada'    },
      { fecha: '04/04/26', periodo: 'Marzo 2026',   bruto: 3750000, comision: 300000, deducciones: 0,     neto: 3450000, estado: 'Pagada'    },
      { fecha: '05/03/26', periodo: 'Febrero 2026', bruto: 3750000, comision: 300000, deducciones: 8000,  neto: 3442000, estado: 'Pagada'    },
      { fecha: '—',        periodo: 'Junio 2026',   bruto: 3830000, comision: 306400, deducciones: 0,     neto: 3523600, estado: 'Pendiente' },
    ],
  },
  romano: {
    nombre: 'Lucía Romano',
    iniciales: 'LR',
    foto: 'https://i.pravatar.cc/200?img=42',
    email: 'lucia.romano@example.com',
    telefono: '+54 11 5234-7128',
    cuit: '27-23456789-1',
    desde: 'Septiembre 2023',
    comision: 10,
    banco: 'Banco Santander',
    cuenta: '0072-0234-56-789012',
    alias: 'CC Santander',
    ingresosMes: 3680000,
    liquidacionMes: 3312000,
    propiedades: [
      { contrato: '#087', direccion: 'Av. Las Heras 1920, Recoleta',      alquiler: 250000, inquilino: 'García',    estado: 'Al día' },
      { contrato: '#143', direccion: 'Honduras 4521, Palermo',            alquiler: 245000, inquilino: 'Domínguez', estado: 'Al día' },
      { contrato: '#155', direccion: 'Soler 4188, Villa Crespo',          alquiler: 195000, inquilino: 'López',     estado: 'Al día' },
    ],
    liquidaciones: [
      { fecha: '04/06/26', periodo: 'Mayo 2026',    bruto: 3680000, comision: 368000, deducciones: 0,     neto: 3312000, estado: 'Pagada'    },
      { fecha: '06/05/26', periodo: 'Abril 2026',   bruto: 3680000, comision: 368000, deducciones: 0,     neto: 3312000, estado: 'Pagada'    },
      { fecha: '05/04/26', periodo: 'Marzo 2026',   bruto: 3240000, comision: 324000, deducciones: 15000, neto: 2901000, estado: 'Pagada'    },
      { fecha: '—',        periodo: 'Junio 2026',   bruto: 3380000, comision: 338000, deducciones: 0,     neto: 3042000, estado: 'Pendiente' },
    ],
  },
  costa: {
    nombre: 'Andrea Costa',
    iniciales: 'AC',
    foto: 'https://i.pravatar.cc/200?img=47',
    email: 'andrea.costa@example.com',
    telefono: '+54 11 4892-3741',
    cuit: '27-34567890-3',
    desde: 'Enero 2024',
    comision: 8,
    banco: 'Banco BBVA',
    cuenta: '0017-0456-78-901234',
    alias: 'CC BBVA',
    ingresosMes: 2470000,
    liquidacionMes: 2272400,
    propiedades: [
      { contrato: '#073', direccion: 'Salguero 2435, Palermo',            alquiler: 165000, inquilino: 'Martínez',  estado: 'Atrasado' },
      { contrato: '#088', direccion: 'Aráoz 950, Almagro',                alquiler: 210000, inquilino: 'Gómez',     estado: 'Atrasado' },
      { contrato: '#144', direccion: 'Av. Cabildo 1850, Belgrano',        alquiler: 310000, inquilino: 'Vázquez',   estado: 'Al día'   },
    ],
    liquidaciones: [
      { fecha: '03/06/26', periodo: 'Mayo 2026',    bruto: 2470000, comision: 197600, deducciones: 0,     neto: 2272400, estado: 'Pagada'    },
      { fecha: '05/05/26', periodo: 'Abril 2026',   bruto: 2470000, comision: 197600, deducciones: 22000, neto: 2250400, estado: 'Pagada'    },
      { fecha: '—',        periodo: 'Junio 2026',   bruto: 2095000, comision: 167600, deducciones: 0,     neto: 1927400, estado: 'Pendiente' },
    ],
  },
}

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default async function PropietarioDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = propietarios[slug]
  if (!data) notFound()

  const totalProps = data.propiedades.length
  const alDia = data.propiedades.filter(p => p.estado === 'Al día').length
  const atrasados = totalProps - alDia
  const healthPct = Math.round((alDia / totalProps) * 100)

  return (
    <>
      <div className="mb-6">
        <Link href="/propietarios" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          <span>←</span>
          <span>Volver a Propietarios</span>
        </Link>
      </div>

      <div className="flex items-center gap-5 mb-8 flex-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.foto}
          alt={data.nombre}
          className="w-16 h-16 rounded-full object-cover border border-line"
        />
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[24px] text-ink leading-tight tracking-tight">{data.nombre}</h1>
          <p className="text-[12px] text-slate mt-1">
            Propietario · {data.propiedades.length} propiedades · cliente desde {data.desde}
          </p>
        </div>
        <Badge tone={atrasados > 0 ? 'danger' : 'success'}>
          {atrasados > 0 ? `${atrasados} inquilinos atrasados` : 'Cartera al día'}
        </Badge>
      </div>

      {/* Estado de la cartera — flush hero */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
          <h2 className="label-cap">Estado de la cartera</h2>
          <span className="text-[11px] text-slate tabular-nums">
            {alDia} de {totalProps} al día · {healthPct}%
          </span>
        </div>

        <div className="mb-6">
          <div className="h-[3px] bg-line rounded-full overflow-hidden flex">
            <div
              className="bg-success transition-all duration-500"
              style={{ width: `${healthPct}%` }}
            />
            {atrasados > 0 && (
              <div
                className="bg-danger transition-all duration-500"
                style={{ width: `${100 - healthPct}%` }}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
          {data.propiedades.map((p) => (
            <div key={p.contrato} className="flex items-center gap-2 text-[12px]">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  p.estado === 'Al día' ? 'bg-success' : 'bg-danger'
                }`}
              />
              <span className="text-slate-dark tabular-nums">{p.contrato}</span>
              <span className="text-ink truncate">{p.inquilino}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded shadow-card p-5">
          <h2 className="label-cap mb-5">Datos de contacto</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1.5">Email</dt>
              <dd className="text-[13px] text-ink flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate shrink-0" strokeWidth={1.5} />
                <span>{data.email}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1.5">Teléfono</dt>
              <dd className="text-[13px] text-ink flex items-center gap-2 tabular-nums">
                <Phone className="w-3.5 h-3.5 text-slate shrink-0" strokeWidth={1.5} />
                <span>{data.telefono}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1.5">CUIT</dt>
              <dd className="text-[13px] text-ink flex items-center gap-2 tabular-nums">
                <IdCard className="w-3.5 h-3.5 text-slate shrink-0" strokeWidth={1.5} />
                <span>{data.cuit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1.5">Cliente desde</dt>
              <dd className="text-[13px] text-ink flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate shrink-0" strokeWidth={1.5} />
                <span>{data.desde}</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-paper border border-line rounded shadow-card p-5">
          <h2 className="label-cap mb-5">Cobro y liquidaciones</h2>
          <dl className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Comisión</dt>
                <dd className="text-[15px] font-display font-semibold text-ink tabular-nums">{data.comision}%</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Ingresos del mes</dt>
                <dd className="text-[15px] font-display font-semibold text-ink tabular-nums">{fmt(data.ingresosMes)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Banco</dt>
              <dd className="text-[13px] text-ink">{data.banco}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Cuenta</dt>
              <dd className="text-[13px] text-ink tabular-nums">{data.cuenta}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Alias</dt>
              <dd className="text-[13px] text-ink">{data.alias}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Propiedades administradas</h2>
            <p className="text-[12px] text-slate mt-0.5">{data.propiedades.length} unidades bajo administración</p>
          </div>
          <Badge tone="neutral">{data.propiedades.length} propiedades</Badge>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Dirección</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.propiedades.map((p, i) => (
              <tr
                key={p.contrato}
                className={
                  p.estado === 'Atrasado'
                    ? 'bg-danger/[0.08] transition-colors'
                    : (i % 2 === 0 ? 'bg-cream/40' : '')
                }
              >
                <td className="px-5 py-3 tabular-nums text-slate-dark font-medium">{p.contrato}</td>
                <td className="px-5 py-3 text-ink">{p.direccion}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(p.alquiler)}</td>
                <td className="px-5 py-3 text-slate-dark">{p.inquilino}</td>
                <td className="px-5 py-3">
                  <Badge tone={p.estado === 'Al día' ? 'success' : 'danger'}>{p.estado}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Liquidaciones recientes</h2>
          <p className="text-[12px] text-slate mt-0.5">Bruto cobrado, comisión deducida, neto liquidado</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Fecha</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Período</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Bruto</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Comisión</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Deducciones</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Neto</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.liquidaciones.map((l, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{l.fecha}</td>
                <td className="px-5 py-3 text-ink">{l.periodo}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(l.bruto)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(l.comision)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(l.deducciones)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink font-medium">{fmt(l.neto)}</td>
                <td className="px-5 py-3">
                  <Badge tone={l.estado === 'Pagada' ? 'success' : 'neutral'}>{l.estado}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
