# Design System Contract

## Token naming
Prefer semantic names:
- `surface-canvas`
- `surface-raised`
- `text-primary`
- `text-muted`
- `border-subtle`
- `accent-primary`
- `status-danger`

Avoid names that encode a literal color when the value has semantic meaning.

## Component states
Document applicable:
- default;
- hover;
- active/pressed;
- focus-visible;
- disabled;
- loading;
- invalid;
- selected;
- read-only.

## Density
For operational software, consider explicit density modes or compact variants rather than ad-hoc small padding.

## Typography
Define roles rather than arbitrary sizes:
- display;
- page title;
- section title;
- body;
- label;
- caption;
- mono/data.

## Review
Flag:
- raw hex values where semantic tokens exist;
- one-off radii;
- duplicated buttons/inputs;
- inconsistent icon sizes;
- local shadows that contradict elevation rules;
- new typography without a role.
