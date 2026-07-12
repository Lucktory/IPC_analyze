import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout, ErrorRow } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Comisión y transferencia — Ayuda' }

export default function ComisionTransferenciaPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Comisión y transferencia" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Comisión y transferencia</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Comisión y transferencia</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          La comisión de administración y su reparto por banco, el neto que va al dueño, y cómo mandarle la
          liquidación por mail. El cierre del mes.
        </p>
      </header>

      {/* comisión */}
      <GuideCard title="1. Comisión (ADMI) y bancos" tint="#CA8A04">
        <ul className="space-y-2">
          <Step n={1}>El <strong className="text-ink">%</strong> de comisión se pone en la columna <strong className="text-ink">Pct</strong> (o en la ficha; ver <em>Editar un contrato</em>).</Step>
          <Step n={2}>Registrás la comisión cobrada en las columnas de banco: <strong className="text-ink">Galicia</strong>, <strong className="text-ink">BBVA 50/9</strong> y <strong className="text-ink">BBVA 51/6</strong>. Clic en la celda y ponés el monto de cada una.</Step>
          <Step n={3}>La columna <strong className="text-ink">ADMI</strong> muestra el <strong className="text-ink">total</strong> de la comisión (Galicia + BBVA 50/9 + BBVA 51/6). Si hay ingresos pero todavía no la cargaste, en ADMI aparece un botón <strong className="text-ink">«Calcular»</strong> que la genera sola (ingresos × %).</Step>
          <Step n={4}>En la columna <strong className="text-ink">IVA</strong>, un clic marca si la comisión lleva <strong className="text-ink">IVA 21%</strong> (administrador Responsable Inscripto) o no (Monotributo). Cuando lleva, muestra la parte de IVA.</Step>
        </ul>
        <Callout tone="warn" title="Aviso de monto alto">
          Si cargás en un banco un monto <strong className="text-ink">mayor</strong> a la comisión esperada (ingresos × %), el sistema
          te pide confirmar, por las dudas.
        </Callout>
      </GuideCard>

      {/* transferencia */}
      <GuideCard title="2. Transferencia al dueño" tint="#16A34A">
        <ul className="space-y-2">
          <Step n={1}>La columna <strong className="text-ink">Transferencia</strong> es el <strong className="text-ink">neto</strong> que va al propietario: cobros − comisión − otros + ajustes cobrados.</Step>
          <Step n={2}>Clic en la celda para registrar / editar la transferencia hecha.</Step>
          <Step n={3}>La columna <strong className="text-ink">D. transf</strong> muestra la fecha de la transferencia.</Step>
        </ul>
      </GuideCard>

      {/* estado */}
      <GuideCard title="3. Estado de la liquidación" tint="#475569">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          La columna <strong className="text-ink">Estado</strong> avanza con cada clic: <strong className="text-ink">Borrador → Enviada → Pagada</strong>{' '}
          (y vuelve a Borrador). Normalmente pasa a <em>Enviada</em> sola cuando mandás el mail (ver abajo), y a <em>Pagada</em>
          la ponés vos cuando el dueño confirmó que recibió.
        </p>
      </GuideCard>

      {/* enviar */}
      <GuideCard title="4. Enviar la liquidación por mail" tint="#16A34A">
        <ul className="space-y-2">
          <Step n={1}>En la columna <strong className="text-ink">Mail</strong>, tocá <strong className="text-ink">✉ Enviar</strong>. (Si la liquidación ya está <em>Pagada</em>, el botón no aparece.)</Step>
          <Step n={2}>Se abre <strong className="text-ink">Liquidar y enviar mail</strong> con un resumen: Total cobrado, Comisión, Otros, ajustes y <strong className="text-ink">Neto a transferir</strong>.</Step>
          <Step n={3}>Revisá / completá: <strong className="text-ink">Tu email</strong> (remitente — se guarda para la próxima vez), <strong className="text-ink">Email del propietario</strong>, <strong className="text-ink">Asunto</strong> y <strong className="text-ink">Cuerpo</strong> (todo editable).</Step>
          <Step n={4}>Elegí cómo mandarlo:
            <br /><strong className="text-ink">✉ Abrir en Gmail</strong> — abre Gmail web en una pestaña nueva, con el mensaje listo (funciona sin configurar nada).
            <br /><strong className="text-ink">Abrir programa de mail</strong> — usa Outlook / Thunderbird si lo tenés configurado.
          </Step>
        </ul>
        <Callout tone="warn" title="Importante: el sistema no manda mails solo">
          Vos confirmás y enviás desde tu propio mail. Recién <strong className="text-ink">al tocar uno de esos dos botones</strong> la
          liquidación se marca como <strong className="text-ink">Enviada</strong>. Si tocás <strong className="text-ink">Cancelar</strong>, queda en Borrador.
        </Callout>
      </GuideCard>

      {/* errores */}
      <GuideCard title="Errores que pueden aparecer" tint="#DC2626">
        <ul className="space-y-2.5">
          <ErrorRow msg="Falta el email del propietario.">
            Quisiste enviar sin destinatario. Cargá el email del dueño en el campo «Email del propietario» (o en su ficha).
          </ErrorRow>
          <ErrorRow msg="(Aviso al cargar un banco) El monto supera la comisión esperada — ¿confirmás?">
            Cargaste en un banco más que la comisión esperada (ingresos × %). Si está bien, confirmá; si fue error, corregí el monto.
          </ErrorRow>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/honorarios" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Honorarios</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Rescindir / reactivar contrato (próximamente)</span>
      </div>
    </div>
  )
}
