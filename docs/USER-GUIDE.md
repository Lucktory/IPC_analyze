# IPC-Analyze — Guía de uso

Guía operativa de la app. Cada sección describe **qué hace la página** y **cómo usarla**.

## Acceso

- Iniciar sesión en `/login` con email + contraseña (Supabase Auth).
- El menú lateral muestra todas las secciones; el botón sol/luna arriba a la derecha cambia el tema claro/oscuro/sistema.

---

## Panel (`/dashboard`)

Vista ejecutiva de cinco gráficos en grilla bento:

| # | Gráfico | Qué muestra |
|---|---|---|
| 1 | **Cobranza del mes** (semi-círculo) | % de contratos cobrados este período, con zonas de color rojo/amarillo/verde y aguja indicando el valor actual. |
| 2 | **Pendientes esta semana** (dona + tarjetas) | Tres segmentos por categoría (cobranza/aumento/renovación) + tarjetas vibrantes debajo con conteo y link al detalle. |
| 3 | **Tendencia operativa** (sparklines) | Tres mini-gráficos: pagos del mes, promedio por pago, % comisión sobre ingresos. Cada uno con valor actual y % de cambio. |
| 4 | **Ingresos y comisiones** (área apilada) | Líneas suaves de ingresos (oro) y comisiones (verde) en los últimos 6 meses + tarjetas KPI arriba. |
| 5 | **Concentración** (treemap) | Top 8 propietarios por ingresos del período, dimensionados por monto. Color de oro (rank 1) a slate (rank 8). |

**Cuándo usar:** apertura de cada día para chequear estado general.

---

## Pendientes (`/pendientes`)

Cola operativa de acciones a resolver esta semana. Tres categorías:

| Categoría | Cuándo aparece |
|---|---|
| **Cobranza vencida** | Inquilino que no pagó este período + más de 3 días desde su `payment_day`. |
| **Aviso de aumento** | Contrato con próximo ajuste de alquiler en ≤30 días. |
| **Renovación / vencimiento** | Contrato que vence en ≤30 días. |

**Botón "Enviado"** marca la fila como notificada → desaparece de la lista por 7 días. Después reaparece si la condición sigue activa.

Filtros: por categoría (`?tipo=cobranza|aumento|renovacion`).

---

## Contratos (`/contratos`)

Lista de contratos con filtros por estado, urgencia, índice y búsqueda por texto.

### Crear (`/contratos/nuevo`)
Formulario que crea contrato + junciones (inquilino principal + propietario al 100%).

Campos:
- Propiedad, inquilino, propietario (selectores).
- Alquiler inicial, expensas mensuales.
- Cadencia (mensual → anual), índice (IPC General / ICL / Casa Propia / Fijo).
- Fechas de inicio y fin (default: hoy + 3 años).
- Día de pago, moneda, número de contrato, LFA (admin a cargo).

Si todavía no hay inquilinos/propietarios/propiedades, la página avisa con links directos a `/inquilinos/nuevo`, etc.

### Detalle (`/contratos/[id]`)
Muestra el contrato, su embudo de período, notas por período, urgencia calculada (vencimiento + pagos faltantes).

---

## Propietarios (`/propietarios`)

CRUD completo:
- **Listar** con filtros (con/sin contratos, sin CUIT, sin email).
- **Crear** `/propietarios/nuevo` — nombre, CUIT/DNI, teléfono, email, notas.
- **Editar** + **eliminar** desde `/propietarios/[id]`. La eliminación queda bloqueada si tiene propiedades o contratos asociados.

---

## Inquilinos (`/inquilinos`)

CRUD completo:
- **Listar** con filtros (con/sin contrato, sin teléfono/email).
- **Crear** `/inquilinos/nuevo` — sólo nombre es obligatorio.
- **Editar** + **eliminar** desde `/inquilinos/[id]`. Bloqueado si tiene contratos.

---

## Propiedades (`/propiedades`)

CRUD completo:
- **Listar** con filtros por tipo (vivienda/local/cochera/oficina/depósito).
- **Crear** `/propiedades/nuevo` — dirección + tipo.
- **Editar** + **eliminar** desde `/propiedades/[id]`. Bloqueado si tiene contratos.

---

## Movimientos (`/movimientos`)

Lista de todas las transacciones (RENT_IN, COMMISSION_OUT, ABL_OUT, etc.) con filtros por período, tipo, urgencia, y búsqueda.

### Crear (`/movimientos/nuevo`)
Formulario para registrar transacciones que no entran por la grilla de Liquidación (p.ej. pagos de ABL, comisiones puntuales, devoluciones).

Campos obligatorios: tipo, monto, período.
Opcionales: fecha bancaria, contrato, cuenta bancaria, descripción.

> 💡 **Tip:** para cobros de alquiler usá la grilla de Liquidación — es más rápida.

### Detalle (`/movimientos/[id]`)
Header con tipo, período, fecha bancaria + monto en verde (ingreso) o rojo (egreso). Formulario de edición de todos los campos. Botón de eliminar con FK guard.

---

## Liquidación (`/liquidacion`)

**El núcleo operativo de la encargada.** Grilla ancha estilo planilla con 18 columnas (espejo del Excel actual).

### Vista lista — grilla
Columnas (de izquierda a derecha):

1. **LFA** — admin a cargo (L/F/A).
2. **Inquilino** + **Propietario** (sticky-left, navegan al detalle al clic).
3. **Pct** — % efectivo de comisión.
4. **Alquiler** — monto base. **Fondo naranja claro si hay aumento ≤30 días**.
5. **Expensas** — monto mensual.
6. **F. banco** — fecha de cobro (**editable inline**).
7. **Ingresos** — suma total cobrada.
8. **Deuda** — diferencia entre alquiler y lo cobrado (rojo si > 0).
9. **D. transf** — fecha de transferencia al propietario (**editable inline**).
10. **Transferencia** — neto al propietario.
11. **Otros** — descuentos (ABL/CAMUZZI/etc).
12. **ADMI** — comisión total.
13. **Galicia / BBVA 50/9 / BBVA 51/6** — comisión por cuenta destino.
14. **Observación** — notas + ajuste signed (**editable inline**).
15. **Estado** — punto gris/verde/azul según liquidación draft/sent/paid.

#### Reglas de color

- **Texto gris tenue por defecto** = pendiente.
- **Texto oscuro** = cobrado/transferido (se activa automáticamente cuando se llena la fecha correspondiente).
- **Fondo naranja claro** en la columna Alquiler = aviso de aumento ≤30d.

#### Inline edit

| Columna | Acción |
|---|---|
| **F. banco** | Click → input fecha → Enter para guardar. Crea/actualiza RENT_IN con el alquiler vigente. Cambia el color de las celdas de cobro a oscuro. |
| **D. transf** | Mismo patrón para LANDLORD_PAYOUT. Cambia las celdas de transferencia a oscuro. |
| **Observación** | Click → expande con textarea + número signed (+/−) + botones Guardar/Cancelar. Guarda en `liquidaciones.notes` + `adjustment_amount`. |

Escape cancela; Enter en campos simples guarda.

#### Filtros y KPIs
- Selector de período (pills horizontales).
- Filtros por estado: **Todas / Borrador / Enviadas / Pagadas** (con conteo por estado).
- KPI strip arriba: cobrados/total, total cobrado, comisión efectiva, # avisos de aumento.

### Detalle (`/liquidacion/[contractId]?period=YYYY-MM-DD`)

Para una liquidación individual:

- **Embudo del período**: gran número total + barra horizontal segmentada (comisión / otros / neto) + 3 tarjetas TintCard con cada componente.
- **Botón "Calcular comisión"** (en header del embudo): genera/actualiza el COMMISSION_OUT como `total cobrado × commission_pct / 100`. Usa los 10 s de seguridad de DelayedActionButton.
- **Estado**: workflow Borrador → Enviada → Pagada con botones de transición (también con 10 s arm-cancel). Sello de timestamp en cada cambio.
- **Desglose**: tabla con todas las transacciones IN (cobros del inquilino) arriba y OUT (comisión + otros) abajo. Las que no afectan la liquidación se ven en menor opacidad.
- **Imprimir / PDF**: botón en el header. Usa `window.print()` del navegador — "Guardar como PDF" desde el diálogo de impresión. Oculta sidebar, status workflow, watermark.

---

## Bancos (`/bancos`)

Dos pestañas accesibles desde la misma URL:

### Cuentas (`?tab=cuentas`, default)
Lista de cuentas bancarias con dueño (admin/socio/propietario), CBU, tipo (CA/CC/USD), banco asociado.

Filtros: por dueño, búsqueda por texto.

CRUD desde `/bancos/[id]` (editar/eliminar; eliminar bloqueado si tiene movimientos o contratos).

### Instituciones (`?tab=instituciones`)
Lista maestra de bancos disponibles con comisiones (mantenimiento mensual, transferencia %, transferencia fija), contacto comercial, notas operativas.

- **Crear** `/bancos/institucion/nuevo`.
- **Editar / eliminar** `/bancos/institucion/[id]`. Eliminar bloqueado si hay cuentas asociadas.

---

## Conciliación (`/conciliacion`)

Vista de la jefa para conciliar comisiones contra el extracto bancario.

Agrupa todas las COMMISSION_OUT del período por destino:
- ADM Galicia
- BBVA Francés 50/9 (alias `DONDE.LISA.VALOR`)
- BBVA Francés 51/6 (alias `DORSO.LISA.VALOR`, marcada ADM FLAVIO)
- Sin destino identificado

Cada bucket muestra: **alias** + **CBU** + nota interna en pills arriba (cuando están cargados), título + subtítulo, total esperado, conteo de movimientos.

Tabla por bucket: fecha banco, inquilino, propietario, monto. Subtotal al final. **Botón "Imprimir"** para llevar al contador.

Saltos rápidos: pills arriba para saltar a cada bucket.

---

## Tema (botón sol/luna en TopBar)

Tres estados:

| Estado | Comportamiento |
|---|---|
| ☀️ Claro | Forzado claro |
| 🌙 Oscuro | Forzado oscuro |
| ☀️ + punto | "Sistema" — sigue la preferencia del SO, se actualiza en vivo |

Click cicla: claro → oscuro → sistema → claro.

Preferencia persiste en `localStorage` (`ipc-theme`). Sin parpadeo en primera carga (script inline en `<head>`).

---

## Acciones de seguridad (DelayedActionButton)

Cualquier botón de guardar / eliminar / enviar / marcar pagado en operaciones que toquen plata muestra un contador de 10 segundos antes de ejecutar:

1. Click → el botón se vuelve naranja (o rojo si es destructivo) con cuenta regresiva.
2. Click otra vez antes del 0 → cancela.
3. Esperar 10s → ejecuta.

Sin atajos para "ahora" — la espera es la red de seguridad.

---

## Glosario

| Término | Significado |
|---|---|
| **LFA** | Sigla del admin de Pampa a cargo (L=Lisa, F=Flavio, A=Alejandro) |
| **Recuperos** | ABL/CAMUZZI/EXPENSAS cobrados al inquilino arriba del alquiler. Forman parte del total cobrado. |
| **Embudo** | Total cobrado → comisión + otros → neto al propietario |
| **ADMI** | Total de comisión administración (suma de las 3 cuentas destino) |
| **Período** | Mes calendario al que se imputa el cobro/comisión (formato `YYYY-MM-01`) |
| **Aumento** | Ajuste de alquiler según índice + cadencia del contrato |
| **Liquidación** | Resumen mensual por contrato/propietario con estados draft/sent/paid |
