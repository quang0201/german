# Quick Entry Hour-Split Design

Date: 2026-08-14
Target base: `dev`
Scope: monthly production matrix quick-entry dialog only (`ProductionMatrixQuickEntryDialog`).

## Goal

Extend the matrix quick-entry popup with two user-facing input modes while keeping the persisted production-entry contract compatible with the current system.

1. **Nhập trực tiếp / Không chia**: user enters HC and TC quantities exactly as today.
2. **Chia đều theo giờ**: user enters HC hours, TC hours, and one total-production expression. The UI calculates the HC/TC quantities proportionally and saves the result as a normal `Direct` production entry.

No database migration, new domain enum, API contract expansion, or report change is required for this feature.

## Current behavior

`ProductionMatrixQuickEntryDialog` currently exposes only HC, TC, and note fields and always sends `entryMode: "Direct"` with `directHcQuantity` and `directTcQuantity`.

The frontend calculation module already contains proportional splitting behavior for overtime-oriented modes, but the quick-entry popup does not expose it.

## User flow

The popup keeps the existing read-only context:

- Nhân viên
- Mã SX
- Công đoạn
- Ngày

Below that, add an input-mode choice:

- `Nhập trực tiếp`
- `Chia đều theo giờ`

### Direct mode

Fields:

- HC
- TC
- Ghi chú

Behavior remains unchanged. Saving uses the entered HC and TC values.

### Hour-split mode

Fields:

- Giờ HC
- Giờ TC
- Tổng sản lượng
- Ghi chú

The `Tổng sản lượng` field accepts only an addition expression made from non-negative numeric terms, for example:

- `300`
- `300+100`
- `300 + 100 + 50`

Operators `-`, `*`, `/`, parentheses, identifiers, and arbitrary JavaScript expressions are rejected. The parser must not use `eval` or `Function`.

The UI shows a live preview:

- Tổng sản lượng
- Tổng giờ
- Sản lượng / giờ
- HC dự kiến
- TC dự kiến

Example:

- Giờ HC = 8
- Giờ TC = 2
- Tổng sản lượng = `300+100`
- Parsed total = 400
- Total hours = 10
- Quantity/hour = 40
- HC = 320
- TC = 80

## Calculation rules

Let:

- `Hhc` = HC hours
- `Htc` = TC hours
- `Q` = parsed total production
- `H = Hhc + Htc`

Validation:

- `Hhc >= 0`
- `Htc >= 0`
- `H > 0`
- every production-expression term is finite and `>= 0`
- `Q >= 0`

Calculation:

- `rawHc = Q * Hhc / H`
- `HC = roundQuantity(rawHc)` using the project's existing production-calculation rounding rule
- `TC = Q - HC`

This preserves the parsed total exactly while following the existing proportional split convention. If `Htc = 0`, all production goes to HC. If `Hhc = 0`, all production goes to TC.

The preview must be derived from the same helper used to build the save payload so displayed values and saved values cannot diverge.

## Persistence model

Hour-split is a UI input method, not a new persisted entry mode.

On save, both user-facing modes continue to send:

```text
entryMode = Direct
directHcQuantity = calculated-or-entered HC
directTcQuantity = calculated-or-entered TC
```

All other quick-entry payload fields remain compatible with the current create/update behavior, including version checks, expected-empty conflict protection, note handling, work times, and matrix reload behavior.

Because only the final HC/TC quantities are persisted, reopening an existing `Direct` entry cannot reconstruct the original HC hours, TC hours, or `300+100` expression. Therefore edit mode must default to `Nhập trực tiếp` and display the persisted HC/TC quantities. Hour-split is available again if the user deliberately selects it and recalculates.

## State behavior

When a new popup context opens:

- reset the user-facing mode to `Nhập trực tiếp`
- preserve the current create/edit loading and conflict rules
- for an existing Direct entry, load persisted HC/TC as today
- clear hour-split-only draft values

When switching from Direct to Hour split:

- do not silently reinterpret existing HC/TC quantities as hours
- show empty hour-split fields and require explicit input

When switching back to Direct:

- keep the original/current direct HC/TC draft unless the user has explicitly chosen to apply the calculated preview
- simplest implementation may set direct HC/TC from the latest valid split preview at save time only; it must not create hidden persistence state

## Error handling

Inline validation errors should cover:

- malformed total expression
- unsupported operator/token
- negative or non-finite term
- missing/invalid HC or TC hours
- total hours equal to zero

Existing API/version/conflict errors remain unchanged and continue to use the existing quick-entry error mapping and reload action.

The Save button may remain enabled for ordinary validation errors if the current dialog pattern validates on click, but save must be blocked before any API request when the split draft is invalid.

## Components and helpers

Keep the dialog focused on orchestration and rendering. Add isolated pure helpers in the production-entry feature layer for:

1. parsing the addition-only production expression
2. validating split-hour input
3. calculating the proportional HC/TC preview
4. building the Direct quantities used by the payload

Prefer reusing the existing production-calculation rounding helper/rule rather than introducing a second rounding convention.

No backend changes are expected unless implementation reveals an existing API validation incompatibility with the calculated Direct payload.

## Testing

Add focused frontend tests for:

- parser accepts `300`, `300+100`, and whitespace around `+`
- parser rejects subtraction, multiplication, division, parentheses, empty terms, negative values, and non-numeric text
- `8 HC / 2 TC / 300+100` produces HC 320, TC 80, total 400
- zero TC hours sends all quantity to HC
- zero HC hours sends all quantity to TC
- zero total hours is rejected
- rounding preserves `HC + TC = total`
- Direct mode retains current HC/TC behavior
- existing entry edit defaults to Direct using persisted values
- changing popup context resets hour-split-only state
- split save still produces a `Direct` payload
- existing version-conflict, expected-empty, loading, delete, and reload behavior remains covered

Production build and the full frontend test suite must pass.

## Out of scope

- persisting the original formula string
- persisting HC/TC hours
- introducing a new `ProductionEntryMode`
- database migration
- changing Excel/report calculations
- changing batch-entry popup behavior
- supporting arithmetic operators other than addition
