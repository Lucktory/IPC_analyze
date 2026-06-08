import { ComingSoon } from '@/components/ui/ComingSoon'

export default function PropiedadesPage() {
  return (
    <ComingSoon
      title="Propiedades"
      lead="Catálogo de propiedades en administración, incluyendo vacancias"
      bullets={[
        '120 propiedades registradas (102 con contrato + 18 vacantes)',
        'Direcciones reales, tipo (vivienda/local/cochera/oficina/depósito)',
        'Vacancias destacadas para seguimiento de cartera',
      ]}
    />
  )
}
