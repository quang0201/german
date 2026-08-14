# Production matrix follow-up TDD evidence

## Scope

- Preserve the monthly matrix horizontal position after saving an entry.
- Preselect the applied employee filter when opening day batch entry.
- Name Excel downloads with month/year.
- Delete an operation and all related production entries only after an explicit two-step confirmation.
- Hide records whose HC, TC, and total production are all zero from web queries and Excel reports.

## RED/GREEN checkpoints

| Behavior | RED checkpoint | GREEN checkpoint |
|---|---|---|
| Month/year Excel filename | `307e47e` | `2bb5acb` |
| Matrix horizontal scroll restoration | `9ae6a0e` | `a8544e9` |
| Applied employee preselection | `8791dbc` | `f3c399a` |
| Operation data cleanup | `d9a1393` | `a0f6ffd` |
| Confirmed delete UI | `7f510be` | `81836d0` |
| Zero-production visibility | `e2bfee9` | `6d60385` |

## Verification

- `bun test`: 147 pass, 0 fail, 444 expectations.
- `dotnet test German.sln --configuration Release --no-restore`: 119 pass, 0 fail.
- `bun run build`: production bundle completed successfully.
- `git diff --check`: passed.

The delete service removes all active and soft-deleted `ProductionEntry` rows for the selected operation before removing that operation. It does not remove the production order or any other operation.

Zero-production entries remain stored in the database but are excluded from the monthly matrix, production list, and report export query when HC, TC, and total are all exactly zero.
