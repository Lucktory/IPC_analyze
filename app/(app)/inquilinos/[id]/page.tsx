import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'

interface InquilinoData {
  nombre: string
  iniciales: string
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
  pagos: Array<{ fecha: string; periodo: string; monto: number; estado: 'Pagado' | 'Atrasado' | 'Pendiente' }>
  aumentos: Array<{ fecha: string; indice: string; factor: number; anterior: number; nuevo: number }>
}

const inquilinos: Record<string, InquilinoData> = {
  '142': {
    nombre: 'Juan Pérez',
    iniciales: 'JP',
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

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default async function InquilinoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = inquilinos[id]
  if (!data) notFound()

  const punitorio = data.diasAtraso ? Math.round((data.alquiler * 0.05 / 30) * data.diasAtraso) : 0

  return (
    <>
      <div className="mb-6">
        <Link href="/inquilinos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          <span>←</span>
          <span>Volver a Inquilinos</span>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center font-display font-semibold text-[18px] tracking-tight">
          {data.iniciales}
        </div>
        <div className="flex-1">
          <h1 className="font-display text-[24px] text-ink leading-tight tracking-tight">{data.nombre}</h1>
          <p className="text-[12px] text-slate mt-1">
            Inquilino · Contrato <span className="tabular-nums">{data.contrato}</span> · desde {data.fechaInicio}
          </p>
        </div>
        <Badge tone={data.estado === 'Al día' ? 'success' : 'danger'}>
          {data.estado === 'Al día' ? 'Al día' : `Atrasado ${data.diasAtraso} días`}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded p-5">
          <h2 className="label-cap mb-4">Datos de contacto</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Email</dt>
              <dd className="text-[13px] text-ink">{data.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Teléfono</dt>
              <dd className="text-[13px] text-ink tabular-nums">{data.telefono}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">DNI</dt>
              <dd className="text-[13px] text-ink tabular-nums">{data.dni}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Propietario</dt>
              <dd className="text-[13px] text-ink">{data.propietario}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-paper border border-line rounded p-5">
          <h2 className="label-cap mb-4">Contrato vigente</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Dirección</dt>
              <dd className="text-[13px] text-ink">{data.direccion}</dd>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Alquiler</dt>
                <dd className="text-[15px] font-display font-semibold text-ink tabular-nums">{fmt(data.alquiler)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Expensas</dt>
                <dd className="text-[15px] font-display font-semibold text-ink tabular-nums">{fmt(data.expensas)}</dd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Índice</dt>
                <dd className="text-[13px] text-ink">{data.indice}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Cadencia</dt>
                <dd className="text-[13px] text-ink">{data.cadencia}</dd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Próximo aumento</dt>
                <dd className="text-[13px] text-ink tabular-nums">{data.proximoAumento}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Fin de contrato</dt>
                <dd className="text-[13px] text-ink tabular-nums">{data.finContrato}</dd>
              </div>
            </div>
            <div>
              <dt className="text-[11px] text-slate uppercase tracking-wider mb-0.5">Deposita en</dt>
              <dd className="text-[13px] text-ink">{data.banco}</dd>
            </div>
          </dl>
        </section>
      </div>

      {data.diasAtraso && (
        <div className="mt-6 bg-paper border border-danger/30 rounded p-5">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="label-cap text-danger">Atraso vigente</p>
              <p className="text-[13px] text-ink mt-1">
                Pago de junio 2026 vencido hace <strong className="text-danger">{data.diasAtraso} días</strong>. Punitorio acumulado: <strong className="text-ink tabular-nums">{fmt(punitorio)}</strong>.
              </p>
            </div>
            <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
              Enviar recordatorio
            </button>
          </div>
        </div>
      )}

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
