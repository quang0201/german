---
name: visual-qa
description: Render, screenshot, critique, and verify implemented UI against its design contract or visual reference. Use after material frontend changes, when the user asks whether UI looks right, when screenshots/mockups must be matched, or when alignment, wrapping, density, spacing, typography, responsive behavior, or visual polish must be proven rather than assumed from code.
---


# Visual QA

Source code is not visual evidence. Render the interface.

## Preflight

Determine:
- target route/screen;
- design contract or reference;
- target themes;
- target device classes;
- important content states.

Use the available browser/preview tooling. If no browser or screenshot capability exists, state that limitation rather than pretending to inspect the UI.

## Inspection pass

Capture relevant screenshots together, preferably:
- large desktop;
- compact desktop/tablet when the product supports it;
- mobile/narrow width for responsive web.

Default reference sizes when no project-specific sizes exist:
- 1440×900
- 1024×768
- 390×844

Inspect the whole set before editing again.

Review:
- hierarchy;
- first-viewport composition;
- alignment;
- grid consistency;
- spacing rhythm;
- typography and wrapping;
- control sizing;
- icon alignment;
- border/radius/shadow consistency;
- contrast;
- table/chart density;
- overflow;
- sticky/fixed collisions;
- long content;
- state feedback;
- responsive reflow.

## Reference fidelity mode

When a screenshot/Figma/reference exists, compare:
- macro geometry;
- type scale;
- line breaks;
- whitespace distribution;
- surface hierarchy;
- key color relationships;
- component proportions;
- visible states.

Do not chase pixel equality where fonts, browser rendering, or platform chrome make it meaningless. Match the design system and perceptual result.

## Severity

- P0: unusable/broken or content inaccessible.
- P1: major layout/hierarchy/fidelity defect.
- P2: visible polish inconsistency.
- P3: optional refinement.

Fix all P0/P1 and the meaningful P2 items in one batch.

## Bounded loop

1. Inspect desktop + compact/mobile.
2. Write one defect list.
3. Fix in one batched pass.
4. Capture once more to confirm.
5. Stop unless P0/P1 remains or user requests further iteration.

Read `references/visual-review-rubric.md`.
