---
name: design-system-guardian
description: Preserve, extract, and evolve a frontend design system using semantic tokens, reusable component metrics, documented states, and disciplined exceptions. Use when implementing UI in an existing product, refactoring repeated styling, creating DESIGN.md, translating Figma/reference specs into reusable primitives, or preventing visual drift and one-off hardcoded values.
---


# Design System Guardian

A design system is a consistency mechanism, not a gallery of components.

## Inspect before creating

Before adding styles or primitives, find:
- existing `DESIGN.md` / brand docs;
- theme/token files;
- component library;
- Storybook;
- CSS variables;
- Tailwind/theme config;
- typography setup;
- shared layout primitives.

Reuse before inventing.

## Three-tier model

Organize design decisions in this order:

1. Global semantic tokens
   - color roles;
   - typography roles;
   - spacing scale;
   - radius;
   - elevation;
   - motion.

2. Component metrics
   - control heights;
   - internal gaps;
   - icon sizes;
   - padding;
   - state behavior.

3. Screen/layout metrics
   - page gutter;
   - max width;
   - column/grid behavior;
   - section rhythm.

Do not hide screen-specific geometry in global tokens.

## Extraction rule

Extract a reusable component/token when repeated use has the same intent.
Do not abstract a pattern merely because it appears twice by coincidence.

Before extraction, define:
- responsibility;
- variants;
- state model;
- accessibility behavior;
- default size/density;
- composition API.

## Exceptions

When a screen legitimately needs an exception:
- keep the exception local;
- explain the reason if non-obvious;
- do not distort the global token system to fit one special case.

## Design contract

If the project lacks a design-language document and the work is substantial, create/update `DESIGN.md` with:
- typography;
- semantic color;
- spacing/grid;
- components;
- interaction/motion;
- responsive rules;
- accessibility expectations.

Read `references/design-system-contract.md`.
