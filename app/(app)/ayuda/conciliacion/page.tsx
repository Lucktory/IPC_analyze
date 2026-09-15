import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Conciliación — Ayuda' }

// Capitulo nuevo (2026-09-15): Conciliacion nunca estuvo documentada, y encima
// cambio dos veces esta semana — ahora se arma por fecha de banco y los totales
// van separados por direccion.
//
// El punto que mas importa transmitir es que NO es un resumen de plata: es un
// tablero de control. El "Total" que habia antes sumaba entradas con salidas y
// Alejandro lo estaba leyendo como ingresos del mes.

export default function ConciliacionPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Conciliación" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Conciliación</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Conciliación</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Controlar qué movimientos ya están confirmados en el banco y cuáles todavía no. Sirve para
          cruzar el sistema contra el extracto bancario del mes.
        </p>
      </header>

      <Callout tone="warn" title="No es un resumen de plata">
        Conciliación es un <strong className="text-ink">tablero de control</strong>, no la cuenta del mes.
        Contesta «¿qué movimientos ya pasaron por el banco?», no «¿cuánto gané?».
        <br />
        Para los ingresos del mes, la <strong className="text-ink">planilla</strong>: la fila de totales de abajo.
      </Callout>

      {/* 1 — la señal */}
      <GuideCard title="1. Qué es estar conciliado" tint="#3B82F6">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Un movimiento está conciliado cuando tiene <strong className="text-ink">fecha de banco</strong>. Esa fecha
          es la que dice «esta plata efectivamente se movió».
        </p>
        <ul className="mt-2 space-y-2">
          <Step n={1}><strong className="text-success">OK (verde)</strong> — tiene fecha de banco. Confirmado.</Step>
          <Step n={2}><strong className="text-warn">Pend. (amarillo)</strong> — todavía sin fecha. Es lo que hay que perseguir.</Step>
        </ul>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Arriba tenés tres tarjetas: cuántos están <strong className="text-ink">conciliados</strong>, cuántos{' '}
          <strong className="text-ink">sin conciliar</strong> —con cuánto falta cobrar y cuánto falta pagar, separado— y
          la <strong className="text-ink">cobertura</strong> (qué porcentaje del mes ya está confirmado).
        </p>
      </GuideCard>

      {/* 2 — por fecha, no por mes contable */}
      <GuideCard title="2. Se arma por la fecha en que se movió la plata" tint="#0891B2">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Esto es importante y no es obvio: Conciliación agrupa los movimientos por la{' '}
          <strong className="text-ink">fecha de banco</strong>, no por el mes al que corresponde el pago.
        </p>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Si un inquilino termina de pagar Agosto con plata que entra el 5 de Septiembre, ese cobro lo cargás en{' '}
          <strong className="text-ink">Agosto</strong> (que es el mes al que corresponde), pero en Conciliación te aparece
          en <strong className="text-ink">Septiembre</strong>, que es cuando el banco lo vio. La fila te lo aclara con un
          cartelito <strong className="text-info">«corresponde a Agosto 2026»</strong>.
        </p>
        <Callout tone="tip" title="Por qué así">
          Porque el extracto del banco va por fecha. Si Conciliación se armara por mes contable, nunca te iba a
          cuadrar contra el banco.
        </Callout>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Lo que todavía no tiene fecha de banco se queda en su mes contable — no pasó por el banco, así que no hay
          otra fecha donde ponerlo, y justamente esos son los que hay que revisar.
        </p>
      </GuideCard>

      {/* 3 — los totales */}
      <GuideCard title="3. Los totales de abajo" tint="#16A34A">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Al pie de la lista tenés <strong className="text-ink">Entradas</strong> y{' '}
          <strong className="text-ink">Salidas</strong>, separadas, más la cantidad de movimientos.
        </p>
        <Callout tone="warn" title="Entradas y Salidas no se suman entre sí">
          Van separadas a propósito. Sumarlas cuenta la misma plata dos veces —una cuando entra y otra cuando sale— y
          da un número que sube cuanto más pagás, que no significa nada.
        </Callout>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Ojo también con qué incluyen: acá entra <strong className="text-ink">todo</strong> lo que pasó por el banco,
          depósitos en garantía incluidos. Los ingresos de la liquidación —lo que se reparte con los propietarios— son
          otra cosa y están en la planilla.
        </p>
      </GuideCard>

      {/* 4 — cómo se usa */}
      <GuideCard title="4. Cómo se usa en la práctica" tint="#7C3AED">
        <ul className="space-y-2">
          <Step n={1}>Elegí el <strong className="text-ink">mes</strong> arriba.</Step>
          <Step n={2}>Mirá la tarjeta <strong className="text-ink">Sin conciliar</strong>: te dice cuánto falta cobrar y cuánto falta pagar.</Step>
          <Step n={3}>En la lista están todos los movimientos del mes, ordenados por fecha de banco. Los que están en <strong className="text-warn">Pend.</strong> no tienen fecha, así que te quedan <strong className="text-ink">al final de la lista</strong>: bajá hasta ahí y revisalos contra el extracto.</Step>
          <Step n={4}>Cuando confirmes que un movimiento entró o salió, cargale la <strong className="text-ink">fecha de banco</strong> desde la planilla o desde Movs. Al hacerlo pasa a <strong className="text-success">OK</strong> solo.</Step>
        </ul>
        <Callout tone="tip" title="Una entrada y una salida sin confirmar son dos tareas distintas">
          Una <strong className="text-ink">entrada</strong> sin confirmar es «¿entró el alquiler?». Una{' '}
          <strong className="text-ink">salida</strong> sin confirmar es «¿salió la transferencia?». Por eso los montos
          pendientes se muestran separados.
        </Callout>
      </GuideCard>

      <Callout tone="warn" title="Importación de extractos: todavía no">
        El panel de la derecha, <strong className="text-ink">Extracto bancario</strong>, está preparado para cuando se
        pueda subir el archivo del banco y cruzarlo solo. Por ahora no está disponible, y el botón aparece apagado.
        Hoy la conciliación se hace mirando: el sistema de un lado, el extracto del otro.
      </Callout>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/comision-transferencia" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Comisión y transferencia</Link>
        <Link href="/ayuda/diagnostico" className="text-[13px] text-info hover:underline transition-colors inline-flex items-center gap-1">Siguiente: Diagnóstico y errores →</Link>
      </div>
    </div>
  )
}
