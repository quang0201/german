---
name: design-orchestrator
description: Route and coordinate non-trivial UI/UX work from research and design direction through implementation, rendered visual QA, responsive checks, and final polish. Use for greenfield pages, substantial redesigns, dashboards, product UI, screenshot-driven implementation, or any frontend task where visual quality matters and multiple design skills should be sequenced.
---


# Design Orchestrator

Treat design as a staged product-development workflow, not a styling pass.

## Route the task

Classify the request before editing code.

- Greenfield or major redesign with no concrete visual reference:
  1. Run `design-research`.
  2. Establish or update `DESIGN.md`.
  3. Use `product-ui-designer` for task structure.
  4. Use `frontend-art-direction` for visual identity.
  5. Add `dashboard-designer` for data-dense operational surfaces.
  6. Use `design-system-guardian` before introducing new primitives.
  7. Implement with `design-to-code`.
  8. Verify with `visual-qa`.
  9. Finish with `responsive-accessibility-audit`.

- Existing product with an established design system:
  1. Inspect the existing design language first.
  2. Preserve product identity unless the user explicitly asks for a redesign.
  3. Route only to the skills needed for the requested change.
  4. Always run rendered visual QA after material layout or styling changes.

- User supplies screenshot, Figma, mockup, or live reference:
  1. Treat the reference as the visual contract.
  2. Skip broad inspiration research.
  3. Extract layout, typography, spacing, color, component behavior, and responsive intent.
  4. Implement through reusable project primitives.
  5. Compare the rendered result against the reference with `visual-qa`.

- Operational dashboard / ERP / admin:
  Route through `dashboard-designer`; do not force marketing-site aesthetics onto operational software.

## Quality gates

Do not mark design work complete unless all applicable gates pass:

1. The surface has a clear user, task, and priority.
2. A deliberate visual direction exists; "clean and modern" is not enough.
3. The design has at least one context-specific signature decision without harming usability.
4. Existing project tokens/components are reused when appropriate.
5. Realistic content and edge states were considered.
6. The UI was rendered in a browser or native preview.
7. Desktop and mobile/compact layouts were inspected together.
8. Major visual defects were fixed in one batched pass, then confirmed once.
9. Accessibility and responsive behavior meet the project quality floor.

## Guardrails

- Do not approve a UI from source code alone.
- Do not substitute generic SaaS conventions for product understanding.
- Do not make every section a card.
- Do not use decorative complexity to compensate for weak hierarchy.
- Do not equate minimalism with sparse, unfinished composition.
- Do not invent research, browser inspection, or screenshot verification that did not occur.
- Keep verification bounded: one primary inspection/fix pass plus one confirmation pass unless the user asks for more iteration.

Read `references/workflow-gates.md` when deciding whether a surface is ready to ship.
