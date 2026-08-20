# Specification Quality Checklist: Portable Packages and the HTTP Adapter

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-19
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

## Notes

All 16 items pass, after a clarification session that asked five questions and changed the shape of
the feature in four places.

**Resolved in `/speckit-specify` (2 questions)**

- **FR-006** — both asset modes, references by default.
- **FR-019** — the host maps operations onto its own API.

**Resolved in `/speckit-clarify` (5 questions)**

- **Studio scope** — a minimal control, not a panel. Added FR-040–FR-043 and SC-012/SC-013, and brought
  Constitution III and the a11y gate into this feature's obligations.
- **Package form** — one JSON document, always. This resolved a live contradiction the spec had been
  carrying: User Story 1 promised "one file, everything in it" while the Assumptions said "a package
  is a value, not a file". The assumption is now split into the half that is true (the framework does
  not do filing) and the half that had to change (it does fix the format).
- **Import purity** — import produces a lesson rather than storing one. This *invalidated* two
  requirements as written: FR-015's "create a new lesson" and FR-016's "leave nothing partially
  created" both described a write that no longer happens. Both were rewritten rather than left to be
  read charitably, and FR-016 now says the property follows from FR-015 rather than being arranged.
- **Asset identity on import** — the host stores and reports back a mapping; the framework rewrites
  references. This closed a hole the import-purity answer had just opened, and is the reason import
  is two steps rather than one.
- **Hostile packages** — bounded size and depth, an address-scheme restriction, and a stated
  boundary. This discharges NFR-SEC-007 for the import path, which nothing in the spec had done.

**Costs recorded rather than solved**, and carried into planning as such:

- A host mapping that misreports a conflict as a plain failure cannot be detected by the framework
  (FR-019, Assumptions).
- Files-mode packages are larger than the bytes they carry, and a media-heavy one may not fit in
  memory — it must fail saying so (FR-004c, Edge Cases).
- Import does not inspect asset content or sanitize markup, and FR-016c requires that boundary to be
  documented rather than discovered.

**Changed by `/speckit-analyze` remediation (2026-08-19)**

- **FR-007 was unimplementable** as written. It required export to report an unresolvable asset "in
  either mode" while FR-006b requires reference mode to be pure — and resolving an asset means asking
  the outside world. Rewritten so each mode discharges the obligation the way it can, with FR-007a
  pointing at `checkAssets`, which already answers that question and would have disagreed with a
  second, weaker copy of the check.
- **FR-031 had no task at all.** Every failure must state problem, object, and action, and the
  feature has ten distinct failure messages. Two suites added (T030a, T044a).
- **The studio block was renumbered** FR-029a–d → FR-040–FR-043. Sub-letters read as extensions of
  their parent, and FR-029 is about adapter testability. 032–035 was rejected because FR-032a and
  FR-037 in this spec are cross-references to feature 009.
- **The plan claimed a coverage protection that did not exist.** Corrected, and T002 now widens the
  floor to reach `packaging/`.

One item deliberately allows an apparent implementation reference: the spec names `migrate` and the
existing adapter interfaces by name. They are prior contracts of this codebase rather than technology
choices, and naming them is what makes the dependency section checkable.
