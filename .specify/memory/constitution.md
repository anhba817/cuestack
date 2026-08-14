<!--
SYNC IMPACT REPORT
==================
Version change: [unset template] → 1.0.0 (initial ratification)

Modified principles:
  [PRINCIPLE_1_NAME] → I. Code Quality & Modular Boundaries
  [PRINCIPLE_2_NAME] → II. Test-First & Deterministic Verification (NON-NEGOTIABLE)
  [PRINCIPLE_3_NAME] → III. User Experience Consistency
  [PRINCIPLE_4_NAME] → IV. Performance as a Contract
  [PRINCIPLE_5_NAME] → V. Preview-Player Parity (NON-NEGOTIABLE)

Added sections:
  Technology & Architecture Constraints (was [SECTION_2_NAME])
  Development Workflow & Quality Gates (was [SECTION_3_NAME])
  Governance (populated)

Removed sections: none

Notes:
  Principle V was not among the four requested focus areas. It is included because
  preview-player parity is the product's central promise (spec 6.3, FR-PLY-001) and
  constrains code structure directly. Remove it if the four requested areas are the
  intended full scope.

Follow-up TODOs: none — no placeholder tokens remain.
-->

# Cuestack Constitution

## Core Principles

### I. Code Quality & Modular Boundaries

Code quality here means the boundaries hold under pressure, not that the code reads nicely.

- TypeScript `strict` is mandatory. `any` MUST NOT appear in an exported signature.
  `@ts-expect-error` requires an adjacent comment naming the reason; bare `@ts-ignore` is banned.
- `@cuestack/core` MUST NOT import any UI framework. React, Vue, and Svelte code lives only in
  adapter packages. This is enforced by a dependency-boundary lint rule in CI, not by convention.
- Element types, effects, question types, and publishing adapters MUST be added through the
  registries (FR-FWK-001, FR-FWK-003). Adding a type by editing a `switch` in core is a defect.
- A plugin MUST supply its full contract before merge: data schema, editor component, player
  renderer, inspector configuration, and validator (FR-FWK-002). Partial plugins are rejected.
- Public package APIs follow semver. Any change to the lesson manifest MUST bump `schemaVersion`
  and ship a migration function in the same change (FR-FWK-005, FR-FWK-006).
- Dead code, commented-out code, and TODOs without a tracked issue link MUST NOT merge.

**Rationale:** The framework's stated goal is that new element and effect types are addable
without rewriting the canvas, timeline, or player (Goal 5). That property survives only if the
boundary is machine-enforced; every hand-enforced boundary in a growing codebase eventually leaks.

### II. Test-First & Deterministic Verification (NON-NEGOTIABLE)

- Playback timing, slide-advance rules, Simple Sequence to absolute-time conversion, and the
  validation engine MUST be developed test-first: failing test, then implementation, then refactor.
- Timing tests MUST drive an injectable virtual clock. A test MUST NOT depend on wall-clock sleeps,
  real `requestAnimationFrame`, or real media playback.
- Every business rule BR-001 through BR-018 MUST have at least one test named for its rule ID.
- Every MVP acceptance scenario (spec section 34, A through F) MUST exist as an automated
  end-to-end test before the corresponding feature is called done.
- Each element and effect plugin MUST ship parity tests (FR-FWK-013) and manifest round-trip tests
  proving serialize-deserialize produces an identical structure.
- A bug fix begins with a regression test that fails against the unfixed code.
- Coverage floors: 90% line and branch coverage for `@cuestack/core` and `@cuestack/schema`.
  UI packages carry no numeric floor — behavioral tests are required instead of coverage theater.

**Rationale:** NFR-REL-005 promises deterministic playback for the same manifest and player
version. That promise is only credible if it is verified deterministically; a timing suite that
depends on real time is a suite that will be muted the first week it flakes.

### III. User Experience Consistency

- Simple first, precision on demand (spec 7.1). A capability an ordinary teacher needs MUST NOT be
  reachable only through Timeline Mode.
- Simple Sequence Mode and Timeline Mode MUST read and write the same timeline data
  (FR-SEQ-005, FR-SEQ-006). Mode-specific storage MUST NOT be introduced.
- All visual styling MUST resolve from theme tokens (FR-FWK-010). Hard-coded colors, fonts, or
  spacing inside an element implementation MUST NOT merge.
- WCAG 2.2 Level AA is a merge gate for learner-facing UI (NFR-ACC-001). Every interactive control
  MUST be keyboard-operable with an accessible name, role, and state; MUST honor reduced-motion;
  and MUST NOT convey essential information through color or motion alone.
- Destructive actions MUST be undoable or confirmed (NFR-USA-003). Error messages MUST state the
  problem, the affected object, and the recommended action (NFR-USA-004).
- Save and publish status MUST use one shared component and one vocabulary across the application:
  Saving, Saved, Offline, Save Failed (FR-DAT-002).
- A new element type MUST support keyboard interaction and expose its accessibility metadata in the
  same change that introduces it. Accessibility is never a follow-up ticket.

**Rationale:** Teachers move constantly between slides, modes, and element types. Inconsistency is
indistinguishable from a bug to a non-technical user, and the moments of truth in spec section 17
all depend on the interface behaving the way the previous screen taught them to expect.

### IV. Performance as a Contract

These budgets are acceptance criteria, not aspirations. A change that regresses one is reverted,
not scheduled for later optimization.

| Budget | Source |
|---|---|
| Input to visual feedback for select, move, resize: 100 ms | NFR-PERF-002 |
| Timeline seek to correct rendered state: 100 ms | NFR-PERF-003 |
| Playback: 60 fps target, 30 fps floor on the reference device | NFR-PERF-004 |
| Editor interactive for 50 slides / 300 elements, media excluded: 3 s | NFR-PERF-001 |
| First slide rendered after manifest available: 2 s | NFR-PERF-006 |
| Preview vs published timing divergence, non-streaming elements: 100 ms | spec section 9 |
| Autosave begins after last eligible edit: ~1.5 s | NFR-PERF-005 |

Implementation rules that follow from the budgets:

- Seeking MUST recompute element state from the manifest. Replaying prior effects to reach a
  seek target is prohibited (spec 30.5).
- Playback MUST derive from a single monotonic clock. Independent CSS animation delays MUST NOT be
  the source of truth for timing (FR-TIM-019).
- Next-slide preload MUST NOT block current-slide playback (NFR-PERF-007).
- A performance fixture of 50 slides and 300 elements runs in CI. A regression beyond 10% on any
  budget fails the build.

**Rationale:** The product's differentiating claim is precise timing. A dropped frame or a laggy
playhead does not read as a minor performance issue to a teacher — it reads as the tool being
wrong about time, which is the one thing it exists to be right about.

### V. Preview-Player Parity (NON-NEGOTIABLE)

- There is exactly one renderer, one timing engine, and one implementation of each effect, shared
  by editor preview and learner player (FR-PLY-001). A forked code path MUST NOT merge.
- Editor-only affordances — selection handles, snapping guides, hidden-element rendering — live in
  an editor overlay layer, never inside the element renderer, and MUST NOT reach playback
  (FR-PLY-016, BR-010).
- The lesson manifest is the single source of truth (spec 7.3). Editor state that is not serialized
  into the manifest MUST NOT influence playback.
- A parity divergence reaching production is treated as a severity-2 defect: fix the shared engine
  and add the failing case as a shared fixture. Patching one side only is prohibited.

**Rationale:** "What you preview is what the learner receives" is the product's central promise
(spec 6.3), and the identified risk of losing it is teachers abandoning the tool. Parity bugs spend
trust that costs far more to rebuild than it did to establish.

## Technology & Architecture Constraints

- **Language:** TypeScript in strict mode across every package.
- **Primary adapter:** React. Additional adapters are thin bindings over the same core.
- **Package graph:** `@cuestack/schema` ← `@cuestack/core` ← adapters
  (`@cuestack/react`, `@cuestack/vue`, `@cuestack/svelte`, `@cuestack/element`).
  Dependencies flow one direction only. Cycles fail the build.
- **Data invariants:** all timing values are non-negative integer milliseconds (BR-001); element
  geometry is stored in logical canvas coordinates independent of display size (FR-CAN-017).
- **Versioning invariants:** published versions are immutable (BR-008); draft edits MUST NOT alter
  a published manifest (BR-009).
- **Browser support:** latest two major versions of Chrome, Edge, Safari, and Firefox. Authoring
  targets desktop at 1280 px and wider; the player targets desktop, tablet, and mobile.
- **Security:** rich text and plugin-supplied content MUST be sanitized against script injection
  (NFR-SEC-007). Plugins receive scoped data access only and MUST NOT reach unrelated lesson or
  user data (FR-FWK-011).
- **Dependencies:** a new runtime dependency in `@cuestack/core` requires explicit justification in
  review. The core keeps a deliberately small dependency surface because it ships to every adapter.

## Development Workflow & Quality Gates

**CI gates — all blocking, in order:**

1. Typecheck (strict, zero errors)
2. Lint, including the dependency-boundary rule and the no-hardcoded-theme-values rule
3. Unit and integration tests
4. Coverage floors for `core` and `schema`
5. Parity fixtures across every registered element and effect
6. Automated accessibility checks on learner-facing components
7. Performance fixture within budget

**Definition of done for a feature:**

- The spec requirement IDs it implements are referenced in the pull request.
- Tests exist for each relevant business rule and, where applicable, the section 34 scenario.
- A keyboard-only pass has been performed on any new interactive surface.
- Performance budgets are unchanged or improved.
- If the manifest changed: `schemaVersion` bumped, migration written, migration tested.

**Review requirements:**

- The reviewer verifies principle compliance, not only correctness.
- Any deviation from a principle requires a Deviation note in the pull request stating what simpler
  approach was attempted and why it failed. "It was faster this way" is not a deviation rationale.
- A pull request that cannot state which principles it touches is not ready for review.

## Governance

This constitution supersedes other conventions, style guides, and habits in this project. Where a
tool default and this document disagree, this document wins and the tool gets reconfigured.

**Amendment procedure.** Amendments are made by pull request modifying this file, and MUST include
the rationale for the change, the version bump, and a migration plan for any existing code the
amendment invalidates. Amendments require approval from the project owner. Silent drift — code that
diverges from a principle without an amendment — is a defect in the code, not in the principle.

**Versioning policy.** This document follows semantic versioning:

- **MAJOR** — a principle is removed, or redefined in a way that invalidates existing compliant code
- **MINOR** — a principle or section is added, or existing guidance is materially expanded
- **PATCH** — clarifications, wording, and typo fixes that do not change what is required

**Compliance review.** Every pull request review verifies compliance. Principles I, II, IV, and V
are additionally enforced mechanically by the CI gates listed above; a green build is necessary but
not sufficient. Violations found after merge are tracked as defects and either fixed or formally
ratified as an amendment — never left as undocumented precedent.

**Runtime guidance.** Requirements are sourced from `docs/Cuestack_Framework.md`. Agent-facing
development guidance belongs in `CLAUDE.md` and MUST NOT restate or contradict this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
