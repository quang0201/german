# Quick Entry Hour-Split TDD Evidence

Date: 2026-08-14
Spec: `docs/superpowers/specs/2026-08-14-quick-entry-hour-split-design.md`
Branch: `feat/quick-entry-hour-split`

## RED/GREEN checkpoints

- RED: commit `74cdd68` added the hour-split contract tests; the focused suite failed because `productionMatrixHourSplit.js` did not exist.
- GREEN: commit `11d2da5` added the parser, proportional calculation, Direct payload resolution, and popup integration.

## Guarantees

| Guarantee | Test | Result |
|---|---|---|
| Addition-only expressions accept decimals and whitespace | `productionMatrixHourSplit.test.js` | PASS |
| Unsupported operators, empty terms, grouping separators, and invalid values are rejected | `productionMatrixHourSplit.test.js` | PASS |
| HC/TC split follows hours and preserves the parsed total after rounding | `productionMatrixHourSplit.test.js` | PASS |
| Direct and hour-split quantity drafts resolve independently | `productionMatrixHourSplit.test.js` | PASS |
| Existing entries default to Direct mode | `productionMatrixQuickEntry.test.js` | PASS |
| Hour-split saves remain `entryMode: Direct` and persist only calculated HC/TC | `productionMatrixQuickEntry.test.js` | PASS |

## Verification

- `bun test`: 138 passed, 0 failed across 36 files.
- `bun run build`: passed.
- `git diff --check`: passed.
- No backend, database, report, or batch-entry changes were made.
