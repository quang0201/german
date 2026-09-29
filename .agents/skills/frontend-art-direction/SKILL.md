---
name: frontend-art-direction
description: Create a distinctive, context-specific visual language for web UI without falling into generic AI-generated aesthetics. Use for new pages, substantial visual redesigns, bland or overly safe interfaces, marketing surfaces, or product UI that needs stronger typography, composition, color, imagery, motion, and visual personality.
---


# Frontend Art Direction

Design with a point of view. A polished result can be quiet or bold, but it must be intentional.

## Start from the subject

Before styling, identify:
- purpose;
- audience;
- product category;
- usage frequency;
- emotional requirement;
- constraints;
- one memorable quality the surface should have.

If `DESIGN.md` exists, treat it as the visual contract.

## Build the visual system

### Typography
Choose typography for the product, not for model familiarity.

- Use project fonts if a brand system already exists.
- In greenfield work, avoid defaulting to the same safe sans-serif stack on every project.
- Create hierarchy through role, scale, weight, line height, measure, and spacing.
- For dashboards and tables, treat numerals deliberately and use tabular figures when comparisons matter.
- Minimal typography still needs character and optical refinement.

### Color
- Use semantic roles, not random per-component colors.
- Prefer one dominant visual field plus controlled accents over evenly distributed rainbow emphasis.
- Tint neutrals when appropriate; avoid lifeless gray-on-gray by default.
- Keep secondary text legible, especially on colored surfaces.

### Composition
- Use a deliberate grid.
- Allow asymmetry, overlap, editorial pacing, or controlled density when appropriate.
- Avoid centering everything by reflex.
- Do not wrap every conceptual group in a rounded card.
- Reserve containers, borders, and elevation for real structure.

### Imagery and atmosphere
When imagery materially improves the brief, use a suitable image source or generation workflow rather than replacing imagery with gradients and abstract blobs.

### Motion
Use motion to explain state, hierarchy, or continuity.
Prefer a few coherent transitions over scattered novelty.
Honor reduced-motion preferences.

## Anti-generic rules

Read `references/anti-generic-ui.md`.

Reject a first draft that contains several of these without product-specific justification:
- generic gradient hero;
- interchangeable four-card feature grid;
- rounded-square icon tile over every heading;
- nested cards;
- oversized empty spacing in operational software;
- arbitrary glassmorphism;
- purple/blue accent by habit;
- default font stack with no typographic reasoning;
- decorative charts;
- identical radii on every object;
- shadows used everywhere;
- copy that sounds like placeholder marketing.

## Minimalism rule

Minimal does not mean unfinished.

A minimal interface must show precision in:
- proportions;
- type;
- optical alignment;
- spacing rhythm;
- material contrast;
- interaction states;
- content quality.

If removing decoration also removes identity, hierarchy, or affordance, the design is merely sparse.

Read `references/aesthetic-dimensions.md` when selecting a direction.
