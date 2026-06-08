import { ComingSoon } from '@/components/ui/ComingSoon'

export default function ConciliacionPage() {
  return (
    <ComingSoon
      title="Conciliación bancaria"
      lead="Vista para la jefa del sector — comisiones por cuenta destino para conciliar contra los extractos"
      bullets={[
        'Desglose por ADM Galicia / Francés 50-9 / Francés 51-6',
        'Total esperado por cuenta (debe coincidir con extracto)',
        'Detalle por contrato dentro de cada cuenta',
      ]}
    />
  )
}
