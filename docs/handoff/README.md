# Handoff dossier

You're picking this up on a new machine. These files exist so you can resume the conversation with the user without re-deriving everything from scratch.

## Read in this order

1. **[USER.md](USER.md)** — who you're working with (Medhi-chan / Mehdi), how he likes to communicate, what kind of responses he wants
2. **[CLIENT.md](CLIENT.md)** — the end client (Alejandro Horstmann, Patagonia Propiedades), his voice messages, his preferences, what he's explicitly parked
3. **[STATE.md](STATE.md)** — what the codebase looks like right now (key pages, components, conventions)
4. **[NEXT.md](NEXT.md)** — open threads, recent decisions, what to do next

If you only have time for one — read **USER.md**. The single biggest source of failure here has been generating AI-pattern responses (lists with headers, "I've successfully…", etc.). Medhi-chan has corrected this multiple times. Match the senior-dev tone documented there.

## Project basics

| Thing | Value |
|---|---|
| Repo | `https://github.com/Lucktory/IPC_analyze.git` |
| Primary branch | `main` |
| Last commit at handoff | `dd70236` — Recargos panel: bump per-line status icons |
| Stack | Next.js 15 App Router + TypeScript + Supabase + Tailwind |
| Working directory | `c:\HSH\chatActive\alejandro-argentina-rental-ipc-automation\` |
| Type-check | `npx tsc --noEmit -p tsconfig.json` |

## Auto-memory location (may not have synced)

The user's auto-memory lives at `C:\Users\Tanaka\.claude\projects\c--HSH-chatActive-alejandro-argentina-rental-ipc-automation\memory\` with 18 saved memory files covering color conventions, IVA rules, receipt shapes, agency branding, and more.

If those files aren't on the new machine, the most important ones have been summarized into the docs in this folder, but the originals are worth recreating if possible because they're indexed by `MEMORY.md` and surfaced automatically every turn.

## Quick orientation by URL

| Route | What it is |
|---|---|
| `/liquidacion` | The planilla — 20+ columns, daily-use surface |
| `/pendientes` | Cashflow inbox — 3 categories |
| `/contratos/[id]` | Contract config page |
| `/diagnostico` | System-wide validation issues |
| `/dashboard` | KPI panel |
| `/movimientos` | All transactions list |
| `/propietarios`, `/inquilinos`, `/propiedades`, `/bancos` | Entity lists |
