---
name: design-to-code
description: Implement approved UI/UX direction as production-quality frontend code while preserving the project's framework, design system, semantic HTML, interaction states, responsive behavior, and reference fidelity. Use after design direction is established, when converting screenshots/Figma/mockups to code, or when substantial styling/layout implementation is requested.
---


# Design to Code

Implementation begins after the visual/task contract is sufficiently clear.

## Inspect the project first

Identify:
- framework and routing;
- styling approach;
- component library;
- design tokens;
- existing primitives;
- browser/test workflow;
- relevant project instructions.

Do not replace the chosen stack to make implementation easier.

## Translate design into structure

Implement in layers:
1. semantic page structure;
2. layout/grid;
3. typography;
4. surfaces/borders/elevation;
5. controls and states;
6. responsive behavior;
7. motion;
8. edge states.

Use reusable components where the behavior or visual logic truly repeats.

## Reference-driven work

For screenshots/mockups:
- extract the underlying system, not only coordinates;
- measure relative geometry;
- match type hierarchy and line lengths;
- match spacing rhythm;
- infer responsive behavior cautiously;
- preserve accessibility.

For Figma:
- use exact component/tokens/spec data when available;
- do not eyeball values that the source provides.

## Interaction and accessibility floor

- Use semantic native elements first.
- Buttons perform actions; links navigate.
- Every form control has an accessible label.
- Icon-only controls have accessible names.
- Keyboard focus remains visible.
- Do not disable zoom.
- Honor reduced motion.
- Handle long text and localization.
- Avoid `transition: all`.
- Avoid layout measurement in render when CSS can solve the layout.

## Content quality

Use realistic product copy/data when possible.
Do not fill a polished design with lorem ipsum, arbitrary metrics, or placeholder labels if the product context provides better content.

## Completion

Do not declare completion after compilation.
Hand the rendered result to `visual-qa`, then `responsive-accessibility-audit`.

Read `references/implementation-quality.md`.
