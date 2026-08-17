# Specification Quality Checklist: Timeline and Simple Sequence Mode

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

All three were answered on 2026-08-16 by taking the recommended option. Requirement IDs were
renumbered as a result; the list is FR-001–FR-047 and nothing referenced the old numbering yet.

1. **Playback → a real clock.** FR-010 and FR-011 give the timeline play, pause, and restart driven
   by the framework's existing transport, with one clock in the editor: the playhead reflects it
   while playing and commands it while seeking. US1 gained five acceptance scenarios, including
   pausing when the document is hidden (BR-013), and SC-015 verifies it against the transport rather
   than against a second timing mechanism.
2. **Effects → fully authorable.** FR-024 and FR-025 make effects addable, configurable, and
   removable, sourced from the effect registry. US3 was already written for this; what changed is
   that it is now settled rather than assumed.
3. **Simple Sequence → orders events, not only elements.** FR-033 and FR-034 define an event as an
   element appearing *or* an effect running, and US4's scenarios were generalised accordingly. The
   deciding argument is UC-02, *Create a Chronological Effect Sequence*: a teacher revealing a list
   one line at a time is sequencing effects, and a mode that could only order elements would send
   them to the timeline for the commonest case it exists to serve.

## What the answers changed beyond the three requirements

- **Two new entities**: *Event*, the unit a sequence orders, and *Transport*, named explicitly so
  the "one clock" decision is visible rather than implied.
- **Two new success criteria**: SC-015 (playback runs on the player's clock) and SC-016 (a list can
  be revealed line by line without opening the timeline — UC-02 as a measurable outcome).
- **A new assumption**, that playback reuses `createTransport` from Wave 1 rather than introducing a
  clock, and that this is where the editor-and-preview clock question is decided rather than left
  for ED-6 to discover.
- **A new "If this feature has to be cut" section.** Taking all three recommendations makes this a
  large feature, so the cut line is written down now: US4's effect half is severable, costs UC-02
  and SC-016, and nothing else depends on it. Feature 005 did the same for align/distribute, and
  naming it in advance is what stops it being decided badly under pressure.
- **One scope exclusion added**: playing *across* slides. Playback runs the selected slide; advancing
  between slides is the player's behaviour and belongs to preview (ED-6).

## Two questions deliberately *not* asked, because the constitution settles them

- **Where Simple Sequence data lives.** Constitution III: "Simple Sequence Mode and Timeline Mode
  MUST read and write the same timeline data. Mode-specific storage MUST NOT be introduced." So
  relationships are derived from absolute times and Custom is a derived classification. This would
  otherwise have been the feature's largest open question and would have implied a `schemaVersion`
  bump and a migration.
- **Whether the timeline replaces the authoring-time scrub or sits beside it.** Feature 005 recorded
  the obligation in its own spec: two controls writing one value is a parity hazard if it outlives
  ED-3. FR-006 discharges it.

## Notes on borderline items

- **FR-017, FR-024, and FR-025** reference the effect registry. Close to the "no implementation
  details" line, but the registry is a *product* commitment (FR-FWK-003, FR-FWK-004), and stating it
  in prose alone would make it untestable — a per-effect branch in the timeline is exactly what
  Constitution I forbids.
- **SC-008 and SC-014** count fields in a saved manifest, which is structural rather than
  user-facing. They are here because "the sequence stores nothing" and "editor state never leaks"
  are otherwise unfalsifiable, and the second is the invariant feature 005 established.

## Risks carried into planning

**Two clocks is the failure mode to design against.** FR-011 says there is one clock in the editor,
and the editor is now a second consumer of the transport alongside the player. ED-6 will be a third.
If planning finds itself introducing a timing mechanism rather than driving the existing one, that
is the drift signal — the same one feature 005's sequencing notes raised about its single core
change.

**Nothing here should require a resolver change.** The timeline renders through the same `resolve()`
the player uses (FR-043), and effects change what it returns at a moment; this feature is a
*consumer* of both. A resolver change appearing in planning means the design drifted.

**This is a large feature.** Three recommended answers each widened it, and the cut line is recorded
in the spec rather than left to be improvised.
