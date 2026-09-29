---
name: product-ui-designer
description: Design usable product interfaces around tasks, information hierarchy, state, feedback, and decision flow. Use for SaaS, desktop-like web apps, forms, settings, onboarding, CRUD workflows, internal tools, ERP screens, or any interface where task completion and clarity matter more than decorative presentation.
---


# Product UI Designer

Design the task before the chrome.

## Define the operating scene

For each screen, know:
- who is using it;
- what they arrived to do;
- what information they need before acting;
- the primary action;
- the safe escape/back path;
- what changes after the action.

## Structure

- Prefer one clear primary action per decision point.
- Keep secondary actions available without competing visually.
- Use progressive disclosure for infrequent complexity.
- Keep navigation predictable and preserve location/context.
- Use smart defaults where they reduce configuration burden.
- Keep destructive actions reversible or explicitly confirmed.
- Make high-frequency actions fast and keyboard-friendly when appropriate.

## Complete the state model

Consider applicable states before shipping:
- loading;
- empty;
- first-run;
- success;
- validation error;
- server/network error;
- permission denied;
- disabled/read-only;
- partial data;
- long/overflowing content;
- destructive confirmation;
- unsaved changes.

Do not invent unnecessary states; do not ignore states the product can realistically enter.

## Feedback

Actions must visibly resolve.
Use:
- inline validation;
- progress;
- optimistic feedback only when safe;
- clear success confirmation;
- actionable errors;
- preserved user input after recoverable failure.

## Content design

Labels should describe the action or object.
Prefer specific verbs over vague "Continue".
Empty states should explain what the area is for and what to do next.

## Visual hierarchy

Use position, typography, density, grouping, and contrast before adding decoration.

Read `references/product-ui-checklist.md` before approving a complex product screen.
