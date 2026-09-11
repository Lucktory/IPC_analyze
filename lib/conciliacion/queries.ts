// ============================================================================
// Conciliacion — reconciliation STATUS of the system's movements. Our "bank
// confirmed" signal is transactions.bank_date (set = confirmed on the bank).
// There is no imported bank statement (extracto) in the schema yet, so the
// right-hand external-statement cross-check is a future feature; this view
// reconciles each movement against its own recorded bank confirmation.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { bankShortFromDescription } from '@/lib/bancos/destination'
import { shiftPeriod } from '@/lib/period'

export interface ConciliacionMov {
  id:             string
  bankDate:       string | null   // YYYY-MM-DD, null = not confirmed on the bank
  typeLabel:      string
  typeCode:       string
  direction:      'IN' | 'OUT'
  contractId:     string | null
  contractNumber: string | null
  tenantName:     string | null
  bank:           string | null   // derived from the ADM_* description tag
  amount:         number          // unsigned
  conciliado:     boolean         // bank_date is set
  description:    string
  /** Mes CONTABLE del movimiento (transactions.period). Casi siempre coincide
   *  con el mes que se esta mirando; cuando no, es un pago que entro en un mes
   *  pero corresponde a otro — el caso de la inquilina que termino de pagar
   *  Agosto el 5 de Septiembre. La fila lo aclara para que nadie lo lea como
   *  un error. */
  periodo:        string
}

const bankFromDescription = bankShortFromDescription

/**
 * Movimientos de un mes, ordenados por CUANDO PASARON POR EL BANCO.
 *
 * Alejandro, 2026-09-11: "En la conciliacion de Septiembre, el total va a
 * tener en cuenta lo de Agosto?" — una inquilina termino de pagar Agosto con
 * plata que entro el 5 de Septiembre.
 *
 * Antes esta consulta filtraba por `period`, o sea por el mes CONTABLE al que
 * pertenece el pago. Con eso ese cobro caia en Agosto y la conciliacion de
 * Septiembre nunca podia cuadrar contra el extracto del banco, que va por
 * fecha. Para un tablero de conciliacion eso esta al reves: lo que importa es
 * cuando se movio la plata.
 *
 * La regla ahora:
 *   - Si el movimiento tiene bank_date, pertenece al mes de esa fecha. Es el
 *     mes en que el banco lo vio, que es contra lo que se concilia.
 *   - Si NO tiene bank_date, se queda en su mes contable (`period`): todavia no
 *     paso por el banco, asi que no hay otra fecha donde ponerlo, y justamente
 *     esos son los que hay que perseguir.
 *
 * Consecuencia buscada: un cobro de Agosto confirmado el 5/9 aparece en
 * Septiembre y ya no en Agosto. Es correcto — en Agosto no se movio nada.
 *
 * La liquidacion NO cambia: sigue armandose por `period`. Son dos preguntas
 * distintas y cada una tiene su eje.
 */
export async function getConciliacionMovimientos(period: string): Promise<ConciliacionMov[]> {
  const supabase = await createSupabaseServer()
  const nextPeriod = shiftPeriod(period, 1)
  const { data } = await supabase
    .from('transactions')
    .select(`
      id, amount, bank_date, period, description, contract_id,
      transaction_types!inner(code, label, direction),
      contracts(contract_number, contract_tenants(is_primary, tenants(name)))
    `)
    .or(
      `and(bank_date.gte.${period},bank_date.lt.${nextPeriod}),` +
      `and(bank_date.is.null,period.eq.${period})`,
    )
    .order('bank_date', { ascending: true, nullsFirst: false })

  return (data ?? []).map((r: any) => {
    const c       = r.contracts
    const primary = c?.contract_tenants?.find((ct: any) => ct.is_primary) ?? c?.contract_tenants?.[0]
    return {
      id:             r.id,
      bankDate:       r.bank_date ?? null,
      typeLabel:      r.transaction_types?.label ?? r.transaction_types?.code ?? '',
      typeCode:       r.transaction_types?.code ?? '',
      direction:      (r.transaction_types?.direction ?? 'IN') as 'IN' | 'OUT',
      contractId:     r.contract_id ?? null,
      contractNumber: c?.contract_number ?? null,
      tenantName:     primary?.tenants?.name ?? null,
      bank:           bankFromDescription(r.description ?? ''),
      amount:         Number(r.amount),
      conciliado:     !!r.bank_date,
      description:    r.description ?? '',
      periodo:        String(r.period),
    }
  })
}
