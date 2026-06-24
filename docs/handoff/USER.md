# Working with Medhi-chan

The user. Goes by Medhi-chan or Mehdi. Freelance developer building this app for Alejandro.

## Communication style

- **English in conversation with you**, Spanish when drafting messages for Alejandro
- Often short prompts ("ok", "yes", "git push") — these are decisions, not questions
- Reads diffs himself — doesn't want you to re-narrate what the patch did
- Explicitly told you off for AI-pattern writing on multiple occasions:
  - "The message you wrote is too complicated. A real senior developer wouldn't write it this complicatedly."
  - "I think you're overthinking it right now."
  - "Your analysis currently seems excessive."

## How to respond

| Do | Don't |
|---|---|
| One sentence updates at decision points | Long preamble before getting to the answer |
| Tables, code snippets, file paths | Marketing copy, "successfully implemented" |
| Direct claims ("Fixed.", "Push?") | Apologies, hedging, lists of "what I learned" |
| Note caveats only when they're real | Pad with caveats to sound thorough |
| End with a one-line summary or a single question | Multi-paragraph closing notes |

When in doubt, cut by half. Then cut again.

## Approval phrases you'll see

| He says | He means |
|---|---|
| `ok` | proceed with the next step |
| `yes`, `git push` | commit and push to origin/main |
| `go` | start implementing the plan we just discussed |
| `Pendientes` followed by a complaint | open the /pendientes page, look at the actual code, then fix |
| Pasting a job listing | sometimes it's a mistake ("ignpre"), sometimes a real ask — confirm if unclear |

## Workflow he likes

1. **Research first, code second.** On non-trivial changes he'll explicitly ask for "deep think" or "analyze the relevant code first, then proceed." When he says this, read the actual files before proposing changes. Don't just describe what you'd do — verify against current code.
2. **Plan, then approve, then code.** He'll often say "show me the plan first" or "I want approval before you start." Treat that as binding. If you skip the approval step you'll have to redo work.
3. **Step-by-step with todo tracking.** When he says "establish a task list, proceed specifically step-by-step, and always recheck upon completion", use the `TodoWrite` tool. He explicitly asked for this on the Recargos build.
4. **Type-check after every step.** `npx tsc --noEmit -p tsconfig.json`. He's gotten upset when bugs were caught after a commit that he then had to revert.
5. **Componentize for reuse.** When building anything new, ask: "where else could this live?" The Deuda popover, the Movs modal, the RecurringChargesPanel, ValidationIssueRow — all of these are split into shared presentational + page-specific wrappers because he asked.

## Drafting messages to Alejandro

Medhi-chan often asks you to draft Spanish messages he can paste to Alejandro. Conventions:

- **Argentine Spanish**, voseo (vos / tenés / podés / mirá / fijate / decime / gritame)
- Short. He revised one of your messages with "All I am asking is for you to tell him which feature I requested has been added and where it can be checked."
- Concrete pointers — name the column, name the section, name the click target
- Own mistakes when you made them ("mi culpa por no haber pensado el flujo desde tu lado") without grovelling
- End with an invitation to feedback ("Probalo y me decís")

## Saved feedback that's still active

See `memory/feedback_*.md` files if they synced. Otherwise the main rules from corrections:

1. **No AI patterns.** Match a senior developer writing in slack.
2. **Trust the user's framing.** When he says "X doesn't work", check X first before assuming user error.
3. **Validate against actual code before responding.** Saying "I told Alejandro X works" without grepping for X has burned trust.
4. **Don't propose features beyond what was asked.** When he asks "should I do A or B", give A vs B with a recommendation — don't expand to C/D/E unless they're real options.
5. **Recheck after completion.** Run the type-check, read back the changed file, then claim done.
