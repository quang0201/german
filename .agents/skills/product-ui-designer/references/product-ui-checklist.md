# Product UI Checklist

## Task
- Primary task is obvious in the first viewport.
- Primary action is visually singular.
- Secondary actions do not compete.
- User can cancel/back out safely.

## Structure
- Navigation location is clear.
- Filters and view state are preserved where appropriate.
- Repeated work does not require unnecessary dialogs.
- Dense screens group by task, not by arbitrary card boundaries.

## Forms
- Labels persist outside placeholders.
- Required/optional meaning is clear.
- Errors appear near the field and suggest recovery.
- Submitted values are preserved after recoverable errors.
- Keyboard order follows visual order.

## Feedback
- Loading does not cause layout chaos.
- Empty state teaches the next useful action.
- Success is visible but not disruptive.
- Destructive operations confirm or support undo.

## Content resilience
Test:
- very short labels;
- long translated labels;
- long names/IDs;
- no data;
- many rows;
- large numbers;
- error copy;
- narrow width.

## Trust
- Sensitive actions show consequences.
- Irreversible actions are explicit.
- System status is not hidden behind decorative UI.
