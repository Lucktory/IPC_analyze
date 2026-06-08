import { ComingSoon } from '@/components/ui/ComingSoon'

export default function MovimientosPage() {
  return (
    <ComingSoon
      title="Movimientos"
      lead="Listado completo de transacciones (alquileres, comisiones, TASA, CAMUZZI, ABL, otros)"
      bullets={[
        '399 movimientos registrados en mayo 2026',
        'Filtros por tipo, período, contrato',
        'Exportable a Excel/PDF para enviar al contador',
      ]}
    />
  )
}
