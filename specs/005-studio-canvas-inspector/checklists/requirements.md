# Specification Quality Checklist: Studio Canvas and Properties Inspector

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-16
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

**Status: 16 of 16 passing.**

## Clarifications resolved

All three markers were answered on 2026-08-16 and folded into the spec. Requirement IDs were
renumbered to keep the additions in reading order; nothing referenced them yet.

1. **The canvas's authoring time → a scrub control (option B).** FR-010 gives the editor a control
   that sets the current slide's authoring time; the canvas renders at that time through the
   player's own resolution. FR-011 keeps out-of-window elements selectable via an editor-only
   treatment, which is what the original marker existed to guarantee — a scrub alone would leave an
   element unreachable at any time outside its window.
2. **Element creation and on-canvas text editing → both in scope (option B).** FR-013 through
   FR-017 cover the Add menu, validity of newly added elements, plugin-declared on-canvas text
   surfaces, edit-mode shortcut suppression, and the prohibition on a second text render path.
3. **Deletion safety → confirmation (option B).** FR-033 requires an explicit confirmation naming
   what will be removed, once per multiple selection. FR-039 makes the confirmation keyboard-
   operable and focus-correct.

## Changes forced by the answers

- **SC-011 was removed.** It read "a deleted element can be restored by the teacher in a single
  action", which option B makes false. SC-013 replaces it: zero unconfirmed deletions.
- **SC-004 was added.** Rendering at an authoring time makes a stronger parity claim checkable than
  geometry alone — the canvas's state at time *t* can now be compared against the player's state at
  the same *t*, not merely the element's position.
- **The `Edit` key entity was rewritten.** It previously described itself as the unit ED-5's
  undo/redo would consume, which presumed a journal this feature no longer builds. It now says
  plainly that no history is kept and that this is why deletion is confirmed.
- **A new "Opened by this feature" section** records the two obligations the answers create: the
  confirmation prompt that ED-5 owes a replacement for and should *remove*, and the second control
  writing the authoring time that ED-3 owes a merge for.

## Notes on borderline items

Three items are deliberately close to the "no implementation details" line and were kept:

- **FR-019 and FR-025** reference the plugin contract's field kinds and scoped data access. This is
  arguably an implementation detail, but the contract is a *product* commitment (FR-FWK-002,
  FR-FWK-011) and stating it in prose only would make it untestable.
- **FR-015** requires the set of on-canvas-text-editable types to come from registration rather than
  a branch in the canvas. Structural, and here because Constitution I makes registry-driven
  extension non-negotiable.
- **SC-010** counts per-type branches in the inspector, which is a structural measure rather than a
  user-facing one. Without it, "the inspector is plugin-driven" is unfalsifiable.

## Risk carried into planning

The sharpest unresolved tension is **FR-017 against Constitution V**. On-canvas text editing puts an
editable surface inside the one component that must not fork between editor and player, while
FR-043 requires editor-only affordances to live outside the element renderers. These are satisfiable
together, but not accidentally — the shape that satisfies both is a planning decision, and getting
it wrong produces exactly the forked render path Constitution V calls a severity-2 defect. Flag it
for `/speckit-plan` rather than discovering it during implementation.
