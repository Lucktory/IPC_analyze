import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Mail, Phone, IdCard, User } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

type PaymentStatus = 'paid' | 'late' | 'pending'

interface InquilinoData {
  nombre: string
  iniciales: string
  foto: string
  email: string
  telefono: string
  dni: string
  fechaInicio: string
  contrato: string
  direccion: string
  alquiler: number
  expensas: number
  indice: 'IPC' | 'ICL' | 'Casa Propia'
  cadencia: 'Trimestral' | 'Semestral' | 'Anual'
  proximoAumento: string
  finContrato: string
  estado: 'Al día' | 'Atrasado'
  diasAtraso?: number
  propietario: string
  banco: string
  paymentGrid: PaymentStatus[]
  pagos: Array<{ fecha: string; periodo: string; monto: number; estado: 'Pagado' | 'Atrasado' | 'Pendiente' }>
  aumentos: Array<{ fecha: string; indice: string; factor: number; anterior: number; nuevo: number }>
}

const inquilinos: Record<string, InquilinoData> = {
  '142': {
    nombre: 'Juan Pérez',
    iniciales: 'JP',
    foto: 'https://i.pravatar.cc/200?img=12',
    email: 'juan.perez@example.com',
    telefono: '+54 11 4823-5847',
    dni: '28.456.789',
    fechaInicio: '08/09/2024',
    contrato: '#142',
    direccion: 'Av. Santa Fe 2480, 3er piso B, Palermo, CABA',
    alquiler: 180000,
    expensas: 28500,
    indice: 'IPC',
    cadencia: 'Trimestral',
    proximoAumento: '08/06/2026',
    finContrato: '08/09/2027',
    estado: 'Atrasado',
    diasAtraso: 15,
    propietario: 'Marco Bianchi',
    banco: 'Banco Galicia',
    paymentGrid: ['paid','paid','paid','paid','paid','paid','paid','paid','paid','paid','paid','late'],
    pagos: [
      { fecha: '—',         periodo: 'Junio 2026',     monto: 180000, estado: 'Atrasado'  },
      { fecha: '03/05/26',  periodo: 'Mayo 2026',      monto: 180000, estado: 'Pagado'    },
      { fecha: '02/04/26',  periodo: 'Abril 2026',     monto: 180000, estado: 'Pagado'    },
      { fecha: '05/03/26',  periodo: 'Marzo 2026',     monto: 158500, estado: 'Pagado'    },
      { fecha: '04/02/26',  periodo: 'Febrero 2026',   monto: 158500, estado: 'Pagado'    },
      { fecha: '06/01/26',  periodo: 'Enero 2026',     monto: 158500, estado: 'Pagado'    },
    ],
    aumentos: [
      { fecha: '08/03/26', indice: 'IPC', factor: 1.1357, anterior: 158500, nuevo: 180000 },
      { fecha: '08/12/25', indice: 'IPC', factor: 1.0845, anterior: 146200, nuevo: 158500 },
      { fecha: '08/09/25', indice: 'IPC', factor: 1.0719, anterior: 136400, nuevo: 146200 },
    ],
  },
  '087': {
    nombre: 'Sofía García',
    iniciales: 'SG',
    foto: 'https://i.pravatar.cc/200?img=49',
    email: 'sofia.garcia@example.com',
    telefono: '+54 11 5247-8390',
    dni: '32.108.554',
    fechaInicio: '12/03/2024',
    contrato: '#087',
    direccion: 'Av. Las Heras 1920, 5to piso A, Recoleta, CABA',
    alquiler: 250000,
    expensas: 38000,
    indice: 'IPC',
    cadencia: 'Trimestral',
    proximoAumento: '12/06/2026',
    finContrato: '12/03/2027',
    estado: 'Al día',
    propietario: 'Lucía Romano',
    banco: 'Banco Santander',
    paymentGrid: ['paid','paid','paid','paid','paid','paid','paid','paid','paid','paid','paid','paid'],
    pagos: [
      { fecha: '04/06/26', periodo: 'Junio 2026',   monto: 250000, estado: 'Pagado' },
      { fecha: '05/05/26', periodo: 'Mayo 2026',    monto: 250000, estado: 'Pagado' },
      { fecha: '05/04/26', periodo: 'Abril 2026',   monto: 250000, estado: 'Pagado' },
      { fecha: '05/03/26', periodo: 'Marzo 2026',   monto: 220150, estado: 'Pagado' },
      { fecha: '04/02/26', periodo: 'Febrero 2026', monto: 220150, estado: 'Pagado' },
      { fecha: '06/01/26', periodo: 'Enero 2026',   monto: 220150, estado: 'Pagado' },
    ],
    aumentos: [
      { fecha: '12/03/26', indice: 'IPC', factor: 1.1357, anterior: 220150, nuevo: 250000 },
      { fecha: '12/12/25', indice: 'IPC', factor: 1.0845, anterior: 203000, nuevo: 220150 },
    ],
  },
  '073': {
    nombre: 'Cecilia Martínez',
    iniciales: 'CM',
    foto: 'https://i.pravatar.cc/200?img=44',
    email: 'cecilia.martinez@example.com',
    telefono: '+54 11 4178-2965',
    dni: '30.554.218',
    fechaInicio: '04/01/2024',
    contrato: '#073',
    direccion: 'Salguero 2435, 2do piso C, Palermo, CABA',
    alquiler: 165000,
    expensas: 24000,
    indice: 'IPC',
    cadencia: 'Trimestral',
    proximoAumento: '04/07/2026',
    finContrato: '04/01/2027',
    estado: 'Atrasado',
    diasAtraso: 6,
    propietario: 'Andrea Costa',
    banco: 'Banco BBVA',
    paymentGrid: ['paid','paid','paid','paid','paid','paid','paid','paid','paid','paid','paid','late'],
    pagos: [
      { fecha: '—',         periodo: 'Junio 2026',     monto: 165000, estado: 'Atrasado' },
      { fecha: '04/05/26',  periodo: 'Mayo 2026',      monto: 165000, estado: 'Pagado'   },
      { fecha: '05/04/26',  periodo: 'Abril 2026',     monto: 165000, estado: 'Pagado'   },
      { fecha: '04/03/26',  periodo: 'Marzo 2026',     monto: 145300, estado: 'Pagado'   },
    ],
    aumentos: [
      { fecha: '04/04/26', indice: 'IPC', factor: 1.1357, anterior: 145300, nuevo: 165000 },
      { fecha: '04/01/26', indice: 'IPC', factor: 1.0845, anterior: 134000, nuevo: 145300 },
    ],
  },
}

const TODAY = new Date('2026-06-06')
const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

function parseDate(s: string) {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(y, m - 1, d)
}

function calcProgress(startStr: string, endStr: string) {
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  const total = end.getTime() - start.getTime()
  const elapsed = TODAY.getTime() - start.getTime()
  return Math.round(Math.max(0, Math.min(100, (elapsed / total) * 100)))
}

function calcRemainingMonths(endStr: string) {
  const end = parseDate(endStr)
  return Math.max(0, Math.round((end.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
}

// Last 12 month labels ending at current month (June 2026)
const MONTH_LABELS = ['Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']

export default async function InquilinoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = inquilinos[id]
  if (!data) notFound()

  const progress = calcProgress(data.fechaInicio, data.finContrato)
  const remainingMonths = calcRemainingMonths(data.finContrato)
  const punitorio = data.diasAtraso ? Math.round((data.alquiler * 0.05 / 30) * data.diasAtraso) : 0

  return (
    <>
      <div className="mb-6">
        <Link href="/inquilinos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          <span>←</span>
          <span>Volver a Inquilinos</span>
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
            Inquilino · Contrato <span className="tabular-nums">{data.contrato}</span> · firmado el <span className="tabular-nums">{data.fechaInicio}</span>
          </p>
        </div>
        <Badge tone={data.estado === 'Al día' ? 'success' : 'danger'}>
          {data.estado === 'Al día' ? 'Al día' : `Atrasado ${data.diasAtraso} días`}
        </Badge>
      </div>

      {/* Estado del contrato — flush hero, no card chrome */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
          <h2 className="label-cap">Estado del contrato</h2>
          <span className="text-[11px] text-slate tabular-nums">
            <span className="hidden sm:inline">Inicio </span>{data.fechaInicio} <span className="text-slate/60 mx-1">→</span> <span className="hidden sm:inline">Fin </span>{data.finContrato}
          </span>
        </div>

        {/* Progress: hairline on cream, today marker rings cream */}
        <div className="mb-9">
          <div className="relative h-[3px] bg-line rounded-full">
            <div
              className="absolute inset-y-0 left-0 bg-ink rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-ink ring-[3px] ring-cream transition-all duration-500"
              style={{ left: `calc(${progress}% - 5px)` }}
              title={`Hoy · ${progress}% transcurrido`}
            />
          </div>
          <div className="flex justify-between text-[11px] mt-3 tabular-nums">
            <span className="text-slate">{progress}% transcurrido</span>
            <span className="text-slate">{remainingMonths} meses restantes</span>
          </div>
        </div>

        {/* Compact payment grid */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-[10px] text-slate uppercase tracking-[0.08em]">Pagos · últimos 12 meses</p>
            <div className="flex gap-3.5 text-[10.5px] text-slate items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] bg-success/45" />
                <span>Pagado</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px] bg-danger/50" />
                <span>Atrasado</span>
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {data.paymentGrid.map((status, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <div
                  title={`${MONTH_LABELS[i]} ${i < 6 ? '2025' : '2026'} — ${status === 'paid' ? 'Pagado' : status === 'late' ? 'Atrasado' : 'Pendiente'}`}
                  className={
                    'w-7 h-7 rounded-[3px] transition-colors cursor-default ' +
                    (status === 'paid'
                      ? 'bg-success/45 hover:bg-success/60'
                      : status === 'late'
                      ? 'bg-danger/50 hover:bg-danger/65'
                      : 'bg-cream-2 hover:bg-cream-2/80')
                  }
                />
                <span className="text-[9.5px] text-slate tabular-nums leading-none">{MONTH_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {data.diasAtraso && (
        <div className="mb-8 bg-danger/[0.04] border-l-2 border-l-danger pl-5 pr-4 py-4 rounded-r">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="label-cap text-danger">Atraso vigente</p>
              <p className="text-[13px] text-ink mt-1">
                Pago de junio 2026 vencido hace <strong className="text-danger">{data.diasAtraso} días</strong>. Punitorio acumulado:{' '}
                <strong className="text-ink tabular-nums">{fmt(punitorio)}</strong>.
              </p>
            </div>
            <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
              Enviar recordatorio
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded p-5">
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
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1.5">DNI</dt>
              <dd className="text-[13px] text-ink flex items-center gap-2 tabular-nums">
                <IdCard className="w-3.5 h-3.5 text-slate shrink-0" strokeWidth={1.5} />
                <span>{data.dni}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1.5">Propietario</dt>
              <dd className="text-[13px] text-ink flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate shrink-0" strokeWidth={1.5} />
                <span>{data.propietario}</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-paper border border-line rounded p-5">
          <h2 className="label-cap mb-5">Contrato vigente</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Dirección</dt>
              <dd className="text-[13px] text-ink">{data.direccion}</dd>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Alquiler</dt>
                <dd className="text-[15px] font-display font-semibold text-ink tabular-nums">{fmt(data.alquiler)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Expensas</dt>
                <dd className="text-[15px] font-display font-semibold text-ink tabular-nums">{fmt(data.expensas)}</dd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Índice</dt>
                <dd className="text-[13px] text-ink">{data.indice}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Cadencia</dt>
                <dd className="text-[13px] text-ink">{data.cadencia}</dd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Próximo aumento</dt>
                <dd className="text-[13px] text-ink tabular-nums">{data.proximoAumento}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-1">Deposita en</dt>
                <dd className="text-[13px] text-ink">{data.banco}</dd>
              </div>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Pagos recientes</h2>
          <p className="text-[12px] text-slate mt-0.5">Últimos 6 períodos</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Fecha de pago</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Período</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Monto</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.pagos.map((p, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{p.fecha}</td>
                <td className="px-5 py-3 text-ink">{p.periodo}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(p.monto)}</td>
                <td className="px-5 py-3">
                  <Badge tone={p.estado === 'Pagado' ? 'success' : p.estado === 'Atrasado' ? 'danger' : 'neutral'}>
                    {p.estado}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Historial de aumentos</h2>
          <p className="text-[12px] text-slate mt-0.5">Ajustes aplicados con factor IPC compuesto</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Fecha</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Índice</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Factor</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Anterior</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Nuevo</th>
            </tr>
          </thead>
          <tbody>
            {data.aumentos.map((a, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 tabular-nums text-ink font-medium">{a.fecha}</td>
                <td className="px-5 py-3 text-slate-dark">{a.indice}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{a.factor.toFixed(4)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(a.anterior)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink font-medium">{fmt(a.nuevo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
