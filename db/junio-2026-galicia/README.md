# June 2026 data load - PARTICULARES-GALICIA

Ordered SQL that loaded and reconciled the June 2026 close for the
**PARTICULARES-GALICIA** administration (`administration_id = 7257451b-...`), so the
system reproduces Alejandro's manual spreadsheet.

These were applied **once, in order, against production (Supabase)**. They reference
specific contract UUIDs and are kept as a record / for reproduction, not as
idempotent migrations. All statements are ASCII (no non-ASCII in code or DB strings).

## Run order

| # | File | What it does |
|---|------|--------------|
| 01 | `01-import-junio.sql` | Main June import: RENT_IN / COMMISSION_OUT / OTHER_OUT / LANDLORD_PAYOUT for the matched contracts (217 rows). |
| 02 | `02-reconcile-commissions.sql` | Aligns `commission_pct` (+ IVA flag) per contract to the sheet (60 updates). |
| 03 | `03-set-dates.sql` | Sets real bank dates (cobro / transferencia) from the sheet. |
| 04 | `04-import-iva.sql` | 7 RI contracts (commission includes IVA): sets the flag + imports their June rows. |
| 05 | `05-fix-iva-otros.sql` | Removes the OTHER_OUT wrongly imported for the 7 IVA contracts (that column was the commission IVA, already inside ADMI). |
| 06 | `06-fix-cdates.sql` | Corrects the vigencia of 3 contracts (placeholder / expired) from the sheet. |
| 07 | `07-import-missed.sql` | 2 existing contracts the surname matcher missed (GUSTAVO FERNANDEZ, SOLOAGA/ALVAREZ). |
| 08 | `08-import-finish.sql` | 2 contracts stored under the owner name (PEREZ FRANCISCO = OTERO WALSH; QUINTAS = ex Castellani). |
| 09 | `09-fix-amounts.sql` | Aligns BARTL (614.000) and LOURENCO (305.000) to the sheet. Also deletes the June rows of REARTE and GOMEZ CID (they show 0 in the GALICIA sheet). See note below. |
| 10 | `10-create-new.sql` | Creates the 2 brand-new June contracts (GONZALEZ ESCUDERO, SUAREZ) + landlord/property/tenant links + transactions. |
| 11 | `11-restore-orphans.sql` | Re-adds the June of REARTE and GOMEZ CID. **Reverses the delete in 09** on purpose (decision: keep them - their collection runs through the FRANCES book, kept separate from GALICIA). |
| 12 | `12-fix-gustavo.sql` | Sets GUSTAVO FERNANDEZ `commission_pct` to the sheet value (7%), clearing a deviation + imbalance. |
| 13 | `13-fix-bartl-liq.sql` | Syncs BARTL's stale stored liquidacion (old gross + manual adjustment of 3) to the current transactions. |

## Note on 09 + 11 (delete then restore)

REARTE and GOMEZ CID appear at $0 in the June GALICIA sheet, so `09` removes the
June data that an older seed had carried for them. The decision was to **keep** those
contracts (their cobro runs through the FRANCES book), so `11` restores them with
clean ASCII descriptions and their real FRANCES commission destination. Net effect:
both contracts keep their June data. If you replay from scratch, run 09 and 11 both.

## Result after the full sequence

- 89 contracts with June movement; system totals equal the sheet **to the peso**
  (cobrado $81.165.471 / comision $6.873.838 / transferido $73.620.088).
- Money invariants clean (transferencia = recibo; commission = cobrado x %).
- The June sheet itself had 5 date-entry errors that the system caught; see the
  client report (`informe_junio_2026`).
