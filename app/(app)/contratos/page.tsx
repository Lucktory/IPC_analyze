import { ComingSoon } from '@/components/ui/ComingSoon'

export default function ContratosPage() {
  return (
    <ComingSoon
      title="Contratos"
      lead="Listado completo de los 102 contratos vigentes — y vista de liquidación por contrato"
      bullets={[
        'Filtros por estado (activo / rescindido / por vencer), cadencia, propietario',
        'Click en un contrato → vista del "embudo": alquiler + recuperos → % admin → neto al propietario',
        'Cuenta destino de la comisión visible en cada liquidación',
      ]}
    />
  )
}
