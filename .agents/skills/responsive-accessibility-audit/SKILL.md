---
name: responsive-accessibility-audit
description: Audit frontend UI for responsive reflow, keyboard/focus behavior, accessible semantics, form usability, touch targets, motion preferences, localization resilience, and common web-interface implementation defects. Use before shipping frontend work or when asked to review accessibility, responsiveness, forms, mobile behavior, or UI best practices.
---


# Responsive & Accessibility Audit

Treat accessibility and responsive behavior as shipping gates, not optional polish.

## Responsive audit

Test actual rendered layouts at relevant widths.

Check:
- no accidental horizontal overflow;
- content priority survives reflow;
- navigation remains usable;
- sticky/fixed UI does not cover content;
- tables have an explicit narrow-screen strategy;
- dialogs/sheets fit the viewport;
- long labels and localized content do not break controls;
- touch controls are comfortably targetable;
- important actions stay reachable.

Prefer CSS grid/flex/reflow over JavaScript layout measurement.

## Accessibility audit

Use native semantics before ARIA.

Check:
- keyboard navigation;
- visible focus;
- focus not hidden by sticky content;
- accessible names;
- labels/instructions;
- headings;
- link vs button semantics;
- image alternatives;
- live status announcements when needed;
- contrast;
- reduced motion;
- drag alternatives;
- target size/spacing;
- errors and recovery.

## Forms

Check:
- persistent labels;
- meaningful `name`, type, and autocomplete;
- paste is not blocked;
- inline errors;
- focus first invalid field when appropriate;
- unsaved-change protection for meaningful data entry.

## Interaction

Check applicable:
- hover;
- active;
- focus-visible;
- disabled;
- loading.

Never remove outlines without a replacement focus indicator.

## Content and localization

- Handle empty and long content.
- Use locale-aware date/number formatting.
- Avoid hardcoded date/currency presentation when localization matters.
- Ensure layouts tolerate text expansion.

Read `references/web-interface-checklist.md`.
