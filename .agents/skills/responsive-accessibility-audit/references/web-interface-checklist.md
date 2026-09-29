# Web Interface Checklist

This checklist is intentionally compact. Apply only rules relevant to the surface.

## Semantics
- action → button;
- navigation → link;
- form control → label/accessibility name;
- tabular data → table when semantically tabular;
- headings are hierarchical.

## Focus
- visible `:focus-visible`;
- no outline removal without replacement;
- focus not fully hidden behind sticky/fixed UI.

## Target size
WCAG 2.2 AA target-size minimum is 24×24 CSS px or sufficient spacing under the stated exceptions. Prefer larger comfortable targets for primary controls and touch-heavy UIs.

## Forms
- correct input type/inputmode;
- autocomplete where appropriate;
- no paste blocking;
- inline error + recovery;
- disabled/loading state is clear.

## Motion
- honor `prefers-reduced-motion`;
- avoid `transition: all`;
- prefer compositor-friendly transform/opacity for frequent animation.

## Content
- long strings;
- empty arrays/strings;
- text expansion;
- images with dimensions;
- no inaccessible clipping.

## Mobile/reflow
- no accidental x-scroll;
- safe-area handling for full-bleed mobile UI where relevant;
- sticky elements do not obscure focus/content;
- table strategy is explicit.

## Locale
- use locale-aware dates, numbers, and currency when product requirements include localization.
