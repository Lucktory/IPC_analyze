// ============================================================================
// PeriodCoverage — cuantos contratos del mes tienen el alquiler cargado.
//
// POR QUE EXISTE (2026-09-17)
//
// La planilla lista TODOS los contratos vigentes en todos los meses, tenga o no
// algo cargado. O sea que un mes vacio se ve igual de lleno que uno completo:
// estan las filas, con los nombres de siempre, y lo unico que falta es la plata.
//
// Asi paso lo que paso. Mayo cerro con 95 de 96 contratos cargados y Junio con
// 89 de 95, pero Julio bajo a 23 de 91 y Agosto quedo en 1 de 87. Tres meses sin
// cargar, y nadie lo vio hasta que un numero raro nos hizo mirar. Desde la
// pantalla no habia forma de darse cuenta.
//
// Esta linea lo dice de entrada, cada vez que se abre el mes. Tambien sirve al
// reves: avisa cuando el mes YA ESTA terminado, que es una senal que hasta ahora
// tampoco existia.
//
// El dato sale de las filas que la grilla ya tiene cargadas -- no hace ninguna
// consulta extra.
// ============================================================================

interface Props {
  /** Contratos con alquiler cobrado en el periodo (RENT_IN + RENT_NF_IN > 0). */
  cargados: number
  /** Contratos vigentes en el periodo, o sea las filas de la planilla. */
  total:    number
}

export function PeriodCoverage({ cargados, total }: Props) {
  if (total <= 0) return null
  const pct = Math.round((cargados / total) * 100)

  // Los cortes son gruesos a proposito: lo unico que tiene que saltar a la
  // vista es "esto esta terminado" / "esto esta a medias" / "esto esta vacio".
  const tone =
    pct >= 95 ? { dot: 'bg-success', text: 'text-success', bg: 'bg-success/10' } :
    pct >= 50 ? { dot: 'bg-warn',    text: 'text-warn',    bg: 'bg-warn/10'    } :
                { dot: 'bg-danger',  text: 'text-danger',  bg: 'bg-danger/10'  }

  return (
    <span
      title={
        `${cargados} de ${total} contratos tienen el alquiler cargado en este período (${pct}%).\n\n` +
        'La planilla muestra todos los contratos vigentes aunque no se haya cargado nada, ' +
        'así que un mes sin cargar se ve igual que uno completo. Esta cuenta es la diferencia.'
      }
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium whitespace-nowrap ${tone.bg} ${tone.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {cargados} de {total} con alquiler cargado
    </span>
  )
}
