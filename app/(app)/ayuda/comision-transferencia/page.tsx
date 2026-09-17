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
          <Step n={3}>La columna <strong className="text-ink">ADMI</strong> muestra el <strong className="text-ink">total</strong> de la comisión (Galicia + BBVA 50/9 + BBVA 51/6). Si hay ingresos pero todavía no la cargaste, en ADMI tocás <strong className="text-ink">«Calcular»</strong>, elegís el <strong className="text-ink">banco</strong> (Galicia / BBVA) y queda cargada al % del contrato.</Step>
          <Step n={4}>En la columna <strong className="text-ink">IVA</strong>, un clic marca si la comisión lleva <strong className="text-ink">IVA 21%</strong> (administrador Responsable Inscripto) o no (Monotributo). Cuando lleva, muestra la parte de IVA.</Step>
        </ul>
        <Callout tone="warn" title="Aviso de monto alto">
          Si cargás en un banco un monto <strong className="text-ink">mayor</strong> a la comisión esperada (ingresos × %), el sistema
          te pide confirmar, por las dudas.
        </Callout>
        <Callout tone="tip" title="«Calcular todas» — el repaso final del mes">
          Arriba de la planilla, al lado de <strong className="text-ink">+ Nuevo contrato</strong>, calcula de una vez la
          comisión de todos los contratos del mes.
          <br />
          Primero te muestra la lista de lo que va a calcular —qué contrato, con qué % y cuánto— y no toca nada hasta
          que confirmás. Sólo agarra los contratos que ya tienen cobros cargados, y cada uno va con SU % y su banco.
          <br />
          También corrige las que quedaron viejas: si calculaste la comisión y después cargaste una THU o un recupero,
          esa comisión quedó corta y este botón la pone al día. Por eso conviene pasarlo <strong className="text-ink">al
          final</strong>, cuando ya no vas a cargar más nada del mes.
          <br />
          Si está todo bien, la lista sale vacía y no pasa nada.
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
          Tocá el cartelito de la columna <strong className="text-ink">Estado</strong> y elegí:{' '}
          <strong className="text-ink">Borrador</strong>, <strong className="text-ink">Enviada</strong> o <strong className="text-ink">Pagada</strong>.
          Podés ir a cualquiera de una, así que si te equivocás volvés atrás enseguida.
          Normalmente no vas a tener que tocarlo: pasa a <em>Enviada</em> solo cuando confirmás que mandaste el mail
          (ver abajo), y a <em>Pagada</em> la ponés vos cuando el dueño confirmó que recibió.
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
          Vos confirmás y enviás desde tu propio mail. El mail sale de <strong className="text-ink">tu casilla</strong>,
          no de una dirección del sistema, así que el propietario te ve a vos como remitente y te puede contestar.
        </Callout>
        <Callout tone="warn" title="Abrir Gmail NO lo marca como enviado">
          Al volver, la ventana te pregunta si lo mandaste. Recién cuando tocás{' '}
          <strong className="text-ink">«Sí, ya lo envié»</strong> la liquidación pasa a <strong className="text-ink">Enviada</strong>.
          <br />
          Es a propósito: si abrís Gmail y después te arrepentís, no queda marcado como mandado cuando en realidad no lo mandaste.
        </Callout>
        <Callout tone="warn" title="Contratos con DOS propietarios: no los mandes todavía">
          Hay <strong className="text-ink">15 contratos</strong> con dos dueños al 50 y 50. En esos, el sistema le
          manda la rendición a <strong className="text-ink">uno solo</strong> de los dos, y con el monto
          <strong className="text-ink"> completo</strong> del contrato, como si fuera todo suyo. El otro dueño no
          recibe nada.
          <br />
          Todavía no está definido cómo corresponde repartirlo, así que esos contratos manejalos a mano
          hasta nuevo aviso. Los de un solo propietario están bien.
        </Callout>
        <Callout tone="tip" title="Los descuentos salen detallados">
          En el mail, los <strong className="text-ink">Otros descuentos</strong> le llegan al propietario uno por uno, con el
          nombre de cada uno, y después el total.
          <br />
          <strong className="text-ink">Ojo:</strong> ese nombre es la <strong className="text-ink">descripción</strong> que
          cargaste al anotar el gasto. O sea que lo lee el dueño. Poné descripciones claras y cortas
          («Expensas extraordinarias», «Reparación termotanque»), no notas internas.
        </Callout>
      </GuideCard>

      {/* rendicion */}
      <GuideCard title="5. La rendición para imprimir" tint="#7C3AED">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Además del mail, cada liquidación tiene su <strong className="text-ink">hoja de rendición</strong>:
          la misma que venían armando a mano, con el logo, los datos de la inmobiliaria,
          y las dos columnas de <strong className="text-ink">Ingresos</strong> y <strong className="text-ink">Deducciones</strong>.
        </p>
        <ul className="mt-2 space-y-2">
          <Step n={1}>En la planilla, en la columna <strong className="text-ink">Mail</strong>, tocá el iconito de hoja que está al lado de <strong className="text-ink">Enviar</strong>.</Step>
          <Step n={2}>Se abre la rendición. Arriba a la derecha tenés <strong className="text-ink">Imprimir / PDF</strong>: sale sólo la hoja, sin el resto de la pantalla.</Step>
          <Step n={3}>La <strong className="text-ink">fecha</strong> la pone el sistema: es el día que la mandás. Si después la reimprimís, conserva la fecha original.</Step>
        </ul>
        <Callout tone="tip" title="Contratos con dos propietarios">
          Sale <strong className="text-ink">una sola hoja</strong>, con una línea por dueño mostrando la parte de cada uno,
          y el <strong className="text-ink">Total a rendir</strong> con el monto entero. Igual que la hacían ustedes.
        </Callout>
        <Callout tone="tip" title="Si el inquilino pagó de más">
          La línea del alquiler se parte sola en dos: lo que corresponde al mes, y abajo
          <strong className="text-ink"> A CUENTA</strong> del mes siguiente. El total no cambia y al dueño le va la plata entera —
          la línea es para que el mes que viene, cuando entre menos, no lo sorprenda.
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
        <Link href="/ayuda/como-se-calcula" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Cómo se calcula la liquidación</Link>
        <Link href="/ayuda/conciliacion" className="text-[13px] text-info hover:underline transition-colors inline-flex items-center gap-1">Siguiente: Conciliación →</Link>
      </div>
    </div>
  )
}
