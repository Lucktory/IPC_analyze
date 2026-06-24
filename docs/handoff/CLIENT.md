# The end client — Alejandro Horstmann

Runs **Patagonia Propiedades**, a real estate administration agency in Comodoro Rivadavia, Chubut (Argentina). Four-partner agency: **Flavio · Lisa · Alejandro · Dorso**, each 25% share. Manages roughly **99 active rental contracts** for ~60 landlords across multiple properties.

## Why he's building this app

He's leaving **Sindex** and **Profit** (the two dominant Argentine real estate management tools) because they **hide data behind summaries**. His thesis: keep every field visible so the encargada and the partners can see what's happening at any time.

This is the load-bearing design principle for the whole project. See `memory/architecture_data_visibility_principle.md` if it synced. Concretely:

- Never collapse multi-name cells into "Pérez et al." — show every name on its own line
- Per-row breakdowns must be expandable (Movs, Deuda, Recargos)
- Validation issues surface per-row in a Check column AND system-wide in `/diagnostico`
- No auto-decisions on money (commission, payer split, late fees) — the system suggests, the encargada confirms

## Communication style

- **Spanish voice messages** (Argentine — voseo). The transcripts have stray words sometimes ("Oyu" turned out to be a transcription artifact, not a name).
- Casual, narrative, often loops back to refine ("a ver, te voy a mandar una foto…")
- Very specific about visuals: "anaranjado clarito, no naranja fuerte", "celestito el mes que viene, azul más oscuro el mes del vencimiento"
- Respects Medhi-chan's judgment when given. Has said "Hazlo a tu criterio, si lo ves mejor de otra forma, mostrámela y lo vemos."

## La encargada / La jefa

The senior office operator who actually uses the planilla every day. Resistant to tooling changes — she lives in Excel/Sheets and Alejandro flagged adoption risk on day one. Concrete implications:

- Match Excel patterns (sticky-left columns, alternating rows, freeze panes)
- Don't hide data behind clicks unless the cell space genuinely can't fit it
- Editable cells: click → popover, save on blur, optimistic UI
- Avoid completely new UX patterns when an existing one works

See `memory/client_adoption_blocker_jefa.md` if synced.

## Mariela

Another office staffer Alejandro mentioned will be added to the working group. She manages the **arreglos / contingencias** sector. The arreglos UI build (`contract_events` table is ready) is parked pending her input.

## What he's explicitly parked

Per `memory/client_galicia_scope_decision.md` (2026-06-17 voice):

- **BW area / agency-internal expenses** ("rightmost columns of his Sheet"). He said "no le des importancia por ahora."
- **Araiz / Beverelli subgroup** tagging and eventual totals merge. He said "primero terminemos de resolver lo principal."
- **Beverelli's "particularidades"** — he confirmed 9% on rent only (no IVA on commission) maps to existing `commission_base = 'rent_only'`, schema already supports it. Other particularidades he admitted "yo también no conozco bien tanto" and said he'd review and report back.

**Don't proactively build any of these.** Wait for him to re-raise.

## What's blocked on him sending materials

He's promised but not yet delivered:

| Material | What it unblocks |
|---|---|
| Logo PNG (transparent BG) | HTML rendición email header (Receipt Shapes A/B/C — see `memory/client_receipt_shapes.md`) |
| The "abril" historical email template | Reference for the receipt design |
| Answers to 5 questions about arreglos workflow (A-E) | Arreglos editor design |
| Beverelli's full particularidades list | Beverelli rules once unparked |

The HTML receipt email was attempted once (commit `b18e821`) and reverted (`05491a8`) per his "I do not like the email template" — wait for materials before attempting again.

## Hard preferences he's surfaced

- **Color palette per concept** (decided 2026-06-18, revised 2026-06-19):
  - Contract expiry → **blue** family (sky-200 / sky-400/70 / red-200), applied to the **Contrato cell only**, not the whole row
  - Aumento applied this period → **orange** family (orange-300/70), applied to the **Alquiler cell only**
  - Saturation was bumped 2x on 2026-06-19 because the tints were too pale to spot at a glance
- **Alquiler column is sacred** (2026-06-20): "tiene que permanecer limpia, libre — es el alquiler y nada más." Don't merge ABL or extras into it. They live in the separate Recargos column.
- **Status dots** for hidden data: green = complete, red = missing. The Recargos cell has one because the data is one click deep. Don't sprinkle dots elsewhere — other cells already show state via text color.
- **Per-row click should land on the contract page** (2026-06-25): the `→` arrows next to Propietario and Inquilino on the planilla jump to `/contratos/[id]`, not anywhere else.

## Agency details for receipts

When emails / receipts mention the agency:

- Name: **Patagonia Propiedades** (NOT "Pampa Administración" — that's a legacy placeholder still in ~18 files that need a rename pass)
- Address: Mitre 674, (9000) Comodoro Rivadavia - Chubut
- Phone: (0297) 444-4862 / 4441695
- Email: patagoniainmo@gmail.com
- Partners (administrators): Flavio H., Lisa H., Alejandro H., Dorso (25% each)
