---
name: ui-ux
description: Use when designing, reviewing, or improving product UI/UX, including user perception, first impressions, trust, visual hierarchy, interaction flows, forms, tables, responsive layouts, accessibility, and state feedback.
---

# UI/UX Design and Implementation

Design interfaces that make the user's next action obvious, keep important information easy to scan, and remain usable across input methods and screen sizes. Treat UI code, existing product conventions, and real user workflows as the source of truth.

## Workflow

1. **Understand the task and context.** Identify the user, their primary action, the data involved, and the states or risks that matter. Inspect the existing page, neighboring flows, and design tokens before proposing a new pattern.
2. **Map the interaction.** Account for default, selected, loading, success, validation, empty, error, disabled, and read-only states where relevant. Keep actions reversible and explain consequential changes.
3. **Establish hierarchy.** Make the primary action prominent; group related controls; use concise labels; align repeated data; reserve emphasis for meaningful distinctions. Avoid adding decorative elements that compete with the task.
4. **Use the design system.** Prefer existing components, spacing, typography, color tokens, and interaction patterns. Introduce a new pattern only when existing ones do not serve the task.
5. **Make status clear.** Use consistent colors and labels/icons together; never rely on color alone. Keep status meanings stable across related pages. Check contrast and ensure text remains legible in selected, hover, focus, and disabled states.
6. **Run a perception pass.** Evaluate what the interface communicates at first glance, what attracts attention, what feels clickable or risky, and where visual density or inconsistency creates doubt. Ground impressions in the actual screen and user task; label untested reactions as hypotheses, not user research findings.
7. **Design for real devices and input.** Verify narrow and wide layouts, keyboard navigation, visible focus, touch target size, readable zoom, and long/localized content. Do not depend on hover-only explanations.
8. **Implement and verify.** Add or update focused tests for behavior and key states. Run the relevant test/build commands. When browser tools are available, inspect the rendered result at desktop and mobile sizes and correct visible regressions.

## User perception and visual feel

Use this pass when the user asks whether a screen feels clear, trustworthy, polished, calm, modern, or easy to use. Review three scales:

- **First impression:** Within a few seconds, can a user tell what page/task this is, where to start, and what matters most? Does the page feel intentional rather than crowded or unfinished?
- **Attention and comprehension:** Is the visual scan path predictable? Do grouping, alignment, spacing, typography, and contrast make related information feel related? Are warnings noticeable without making the whole page feel alarming?
- **Confidence and control:** Do actions look actionable before clicking? Does the interface show what was saved, changed, or rejected? Are destructive or consequential actions visually distinct and understandable?

Ask concrete questions rather than applying a generic “modern UI” treatment:

- What will the user notice first, second, and third?
- What could be mistaken for a button, status, selection, or error?
- Does the amount of information feel manageable for the user's real task?
- Are color, icon, shape, and wording reinforcing the same meaning?
- Does anything look inconsistent enough to reduce confidence in the data?
- At a glance, can a user distinguish normal, completed, missing, and exceptional states?

Prefer evidence in this order: observed user behavior or feedback, task-specific usability checks, screenshots/browser inspection, then design heuristics. Do not claim that users “feel” a certain way without user evidence. When direct user testing is unavailable, report the perception risks as reasoned hypotheses and verify the visual hierarchy at the actual viewport sizes.

## Review checklist

- Is the main task immediately understandable?
- Are controls named by their outcome and placed near the data they affect?
- Are related values aligned and easy to compare?
- Can users distinguish status, selection, warning, and error states without relying only on color?
- Are loading, empty, validation, success, and failure outcomes communicated appropriately?
- Do keyboard, screen-reader, and touch users get equivalent access?
- Does the page remain usable with long names, large values, and small viewports?
- At first glance, is the task and the next step clear, and does the screen inspire confidence in its data?
- Does the change follow existing conventions and avoid unrelated redesign?

## Data-entry and operations tables

- Preserve the relationship between row labels, dates, units, and totals while scrolling.
- Use restrained, consistent tints for status and separate status from editable/selected state.
- Explain non-default colors with a nearby legend when their meaning is not self-evident.
- Keep empty values visually distinct from numeric zero when that distinction affects decisions.
- Avoid repetitive status text in every cell when a clear row/day marker and accessible label can convey it.
- Ensure an action opens the expected edit/create mode and that canceling does not erase saved data.

## Deliverable

For implementation work, report the user-visible outcome, verification performed, and any remaining limitation. Do not claim browser verification unless the rendered interface was actually inspected.
