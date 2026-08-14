---

description: "Task list for Headless Kernel (Wave 1)"
---

# Tasks: Headless Kernel

**Input**: Design documents from `/specs/002-headless-kernel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included and are mandatory. Constitution Principle II is
NON-NEGOTIABLE and names exactly this feature's subject matter — playback timing, advance
rules, and the resolver — as test-first. FR-034/035 add the rule-traceability and
no-real-time-waiting obligations. Tests are written first and must be observed failing.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: US1–US5 from spec.md
- Exact file paths are included in every task

## Path Conventions

`packages/core/src/{time,resolve,effects,elements,advance,ports,adapters}/` and
`packages/core/test/{rules,resolve,advance,transport,registry,adapters,harness}/`, per plan.md.

## Two sequencing notes

**Registry mechanics are foundational; extensibility is US4.** `resolve()` cannot compose an
effect without an effect registry to look it up in, so the registry *types and skeletons* land
in Phase 2. US4's own phase holds what actually distinguishes it — that a *synthetic* type
registers and participates, that an incomplete registration is refused, and that unknown types
degrade by criticality. Same split feature 001 used for the workspace and its exports maps.

**SC-002's parity sweep belongs to US3, not US1.** With a pure fold, "played to *t*" and
"seeked to *t*" are the same call, so comparing `resolve` against itself proves nothing. The
meaningful test steps a *transport* forward and compares against a direct seek — which needs a
transport to exist. US1 proves resolution is correct; US3 proves the paths agree.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The harness every later test uses, and the lint rule that protects the registry.

- [X] T001 Create the synthetic clock and fixture builders in `packages/core/test/harness/index.ts` — a hand-advanced time source (not Vitest fake timers, per research R-03), plus builders for slides with arbitrary element and effect counts
- [X] T002 [P] Add the `no-switch-on-element-type` rule to `tools/eslint-config/index.js` — forbid `switch` on `element.type` or `effect.type` outside `packages/core/src/{elements,effects}/registry.ts` (research R-06)
- [X] T003 [P] Add a headless guard test at `packages/core/test/headless.test.ts` asserting no reference to `window`, `document`, `performance`, or `requestAnimationFrame` appears in `packages/core/src/**`
- [X] T004 [P] Extend `packages/core/test/harness/corpus.ts` with the slide corpus the parity and determinism sweeps iterate: the reference manifest plus synthetic slides covering every effect phase, overlapping effects, and empty-effect elements

**Checkpoint**: `pnpm test` still green; the harness imports cleanly with no source under test.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The types and skeletons every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define `RenderState`, `ResolvedElement`, `ActiveEffect`, `RenderProblem`, and `BlockingProblem` in `packages/core/src/resolve/state.ts` per data-model.md
- [X] T006 [P] Define `Contribution`, `TransformDelta`, and `FilterDelta` in `packages/core/src/resolve/contribution.ts` — types only; composition arrives in T024
- [X] T007 [P] Define `EffectDescriptor` and the effect registry skeleton in `packages/core/src/effects/registry.ts`
- [X] T008 [P] Define the `ElementPlugin` contract in `packages/core/src/elements/contract.ts` so all five members are required at the type level, plus the registry skeleton in `packages/core/src/elements/registry.ts` (contracts/plugin-contract.md)
- [X] T009 [P] Define the port types across three files, matching plan.md's structure: `TimeSource` and the aggregate `Ports` type in `packages/core/src/ports/index.ts`, `MediaPort` and `MediaStatus` in `packages/core/src/ports/media.ts`, and `VisibilityPort` in `packages/core/src/ports/visibility.ts`. One file per port rather than one shared module, so the complete list of things the kernel cannot do itself is visible as structure (contracts/host-adapters.md)
- [X] T010 Wire the public surface in `packages/core/src/index.ts`, exporting the types above and nothing not yet implemented

**Checkpoint**: `pnpm build && pnpm typecheck` green with types but no behaviour.

---

## Phase 3: User Story 1 — A slide's appearance at any moment is computable (Priority: P1) 🎯 MVP

**Goal**: `resolve(slide, timeMs)` returns the complete visual state of a slide, purely, with no
browser and no clock.

**Independent Test**: Call it with corpus fixtures across a range of times and assert the
returned state. Needs no transport, no clock, and no other story.

### Tests for User Story 1 ⚠️

> **Write these FIRST. Every one must fail before its implementation task begins.**

- [X] T011 [P] [US1] Rule test BR-002 (element start ≥ 0 honoured as a visibility boundary) in `packages/core/test/rules/BR-002.test.ts`
- [X] T012 [P] [US1] Rule test BR-003 (element visible on `[startMs, endMs)`, absent at and after `endMs`) in `packages/core/test/rules/BR-003.test.ts`
- [X] T013 [P] [US1] Rule test BR-004 (a positive effect duration yields well-defined progress at every instant) in `packages/core/test/rules/BR-004.test.ts`
- [X] T014 [P] [US1] Rule test BR-010 (author-hidden elements are absent from the state while remaining in the definition) in `packages/core/test/rules/BR-010.test.ts`
- [X] T015 [P] [US1] Rule test BR-011 (locked elements resolve exactly as unlocked ones — locking is authoring state) in `packages/core/test/rules/BR-011.test.ts`
- [X] T016 [P] [US1] Visibility boundary and out-of-range tests in `packages/core/test/resolve/boundaries.test.ts` — 1999 vs 2000 ms, negative times, times past the slide duration (US1 #1, #5)
- [X] T017 [P] [US1] Effect progress test in `packages/core/test/resolve/progress.test.ts` — a 500 ms fade from 1000 ms is reported halfway at 1250 ms, and progress is eased rather than linear (US1 #2)
- [X] T018 [P] [US1] Determinism test in `packages/core/test/resolve/determinism.test.ts` — two resolutions of every corpus slide at every boundary are byte-identical (SC-003)
- [X] T019 [P] [US1] Paint order test in `packages/core/test/resolve/paint-order.test.ts` — `elements` arrives sorted by authored `zIndex` regardless of definition order, so no consumer needs to sort (FR-007)
- [X] T020 [P] [US1] Composition test in `packages/core/test/resolve/compose.test.ts` — permuting the evaluation order of overlapping effects produces an identical result, proving composition is associative and commutative (research R-02, US1 #8–9). **Additionally assert `ResolvedElement.activeEffects` arrives in a stable order — sorted by `(startMs, order)` — because commutative composition makes ordering unobservable in the visual output, so FR-010 has to be verified where it *is* observable. A future non-commutative effect would depend on exactly this**
- [X] T021 [P] [US1] Effect coverage test in `packages/core/test/resolve/effect-set.test.ts` — each of the eight MVP effects yields a non-empty contribution part-way through, and each declares whether it is motion (US1 #7, FR-012, SC-011)
- [X] T022 [P] [US1] Empty-effect and geometry test in `packages/core/test/resolve/geometry.test.ts` — an element with no effects resolves to its authored geometry at full opacity, and `transform` stays separate from `geometry` so the editor can show authored values (data-model.md)

- [X] T023 [P] [US1] Problem reporting test in `packages/core/test/resolve/problems.test.ts` — an effect extending past the slide's end, and a slide whose duration is shorter than its content's timing, both populate `RenderState.problems` with the offending element identified rather than being silently clipped (spec Edge Cases 1 and 5, data-model.md)

### Implementation for User Story 1

- [X] T024 [US1] Implement contribution composition in `packages/core/src/resolve/compose.ts` — opacities and scales multiply, translations and rotations sum, empty object is the identity
- [X] T025 [P] [US1] Implement `appear`, `fade`, and `disappear` in `packages/core/src/effects/builtin/opacity.ts`
- [X] T026 [P] [US1] Implement `slide` and `zoom` in `packages/core/src/effects/builtin/transform.ts`
- [X] T027 [P] [US1] Implement `pulse` in `packages/core/src/effects/builtin/pulse.ts`
- [X] T028 [P] [US1] Implement `highlight` and `dim` in `packages/core/src/effects/builtin/filter.ts`
- [X] T029 [US1] Implement easing functions in `packages/core/src/effects/easing.ts` and apply easing before an effect's `at` is called, so no effect implements its own
- [X] T030 [US1] Export `builtinEffects` from `packages/core/src/effects/builtin/index.ts` and register them as the effect registry's defaults
- [X] T031 [US1] Implement single-element resolution in `packages/core/src/resolve/element.ts` — visibility window, active effects, composed contribution, `available` flag
- [X] T032 [US1] Implement `resolve()` in `packages/core/src/resolve/index.ts` — fold over elements, sort into paint order, assemble `RenderState`
- [X] T033 [US1] Implement problem reporting in `packages/core/src/resolve/problems.ts` — effects extending past the slide duration and other non-fatal findings populate `problems`
- [X] T034 [US1] Enable the `@cuestack/core` coverage threshold in root `vitest.config.ts` at 90% line and branch, closing the deviation feature 001 documented and its config comment promised

**Checkpoint**: US1 complete. `resolve()` is usable and correct on its own; quickstart Scenarios
1, 3, and part of 6 pass.

---

## Phase 4: User Story 2 — A slide advances by the rule its author chose (Priority: P2)

**Goal**: The advance controller decides once per slide instance, under the author's chosen rule.

**Independent Test**: Drive it with a synthetic clock and synthetic completion signals; assert
exactly one decision under each mode and under every simultaneous combination.

### Tests for User Story 2 ⚠️

- [X] T035 [P] [US2] Rule test BR-005 (an incomplete required interaction overrides duration-based advancement) in `packages/core/test/rules/BR-005.test.ts`
- [X] T036 [P] [US2] Rule test BR-006 (media-end advancement requires the referenced element to be playable media on this slide) in `packages/core/test/rules/BR-006.test.ts`
- [X] T037 [P] [US2] Rule test BR-007 (a slide instance advances at most once) in `packages/core/test/rules/BR-007.test.ts`
- [X] T038 [P] [US2] Exhaustive combination sweep in `packages/core/test/advance/combinations.test.ts` — every subset of simultaneously-satisfied conditions yields exactly one decision (SC-005). Three conditions firing in one tick is not a case anyone writes by hand, which is why this is swept rather than sampled
- [X] T039 [P] [US2] Late-signal test in `packages/core/test/advance/late-signal.test.ts` — a completion arriving for an already-advanced instance is ignored (US2 #6, FR-022)
- [X] T040 [P] [US2] Replay test in `packages/core/test/advance/replay.test.ts` — a slide revisited after backward navigation can advance again, because the guard keys on instance rather than slide id (research R-05)
- [X] T041 [P] [US2] Media-pause test in `packages/core/test/advance/media.test.ts` — pausing controlling media postpones rather than cancels, and failed media reports blocked instead of waiting forever (US2 #3, FR-021)
- [X] T042 [P] [US2] Unsatisfiable-rule test in `packages/core/test/advance/unsatisfiable.test.ts` — a slide gated on a question that disappears before it can be answered reports blocked rather than stalling silently (US2 #7, SC-012)
- [X] T043 [P] [US2] Cause attribution test in `packages/core/test/advance/cause.test.ts` — every decision names which condition fired, so "why did this advance early" is answerable from a bug report

- [X] T044 [P] [US2] Test-override isolation test in `packages/core/test/advance/override.test.ts` — the progression override is reachable only through its explicit option, and a controller constructed for normal playback has no path to it (US2 #8, FR-024)

### Implementation for User Story 2

- [X] T045 [US2] Implement condition evaluation in `packages/core/src/advance/conditions.ts` — the four modes, each a pure predicate over slide, transport snapshot, and signals
- [X] T046 [US2] Implement the controller and its single-fire guard in `packages/core/src/advance/controller.ts`, keyed on instance identity
- [X] T047 [US2] Implement unsatisfiable-rule detection in `packages/core/src/advance/reachability.ts`, surfacing through `RenderState.blocked`
- [X] T048 [US2] Add the test-only progression override in `packages/core/src/advance/controller.ts`, reachable solely through an explicit option that normal playback never sets (FR-024, US2 #8)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Playback follows a clock the learner controls (Priority: P3)

**Goal**: A transport whose time reflects what the learner did, not how long the page was open.

**Independent Test**: Substitute a synthetic time source, issue transport operations, assert
reported time after each. No real waiting.

### Tests for User Story 3 ⚠️

- [X] T049 [P] [US3] Rule test BR-013 (lesson time stops advancing while the host document is hidden) in `packages/core/test/rules/BR-013.test.ts`
- [X] T050 [P] [US3] Pause and resume test in `packages/core/test/transport/pause.test.ts` — outside time passing while paused does not become lesson time (US3 #1)
- [X] T051 [P] [US3] Delta clamp test in `packages/core/test/transport/clamp.test.ts` — an hour-long jump in the time source barely moves lesson time, covering machine sleep, a blocked main thread, and a paused debugger identically (US3 #4, FR-017, research R-03)
- [X] T052 [P] [US3] Monotonicity test in `packages/core/test/transport/monotonic.test.ts` — lesson time never decreases over a long synthetic session including hidden periods and a simulated sleep (US3 #5, SC-010)
- [X] T053 [P] [US3] Seek and restart test in `packages/core/test/transport/seek.test.ts` — seeking lands where asked; restart returns to zero and the resulting state matches `resolve(slide, 0)` (US3 #3, #6)
- [X] T054 [P] [US3] Snapshot and subscription test in `packages/core/test/transport/subscribe.test.ts` — every operation returns the resulting snapshot synchronously, and a listener always observes a committed state
- [X] T055 [US3] **Parity sweep** in `packages/core/test/resolve/play-vs-seek.test.ts` — for every corpus slide and every millisecond boundary where something changes, stepping the transport forward to that time and seeking directly to it produce deep-equal states (SC-002). This is the mechanical proof of Constitution V, and it needs a transport, which is why it lives here rather than in US1

### Implementation for User Story 3

- [X] T056 [US3] Implement the clock in `packages/core/src/time/clock.ts` — injected time source, per-tick delta clamping at a 250 ms ceiling, accumulated lesson time
- [X] T057 [US3] Implement the transport in `packages/core/src/time/transport.ts` — state machine over idle/playing/paused/completed, plus play, pause, seek, restart, goToSlide
- [X] T058 [US3] Wire the visibility port to automatic pause/resume in `packages/core/src/time/transport.ts`, resuming from stored position rather than wall-clock position (FR-016)
- [X] T059 [US3] Implement snapshots and subscription in `packages/core/src/time/transport.ts`, emitting only after state is committed

**Checkpoint**: US1–US3 work. The parity guarantee is now proven, not asserted.

---

## Phase 6: User Story 4 — New content types need no kernel change (Priority: P4)

**Goal**: A registered element type or effect participates exactly as a built-in does, and the
resolver contains no knowledge of any specific type.

**Independent Test**: Register synthetic types and resolve a slide using them; separately, break
the rule and confirm the lint gate rejects it.

### Tests for User Story 4 ⚠️

- [ ] T060 [P] [US4] Synthetic element type test in `packages/core/test/registry/element.test.ts` — a registered type participates in timing and layering identically to a built-in, and the test is written so it would fail if the resolver had to know about the type (US4 #1, SC-007)
- [ ] T061 [P] [US4] Synthetic effect test in `packages/core/test/registry/effect.test.ts` — a registered effect composes with built-ins and its motion flag is reported
- [ ] T062 [P] [US4] Incomplete registration test in `packages/core/test/registry/contract.test.ts` — a plugin missing any of its five members is refused with the missing member named (US4 #2, FR-026)
- [ ] T063 [P] [US4] Unknown optional type test in `packages/core/test/registry/unknown-optional.test.ts` — the rest of the slide resolves and the element reports `available: false` (US4 #3, FR-027)
- [ ] T064 [P] [US4] Unknown required interaction test in `packages/core/test/registry/unknown-required.test.ts` — the state reports blocked, because silently skipping a question that gates progression strands the learner (US4 #4, FR-028)
- [ ] T065 [P] [US4] Plugin isolation test in `packages/core/test/registry/isolation.test.ts` — a plugin's resolve input contains only its own payload, geometry, slide time, and theme; no lesson, no siblings, no learner data (US4 #5, FR-029)
- [ ] T066 [P] [US4] Lint negative control in `tools/scripts/check-gates.test.ts` — adding `switch (element.type)` to a resolver file is rejected, naming the rule

- [ ] T067 [P] [US4] Plugin version compatibility test in `packages/core/test/registry/version.test.ts` — a plugin declaring an incompatible `RenderState` version is refused, with both the plugin's and the kernel's version named (contracts/plugin-contract.md "Versioning")

### Implementation for User Story 4

- [ ] T068 [US4] Implement the element registry in `packages/core/src/elements/registry.ts` — typed map, completeness check at registration, missing-member message
- [ ] T069 [US4] Implement the effect registry in `packages/core/src/effects/registry.ts` with the same completeness discipline
- [ ] T070 [US4] Implement unknown-type handling in `packages/core/src/resolve/element.ts` — placeholder for optional types, blocking problem for required interaction types
- [ ] T071 [US4] Implement the plugin version compatibility check in `packages/core/src/elements/registry.ts`, refusing a plugin built against an incompatible `RenderState` shape with both versions named

**Checkpoint**: US1–US4 work. Extensibility is proven rather than intended.

---

## Phase 7: User Story 5 — A host can persist lessons through its own API (Priority: P5)

**Goal**: Six adapter interfaces and a working in-memory implementation of every one.

**Independent Test**: Exercise load, save, conflict, and event paths against the in-memory
reference.

### Tests for User Story 5 ⚠️

- [ ] T072 [P] [US5] Storage round-trip test in `packages/core/test/adapters/storage.test.ts` — a saved lesson loads back equivalent (US5 #1)
- [ ] T073 [P] [US5] Conflict test in `packages/core/test/adapters/conflict.test.ts` — a save against a stale token is refused with the current token returned, and the stored manifest is unmodified (US5 #2, SC-008)
- [ ] T074 [P] [US5] Default-adapters test in `packages/core/test/adapters/defaults.test.ts` — the framework works with no host implementation configured (US5 #3, FR-032)
- [ ] T075 [P] [US5] Event shape test in `packages/core/test/adapters/analytics.test.ts` — an event carries lesson version, slide, interaction, attempt, and outcome, and the type has no field a learner identifier could occupy (US5 #4, FR-033)

### Implementation for User Story 5

- [X] T076 [US5] Define `StorageAdapter`, `AssetAdapter`, and `AnalyticsAdapter` in `packages/core/src/adapters/index.ts` — result types rather than exceptions, conflict case in the signature (contracts/host-adapters.md)
- [X] T077 [US5] Implement the in-memory reference in `packages/core/src/adapters/memory/index.ts` with incrementing integer tokens that genuinely reject stale saves
- [X] T078 [US5] Export `memoryAdapters` from `packages/core/src/index.ts` as product rather than test scaffolding

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T079 Performance test in `packages/core/test/resolve/perf.test.ts` — a 300-element slide resolves under 10 ms on the reference runner, and cost grows roughly linearly with element count (SC-001)
- [ ] T080 Arm the perf gate for resolution in `tools/scripts/gates/perf.mjs`, replacing the Wave 3 placeholder note with a real check and leaving the playback-frame budgets still deferred
- [ ] T081 [P] Timing-suite duration assertion in `packages/core/test/harness/duration.test.ts` — the full timing suite completes in under 5 seconds, which only holds while nothing waits in real time (SC-006)
- [ ] T082 [P] Write `packages/core/README.md` covering `resolve`, the transport, the registries, and the ports a host must supply
- [ ] T083 [P] Add a Changesets entry at `.changeset/headless-kernel.md` for the `@cuestack/core` minor release
- [ ] T084 Run every scenario in `specs/002-headless-kernel/quickstart.md` by hand and correct any step that does not work as written
- [ ] T085 Flip EN-1 through EN-6 and QA-1 to ✅ in `docs/cuestack_framework_plan.md` and confirm the Wave 2 critical path still holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends only on Phase 2. The controller's contract is
  `evaluate(slide, transport, signals)` — it takes injected signals, not a `RenderState`, so it
  never calls the resolver. T047 surfaces through `RenderState.blocked`, which couples to the
  *type* (foundational), not to `resolve()`
- **US3 (Phase 5)**: depends on US1 for T055's parity sweep; the clock and transport themselves
  depend only on Phase 2 and can be built alongside US1
- **US4 (Phase 6)**: depends on US1 — extensibility is demonstrated *through* the resolver
- **US5 (Phase 7)**: depends only on Phase 2. Independent of the resolver entirely
- **Polish (Phase 8)**: depends on US1 (T079, T080) and on all stories (T084, T085)

### Within Each User Story

- Tests before the implementation that satisfies them, observed failing first
- Types before behaviour; composition before the effects that produce contributions; element
  resolution before slide resolution
- Story complete before moving to the next priority

### Single-owner files

| File | Owner | Note |
|---|---|---|
| root `vitest.config.ts` — `core` threshold | T034 | The commented-out line from feature 001's own T053 |
| `packages/core/src/time/transport.ts` | T057 creates, T058 and T059 extend | Sequential, not parallel |
| `packages/core/src/effects/registry.ts` | T007 skeleton, T030 defaults, T069 behaviour | Sequential |
| `packages/core/src/elements/registry.ts` | T008 skeleton, T068 behaviour, T071 versioning | Sequential |
| `packages/core/src/resolve/element.ts` | T031 creates, T070 extends | Sequential |
| `tools/eslint-config/index.js` | T002 extends what feature 001 created | |
| `tools/scripts/check-gates.test.ts` | T066 extends what feature 001 created | |

### Parallel Opportunities

- T002–T004 in Setup; T006–T009 in Foundational
- T011–T022 — the entire US1 test suite, twelve independent files
- T025–T028 — the four built-in effect modules
- T035–T043 in US2; T049–T054 in US3; T060–T066 in US4; T072–T075 in US5
- **US2 and US5 are both genuine independent tracks.** US2's controller takes injected signals
  rather than resolved state, so it needs nothing from US1; US5 touches only `src/adapters/`
  and `test/adapters/`. Either can be built alongside the resolver by a second contributor.
- The clock and transport implementation (T056–T059) can also proceed alongside US1, since only
  T055's sweep needs the resolver

---

## Parallel Example: User Story 1

```bash
# Twelve independent US1 test files — write them together:
Task: "Rule test BR-002 in packages/core/test/rules/BR-002.test.ts"
Task: "Rule test BR-003 in packages/core/test/rules/BR-003.test.ts"
Task: "Rule test BR-004 in packages/core/test/rules/BR-004.test.ts"
Task: "Rule test BR-010 in packages/core/test/rules/BR-010.test.ts"
Task: "Rule test BR-011 in packages/core/test/rules/BR-011.test.ts"
Task: "Boundary tests in packages/core/test/resolve/boundaries.test.ts"
Task: "Progress test in packages/core/test/resolve/progress.test.ts"
Task: "Determinism test in packages/core/test/resolve/determinism.test.ts"
Task: "Paint order test in packages/core/test/resolve/paint-order.test.ts"
Task: "Composition test in packages/core/test/resolve/compose.test.ts"
Task: "Effect coverage test in packages/core/test/resolve/effect-set.test.ts"
Task: "Geometry test in packages/core/test/resolve/geometry.test.ts"

# Then the four effect modules, also independent:
Task: "appear/fade/disappear in packages/core/src/effects/builtin/opacity.ts"
Task: "slide/zoom in packages/core/src/effects/builtin/transform.ts"
Task: "pulse in packages/core/src/effects/builtin/pulse.ts"
Task: "highlight/dim in packages/core/src/effects/builtin/filter.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — blocks everything
3. Phase 3: US1
4. **STOP and VALIDATE**: quickstart Scenarios 1 and 3

At this checkpoint `resolve()` works and is covered. It is genuinely useful on its own: Wave 2's
server-rendered first frame needs only `resolve(slide, 0)`, so the SSR milestone is unblocked by
US1 alone, before any clock exists.

### Incremental Delivery

1. Setup + Foundational → types exist
2. US1 → resolution works (**MVP**, and enough to unblock Wave 2's first frame)
3. US2 → lessons progress correctly
4. US3 → playback is controllable, **and the parity guarantee becomes proven**
5. US4 → extensibility demonstrated
6. US5 → hosts can persist

### Parallel Team Strategy

Four tracks after Phase 2, meeting only at T055:

- **A**: US1, then US4 — the resolver and its extensibility
- **B**: T056–T059, the clock and transport, needing nothing from A until the parity sweep
- **C**: US2, the advance controller — its signals are injected, so it needs no resolver
- **D**: US5, the adapter boundary, needing nothing from any of them

---

## Notes

- Constitution II is non-negotiable: a test never observed failing has proven nothing
- Nine of eighteen business rules gain rule-named tests here: BR-002, 003, 004, 005, 006, 007,
  010, 011, 013. The nine absent ones are listed in plan.md Complexity Tracking with the wave
  that supplies them — including BR-001, which is a storage rule already covered by feature
  001's schema tests. An empty rule file would make the traceability grep report compliance it
  has not verified, which is why the absent ones stay absent
- T034 closes feature 001's documented coverage deviation; it is not optional
- Commit after each task or logical group
