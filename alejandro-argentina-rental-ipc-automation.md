# Alejandro H. - Argentina - Rental Management + IPC Automation

## STATUS
- Stage: IN CONVERSATION
- Post title: Automatización Integral de Gestión de Alquileres con Actualización por IPC
- Last updated: 2026-06-01 (3 exchanges - client confirmed IPC formula, cadence mix, existing web/domain/templates infrastructure)

## CLIENT
- Name: Alejandro H.
- Country: Argentina
- Type: Ambiguous leaning Entrepreneur (business framing - "optimizar la administración", "reducir carga manual", "mejorar precisión" - but knows enough to tag Python/PHP/MySQL; likely small property admin or landlord with technical curiosity, not a developer)
- Timezone: ART
- Track record: 1 published project, 0 paid hires, member since May 2026 - brand new account (Playbook C signals)

## POST
Automatización Integral de Gestión de Alquileres con Actualización por IPC
Published on the May 31, 2026 in IT and Programming

USD 1,000 - 3,000

Se busca un desarrollador para automatizar completamente la gestión de una base de datos de alquileres. La base de datos actual consta de aproximadamente 250 filas y 15 columnas, y requiere una solución robusta y eficiente. Las funcionalidades clave incluyen:

- Automatización de la base de datos de alquileres para facilitar la administración y el seguimiento.
- Implementación de un sistema de actualización automática de precios de alquiler basados en el Índice de Precios al Consumidor (IPC) de Argentina, asegurando que los montos se ajusten de manera precisa y oportuna.
- Desarrollo de un sistema de notificaciones automáticas para alertar sobre la finalización de contratos de alquiler, permitiendo una gestión proactiva.
- Capacidad para sumar o restar eventos específicos dentro de cada contrato de alquiler, como pagos, reparaciones o cualquier otra incidencia relevante.
- Automatización del envío de liquidaciones finales por correo electrónico a los inquilinos o propietarios, simplificando el proceso administrativo.

El objetivo es crear una herramienta que optimice la administración de alquileres, reduzca la carga de trabajo manual y mejore la precisión de los datos y las comunicaciones. Se valorará la experiencia en desarrollo de sistemas de gestión y la integración de APIs para datos externos (como el IPC).

Category: IT and Programming / Web development
Scope: Create a new custom site
Skills: Python, PHP, JavaScript, MySQL, SQL, Database, HTML, CSS, System Analysis

Alejandro H. - 1 published project, 0 paid hires, member since May 2026.

## ANALYSIS

- Core objective: Small Argentine property administrator wants to replace spreadsheet-based rental management with a web tool that auto-updates rent amounts via IPC, tracks contract events, notifies of expirations, and emails final liquidations. The deeper goal: stop doing IPC math manually each cycle and stop forgetting contract end-dates.

- Engagement list:
  1. 250 rows scale (right-size tool to data, no enterprise MySQL needed)
  2. IPC auto-update (DNU 70/23 context + cadence-per-contract reality)
  3. Notification system for contract expiry (Phase 1 explicit)
  4. Event tracking per contract (pagos, reparaciones, incidencias - all named)
  5. Email auto-liquidation (Phase 1 explicit)
  6. Web admin panel + CRUD + auth (implicit from "herramienta" + "robusta y eficiente")
  7. IPC cadence per contract (closing question)
  8. INDEC publication delay reality (follow-up hook)

- Direction angle: The Argentine rental market post-DNU 70/23 is the unspoken context. Each contract can now have its own indexer (IPC nivel general, ICL, IPC GBA, Casa Propia) and its own cadence (monthly/trimestral/semestral). A naive "fetch IPC and multiply" engine breaks within 6 months when one contract uses trimestral and another uses semestral. The flexibility must live in the data model from day one. Most bidders won't surface this.

- Opening type chosen: strategic-reframe via Argentine market mechanics (DNU 70/23 + cadence-per-contract reality).

- Shape decisions:
  - NO unicode bold numbered headers (rule 11 default - client did not enumerate asks)
  - Two hyphenated lists: stack approach + Phase 1 deliverables (both naturally enumerate 4+ items)
  - One simple scope-gating question at close (cadence) - rule 11
  - No process commitments block (rule 11 NEW DEFAULT - client did not surface process interest)
  - Stack pivot from MySQL/PHP skill tags to NextJS+Supabase justified by data scale (250 rows = lightweight tool fit)
  - Confident-close (rule 24 NEW DEFAULT) - cadence question IS the close

- Blind spot: NONE in bid body. The INDEC publication delay warning (~day 15 of month X+1) is raised in FOLLOW-UP message (rule 19B WARNING HOOK).

- Stack decision: Skill tags Python/PHP/MySQL only, no body mandate. Per rule 10 Case C: skill-tag only = soft signal, full alternative proposal allowed. None of those are on the WP/Shopify/WC dislike list, so the pivot is justified by tool-fit (250 rows is small data, MySQL is overkill, NextJS+Supabase gives integrated panel+DB+auth+scheduled functions in one platform).

- Anchor check: all assertive sentences trace to POST (250 rows, IPC update, notifications, event tracking, email liquidation) or MECH (DNU 70/23 facts; INDEC IPC publication mechanics; NextJS+Supabase fit for small-data web apps; datos.gob.ar series API as the public IPC source). Zero invented market claims.

- Difficulty: 4/10 (well-understood territory; IPC integration + cadence flexibility is the only specialized bit)
- Estimated duration: 2-3 weeks for Phase 1

- Suggested bid amount: $2,200 USD
  - EFP for honest delivery: $2.9-4.5K (DB design + admin panel + auth + IPC engine + notifications + email automation + event tracking + testing)
  - Per rule 6: 30-50% of EFP = $870-2,250. Posted range $1K-3K overlaps.
  - $2,200 = mid-range posted, signals quality without underbidding the IPC engine complexity
  - Going below $1.8K signals he'll get a Sheets+Apps Script slop instead of a real web tool
  - New account (Playbook C): no payment-risk red flags in post. Proceed normally.

## BID
Hola Alejandro,

El detalle que más mueve el alcance de un sistema de gestión de alquileres en Argentina 2026 no es el CRUD ni el panel de administración - es la lógica de actualización por IPC. Desde que el DNU 70/23 liberó los términos contractuales, cada contrato puede tener su propia cadencia (mensual, trimestral, semestral) y su propio indexador de referencia (IPC nivel general, ICL, IPC GBA, Casa Propia). Si el motor de actualización no contempla esa flexibilidad desde el modelo de datos, en seis meses el sistema empieza a divergir de lo que firma cada inquilino.

Para 250 filas y 15 columnas, no hace falta MySQL pesado ni infra de producción enterprise. La stack que cabe limpia para este tamaño:

- NextJS + Supabase para el panel web (CRUD de contratos, eventos, inquilinos y propietarios + autenticación incluida)
- Funciones programadas (cron) para chequear vencimientos y disparar notificaciones automáticas
- Integración con la API pública oficial para traer el IPC mensual de INDEC automático
- Resend o Postmark para el envío de liquidaciones por mail (volumen bajo, costo mínimo)

Recorte de Fase 1 que cubre el núcleo del pedido:

- Modelo de datos de contratos + inquilinos + propietarios + eventos (pagos, reparaciones, incidencias)
- Panel web con CRUD completo + autenticación
- Motor de actualización por IPC con cadencia configurable por contrato
- Notificaciones automáticas de vencimiento (umbral configurable: 30, 60, 90 días antes)
- Envío de liquidación final por mail con plantilla configurable

La pregunta que define todo: hoy los ajustes de alquiler se hacen con qué frecuencia (mensual, trimestral o semestral) y es la misma para todos los contratos o varía contrato por contrato? Esa respuesta define cómo se arma el motor de actualización en el modelo de datos.

Dave R.

## QUESTIONS
- [x] Cadencia de actualización -> trimestral mayoritario, algunos bimestrales, semestrales o anuales (2026-06-01)
- [x] Lógica de IPC -> CONFIRMADA por cliente: ventana de N meses cerrados terminando en M-2 (NO incluye M-1 por publicación tardía de INDEC). Ejemplo cliente: ajuste junio trimestral = feb-mar-abr (2026-06-01)
- [x] Plantillas de mail -> ya existen y están en uso manual; el trabajo es importarlas al motor de envío automatizado, no rediseñar (2026-06-01)
- [x] Web/dominio propio -> ya existe; panel puede vivir en subdominio del sitio actual (2026-06-01)
- [ ] DB actual: Excel, Google Sheets o sistema con DB? -> en curso (preguntado 2026-06-01)
- [ ] Indexador: IPC nivel general (probable, sin confirmar), ICL, IPC GBA, Casa Propia, mix? -> unanswered

## CONVERSATION

2026-06-01 - Received (Alejandro):
"La lógica actual que hacemos con el indec..es desastre un mes hacia atrás"

Reads as direct validation of the follow-up warning. He's living the exact pain: current manual process lags one month because they wait for INDEC to publish before computing the adjustment. Strong buying signal - he engaged with the technical reality, not the price.

2026-06-01 - Sent (Dave):
Confirmed the symptom is classic. Explained the clean inversion pattern: engine always uses last-published-closed IPC at adjustment moment, not the in-progress month. Result: day-1 amount is correct, no retroactive math.
Re-posed scope-gating question consolidated: (a) adjustment fecha fija vs variable per contract, (b) cadencia general (trimestral/semestral/mix). Both questions tightly coupled, fair to ask together now that client is in chat.

2026-06-01 - Received (Alejandro, 5 messages):
1. "Hay contratos con Aumentos trimestrales. Algunos pocos bimestrales semestrales o anuales... Si el aumento fuera en Junio.. y el aumento trimestral.. No tomaríamos mayo... sino abril marzo y febrero"
2. "Ya tenemos página web y dominio"
3. "Las palnatillas ya están armadas y en funcionamiento"
4. "Pero no automatizados"
5. "Hay que ordenarlas y automatizarlas"

Key info extracted:
- Cadence mix: trimestral (majority) + bimestral/semestral/anual (minority)
- IPC formula confirmed precisely by client: for adjustment in month M with cadence N, the window is the N closed months ending at M-2 (skipping M-1 which is not yet published). Example: June trimestral = feb+mar+abr.
- Existing web + domain already in place (panel can live as subdomain, no new infra to provision)
- Email templates already designed and in manual use (no design work, only wiring into automated send engine)
- "Ordenarlas y automatizarlas" frames the actual scope: organize existing assets + automate the workflows

Scope implications: bid still holds at $2,200. Slightly less email/template design work, slightly more existing-system integration work (subdomain setup, importing templates) - net neutral.

2026-06-01 - Sent (Dave):
Mirrored back the exact IPC formula in his words (feb-mar-abr for June trimestral, mayo excluded because INDEC publishes 15th of June after adjustment runs) - confirms I understood his pattern precisely. Generalized to bimestral/semestral/anual.
Acknowledged the existing infrastructure as best-case (panel lives on subdomain, templates import as-is, "menos trabajo de ese lado").
Asked the next gating question: where do the 250 contracts live today (Excel/Sheets/system DB) - this defines initial migration effort.

Pending: DB current location answer.
