---

description: "Task list for React SSR Player (Wave 2)"
---

# Tasks: React SSR Player

**Input**: Design documents from `/specs/003-react-ssr-player/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included and are mandatory. Constitution Principle II is
NON-NEGOTIABLE, and Principle III becomes fully applicable in this feature — WCAG 2.2 AA is a
merge gate from here on. Tests are written first and must be observed failing.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: US1–US5 from spec.md
- Exact file paths are included in every task

## Path Conventions

`packages/react/src/{player,frame,elements,theme,styles}/`,
`packages/react/test/{ssr,hydration,scaling,elements,a11y,embed,harness}/`, `examples/nextjs/`.

## Three sequencing notes

**The stylesheet is foundational, its behaviour is US3.** `styles/stage.css` *is* the scaling
mechanism, and nothing renders positioned without it — so it lands in Phase 2. US3's phase holds
the proof that scaling behaves correctly across viewport widths. Same split features 001 and 002
used for the workspace and the registries.

**US1 needs two renderers, not seven.** The reference lesson's first slide contains text and a
shape, so those two ship with US1 to make the server-rendered frame real. US4 adds the remaining
five and imposes the accessibility obligations across all seven.

**The gates armed here have been waiting since feature 001.** The accessibility and
hard-coded-theme-value gates have been passing placeholders for two features. This is the wave
whose subject matter they check, so arming them is Setup work, not Polish — a gate that arrives
after the code it guards has nothing to prevent.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The test environment, and the two gates this feature finally gives teeth.

- [X] T001 Add test-environment dependencies to `packages/react/package.json` and the root `package.json`: happy-dom 20.11.x, `@testing-library/react` 16.3.x, axe-core 4.13.x; declare `react` and `react-dom` 19.2.x as **peer** dependencies of `@cuestack/react` and `@cuestack/core` as a workspace dependency
- [X] T002 Add a `@cuestack/react` project to root `vitest.config.ts` with `environment: 'happy-dom'`, leaving the existing node-environment projects unchanged
- [X] T003 [P] Create the render harness at `packages/react/test/harness/render.tsx` — server render via `react-dom/server`, hydration via `hydrateRoot`, and a console guard that promotes a React mismatch warning to a test failure (research R-07)
- [X] T004 [P] Create the slide corpus for rendering at `packages/react/test/harness/corpus.ts`, reusing the reference manifest and adding slides that cover every element type, an off-canvas element, and a missing theme token
- [X] T005 [P] Extend the `no-switch-on-element-type` rule in `tools/eslint-config/index.js` to cover `packages/react/src`, so a renderer cannot dispatch on element type outside its registry
- [X] T006 Arm the theme-literal gate: replace `tools/scripts/gates/theme-values.mjs`'s placeholder with a real check forbidding colour, font-size, and spacing literals in `packages/react/src/elements/**`, and add the matching ESLint rule to `tools/eslint-config/index.js`
- [X] T007 Arm the accessibility gate: replace `tools/scripts/gates/a11y.mjs`'s placeholder with a runner that executes the axe suite, and note in the file that automated checking covers roughly half of real defects (research R-05)
- [X] T008 Add `tools/scripts/check-rule-coverage.mjs` — derive the count of business rules with rule-named tests from `packages/*/test/rules/` and compare it against a declared scope, replacing the hand-maintained tally that four analysis passes found wrong (plan.md Complexity Tracking row 2)

**Checkpoint**: `pnpm test` green with the new project registered and no tests in it yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The stage, the property mapping, and the registry every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Define the visual property names and `ElementVisual` mapping types in `packages/react/src/frame/properties.ts` per data-model.md — one place naming every `--cs-*` property, so the stylesheet and the writer cannot disagree
- [X] T010 Write `packages/react/src/styles/stage.css` — `container-type: size`, `aspect-ratio` from the canvas custom properties, and element positioning in container query units with a fallback on every consumed property (contracts/stage-css-contract.md)
- [X] T011 [P] Write `packages/react/src/styles/reset.css`, scoped entirely beneath `.cs-stage`, containing no element selectors, no `*`, and no `:root` rules (FR-026)
- [X] T012 [P] Implement theme-token mapping in `packages/react/src/theme/tokens.ts` — lesson theme plus host override to `--cs-theme-*` properties, each consumed with a readable fallback (FR-019)
- [X] T013 Implement `packages/react/src/player/Stage.tsx` — establishes the container, sets the canvas and theme properties, clips overflow
- [X] T014 Implement the element wrapper in `packages/react/src/player/ElementFrame.tsx` — applies geometry, opacity, and transform as custom properties so renderers never position themselves (contracts/element-renderer-contract.md)
- [X] T015 Implement the renderer registry in `packages/react/src/elements/registry.tsx`, mirroring the kernel's complete-contract-or-refuse discipline
- [X] T016 Declare both entries in `packages/react/package.json` — `react-server` and `default` conditions each with their own `types`, exporting the same names, plus a `./styles.css` export

**Checkpoint**: `pnpm build && pnpm typecheck` green; the stage renders an empty container.

---

## Phase 3: User Story 1 — A learner sees the lesson before any JavaScript runs (Priority: P1) 🎯 MVP

**Goal**: The first slide is in the server's markup, positioned as authored, at time zero.

**Independent Test**: Render to a string with no DOM present and assert the slide's content and
geometry are in the output. Needs no browser, no hydration, and no other story.

### Tests for User Story 1 ⚠️

> **Write these FIRST. Every one must fail before its implementation task begins.**

- [X] T017 [P] [US1] Server-render content test in `packages/react/test/ssr/content.test.ts` — every element visible at time zero appears in the markup, with its text as ordinary text (US1 #1, #4, SC-001)
- [X] T018 [P] [US1] Server-render geometry test in `packages/react/test/ssr/geometry.test.ts` — each element carries its authored position as custom properties rather than being stacked at the origin (US1 #2)
- [X] T019 [P] [US1] Time-zero test in `packages/react/test/ssr/time-zero.test.ts` — an element entering at 500 ms is **absent** from the server render, not pre-emptively visible (US1 #3, FR-002)
- [X] T020 [P] [US1] No-DOM test in `packages/react/test/ssr/no-dom.test.ts` — the server entry renders in an environment with no `document`, asserted by deleting the global before rendering
- [X] T021 [P] [US1] Browser-globals source test in `packages/react/test/ssr/no-browser-globals.test.ts` — no reference to `window`, `document`, `matchMedia`, `getBoundingClientRect`, `ResizeObserver`, or a clock appears in the server render path (US1 #6, SC-013, FR-004)
- [X] T022 [P] [US1] Unknown-type degradation test in `packages/react/test/ssr/unknown-type.test.ts` — an unregistered optional type leaves the rest of the slide rendered, and its placeholder reserves space (US1 #5, FR-027 of feature 002)

### Implementation for User Story 1

- [X] T023 [P] [US1] Implement the text renderer in `packages/react/src/elements/builtin/TextElement.tsx`, resolving all typography from theme properties
- [X] T024 [P] [US1] Implement the shape renderer in `packages/react/src/elements/builtin/ShapeElement.tsx` as inline SVG marked `aria-hidden` — a rectangle has nothing to announce
- [X] T025 [US1] Implement `packages/react/src/player/SlideView.tsx` — map a `RenderState` to wrapped renderers in the order the kernel supplied, without re-sorting
- [X] T026 [US1] Implement the unknown-type placeholder in `packages/react/src/elements/Placeholder.tsx` — reserves the element's space and announces itself unavailable
- [X] T027 [US1] Implement `packages/react/src/player/LessonPlayer.tsx`'s render path — resolve at time zero and render the stage; no clock, no effects, no subscriptions
- [X] T028 [US1] Implement the server entry `packages/react/src/server.ts`, exporting the same names as the client entry (feature 001 taught that divergent surfaces break the type layer)

**Checkpoint**: US1 complete. Quickstart Scenarios 1 (with scripts disabled), 2, and 3 pass. **The
first visible output in the project's history.**

---

## Phase 4: User Story 2 — Playback takes over without a flicker (Priority: P2)

**Goal**: Hydration is byte-identical, then the lesson plays.

**Independent Test**: Server-render, hydrate, assert markup equality and zero warnings; then
drive the transport and assert elements appear at their authored times.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Hydration equality test in `packages/react/test/hydration/equality.test.ts` — markup before and after hydration is byte-identical for every corpus slide (US2 #1, SC-003)
- [X] T030 [P] [US2] Mismatch-warning test in `packages/react/test/hydration/warnings.test.ts` — zero React mismatch warnings, with the console guard failing the test rather than letting them scroll past (US2 #2, SC-002)
- [X] T031 [P] [US2] Playback test in `packages/react/test/hydration/playback.test.ts` — after hydration, elements appear and disappear at their authored times as the synthetic clock advances (US2 #3)
- [X] T032 [P] [US2] Pause and seek test in `packages/react/test/hydration/transport.test.ts` — pausing holds the visible state; seeking shows that moment with no effect appearing to replay (US2 #4, #5, FR-021/022)
- [X] T033 [P] [US2] Rendered-parity test in `packages/react/test/hydration/rendered-parity.test.ts` — for every corpus slide and boundary, the rendered output of seeking equals that of playing (SC-011). Feature 002 proved this for computed state; this proves it with the renderer in the path
- [X] T034 [P] [US2] No-reconciliation-per-frame test in `packages/react/test/hydration/frame-cost.test.ts` — advancing the clock across many frames triggers React renders only when an element's visibility changes, not on every frame (plan.md Complexity Tracking row 1)

### Implementation for User Story 2

- [X] T035 [US2] Implement `packages/react/src/frame/applyVisual.ts` — map one `ResolvedElement` to its custom properties, the single conversion between the kernel's output and the page
- [X] T036 [US2] Implement `packages/react/src/frame/FrameWriter.ts` — ref registration and property writes, the only imperative DOM mutation in the package
- [X] T037 [US2] Implement `packages/react/src/frame/useFrameLoop.ts` — an animation-frame loop driving the writer, cancelled on unmount
- [X] T038 [US2] Wire the transport into `packages/react/src/player/LessonPlayer.tsx`, starting the clock in an effect after mount so the first client render cannot differ from the server's (research R-03)
- [X] T039 [US2] Implement `packages/react/src/player/usePlayer.ts`, exposing the kernel's transport unwrapped and throwing outside a player subtree
- [X] T040 [US2] Implement the client entry `packages/react/src/index.ts` with the full surface
- [X] T041 [US2] Set `will-change` in `packages/react/src/player/ElementFrame.tsx` from `activeEffects` being non-empty, reading the kernel's output rather than tracking animation state (research R-06)

**Checkpoint**: US1 and US2 both work. A lesson server-renders, hydrates, and plays.

---

## Phase 5: User Story 3 — The lesson fits the screen without shifting (Priority: P3)

**Goal**: Authored proportions at any container size, with no measurement and no shift.

**Independent Test**: Render at several container widths and assert the emitted declarations
preserve the aspect ratio and relative distances — assertions about CSS, not measured pixels.

### Tests for User Story 3 ⚠️

- [X] T042 [P] [US3] Aspect-ratio test in `packages/react/test/scaling/aspect-ratio.test.ts` — the authored ratio is preserved for 16:9, 4:3, and 9:16 at container widths from 320 to 2560 px (US3 #1, #5, SC-005)
- [X] T043 [P] [US3] Relative-geometry test in `packages/react/test/scaling/relative.test.ts` — two elements 100 logical units apart emit declarations keeping them proportionally that far apart at every width (US3 #3, FR-010)
- [X] T044 [P] [US3] No-measurement test in `packages/react/test/scaling/no-measurement.test.ts` — no `getBoundingClientRect`, `offsetWidth`, or `ResizeObserver` appears anywhere in `packages/react/src` (FR-009, SC-004)
- [X] T045 [P] [US3] Clipping test in `packages/react/test/scaling/clipping.test.ts` — an element positioned outside the canvas is clipped to the stage and does not create horizontal page overflow (US3 #4, FR-011/012)
- [X] T046 [P] [US3] Empty-slide test in `packages/react/test/scaling/empty-slide.test.ts` — a slide with no visible elements renders a stage at the authored proportions rather than collapsing (spec Edge Cases)

### Implementation for User Story 3

- [X] T047 [US3] Finalise the container-query positioning in `packages/react/src/styles/stage.css` so every axis, size, and font dimension scales from the container
- [X] T048 [US3] Implement aspect-ratio handling in `packages/react/src/player/Stage.tsx` — map the lesson's ratio to canvas dimensions, supporting 16:9, 4:3, and 9:16
- [X] T049 [US3] Add overflow clipping and the minimum-legibility floor to `packages/react/src/styles/stage.css` (US3 #4)

**Checkpoint**: US1–US3 work. The lesson renders, plays, and fits any screen.

---

## Phase 6: User Story 4 — Every kind of content on a slide appears (Priority: P4)

**Goal**: All seven element types render, accessibly, from theme values only.

**Independent Test**: Render a slide with every element type and assert each produces output,
carries its accessibility obligations, and contains no style literal.

### Tests for User Story 4 ⚠️

- [X] T050 [P] [US4] All-types test in `packages/react/test/elements/all-types.test.ts` — all seven types produce output with authored geometry and layer order, written so a renderer producing nothing fails (US4 #1, SC-007)
- [X] T051 [P] [US4] Image test in `packages/react/test/elements/image.test.ts` — alternative text is exposed, intrinsic dimensions are declared before load, and a failed load leaves reserved space and a description (US4 #3, FR-015/018)
- [X] T052 [P] [US4] Media test in `packages/react/test/elements/media.test.ts` — video exposes its caption track and audio its transcript when authored (US4 #4, FR-016)
- [X] T053 [P] [US4] Keyboard test in `packages/react/test/elements/keyboard.test.ts` — every interactive element is reachable by keyboard and carries an accessible name, role, and state (US4 #5, FR-017, SC-009)
- [X] T054 [P] [US4] Inert-question test in `packages/react/test/elements/question.test.ts` — a question renders as a labelled group, is announced, and is marked `aria-disabled` rather than silently unresponsive
- [X] T055 [P] [US4] Theme-only test in `packages/react/test/elements/theme.test.ts` — every renderer's appearance derives from theme properties, and a missing token falls back readably rather than invisibly (US4 #2, #6, FR-014/019, SC-008)
- [X] T056 [P] [US4] Accessibility sweep in `packages/react/test/a11y/axe.test.ts` — axe reports no WCAG 2.2 AA violations on any corpus slide (SC-010)
- [X] T057 [P] [US4] Large-font test in `packages/react/test/elements/large-font.test.ts` — text remains contained rather than overflowing its element at a large root font size (spec Edge Cases)

- [X] T058 [P] [US4] Theme-gate negative control in `tools/scripts/check-gates.test.ts` — adding `color: '#333'` to an element renderer is rejected, naming the theme rule. A gate that has never been observed failing is not known to be a gate, and feature 001 found a boundary rule that was green while enforcing nothing
- [X] T059 [P] [US4] Accessibility-gate negative control in `tools/scripts/check-gates.test.ts` — a corpus slide with an image missing its alternative text is rejected by the axe gate, proving the gate armed in T007 actually fires rather than merely running

### Implementation for User Story 4

- [X] T060 [P] [US4] Implement the image renderer in `packages/react/src/elements/builtin/ImageElement.tsx`
- [X] T061 [P] [US4] Implement the video renderer in `packages/react/src/elements/builtin/VideoElement.tsx` with native controls and caption track
- [X] T062 [P] [US4] Implement the audio renderer in `packages/react/src/elements/builtin/AudioElement.tsx` with native controls and transcript link
- [X] T063 [P] [US4] Implement the button renderer in `packages/react/src/elements/builtin/ButtonElement.tsx` as a real `<button>`
- [X] T064 [US4] Implement the question renderer in `packages/react/src/elements/builtin/QuestionElement.tsx` — prompt and options as a labelled radio group, `aria-disabled` until Wave 3
- [X] T065 [US4] Export `builtinRenderers` from `packages/react/src/elements/builtin/index.ts` and register them as the registry's defaults
- [X] T066 [US4] Implement the asset-failure state in `packages/react/src/elements/AssetFallback.tsx`, preserving reserved space and an accessible description

**Checkpoint**: US1–US4 work. A complete lesson renders accessibly.

---

## Phase 7: User Story 5 — A host embeds the player in its own application (Priority: P5)

**Goal**: The published package works in someone else's app.

**Independent Test**: Consume the built package from a minimal host and render a lesson.

### Tests for User Story 5 ⚠️

- [X] T067 [P] [US5] Minimal-host test in `packages/react/test/embed/minimal-host.test.tsx` — a lesson renders from props alone with no further configuration (US5 #1, SC-012)
- [X] T068 [P] [US5] Style-scoping test in `packages/react/test/embed/scoping.test.ts` — the stylesheet contains no `:root`, no bare element selectors, and no `*`, so a host's own styles are untouched (US5 #4, FR-026)
- [X] T069 [P] [US5] Client-only test in `packages/react/test/embed/client-only.test.tsx` — the player works with no server rendering at all (US5 #3, FR-025)
- [X] T070 [US5] Peer-dependency check in `tools/scripts/check-packaging.mjs` — assert `@cuestack/react` declares React as a peer and does not bundle it (FR-026)

### Implementation for User Story 5

- [X] T071 [US5] Finalise the `exports` map in `packages/react/package.json` and verify with publint and attw, including the `./styles.css` entry
- [X] T072 [US5] Verify in `packages/react/package.json` that the `default` condition resolves independently of `react-server`, so a purely client-side host that never touches the server entry still installs and imports cleanly

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T073 Promote `examples/nextjs/app/page.tsx` from a resolution probe to a real player — server-render the reference lesson's first slide and hydrate into playback, **and assert the `react-server` condition resolved in the server component** (FR-024). The example app is the only real RSC boundary in the repository, so it is the only place this is observable; a malformed condition order does not throw, it silently resolves the client bundle into a server context and surfaces later as an untraceable hydration bug
- [X] T074 Add playback controls at `packages/react/src/player/controls/PlaybackControls.tsx` and `controls.css`, keyboard-operable with accessible names (FR-020)
- [ ] T075 First-slide timing test in `packages/react/test/ssr/timing.test.ts` — the first slide is renderable within 2 seconds of lesson data being available, excluding media download (SC-006, NFR-PERF-006)
- [ ] T076 [P] Write `packages/react/README.md` covering the player, the entry points, the stylesheet requirement, and the renderer contract
- [ ] T077 [P] Add a Changesets entry at `.changeset/react-ssr-player.md` for the `@cuestack/react` minor release
- [ ] T078 Widen the coverage floor in root `vitest.config.ts` to include `packages/react/src`, at the same 90% line and branch threshold
- [ ] T079 Add the newly armed gates to `.github/workflows/ci.yml` — the a11y and theme-value gates now check real subject matter, and `check-rule-coverage.mjs` joins the blocking set
- [ ] T080 Run every scenario in `specs/003-react-ssr-player/quickstart.md` by hand, **including opening the page with JavaScript disabled**, and correct any step that does not work as written
- [ ] T081 Flip NX-1, NX-2, NX-3, RC-1, RC-2, and QA-2 to ✅ in `docs/cuestack_framework_plan.md` and confirm the Wave 3 critical path still holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on US1 — hydration needs something to hydrate
- **US3 (Phase 5)**: depends on Phase 2 only. The stylesheet exists from T010; US3 proves its
  behaviour and can proceed alongside US1
- **US4 (Phase 6)**: depends on Phase 2 for the registry and wrapper; independent of US1–US3
  otherwise, since a renderer is testable in isolation
- **US5 (Phase 7)**: depends on US1 and US4 — there must be something worth embedding
- **Polish (Phase 8)**: T073 depends on US2; T078–T081 depend on all stories

### Within Each User Story

- Tests before the implementation that satisfies them, observed failing first
- Property names before the writer; the stage before the elements it contains; a renderer before
  its accessibility assertions can be meaningful
- Story complete before moving to the next priority

### Single-owner files

| File / block | Owner | Note |
|---|---|---|
| `packages/react/src/styles/stage.css` | T010 creates, T047 and T049 extend | Sequential, not parallel |
| `packages/react/src/player/LessonPlayer.tsx` | T027 creates, T038 extends | Sequential |
| `packages/react/src/player/Stage.tsx` | T013 creates, T048 extends | Sequential |
| `packages/react/src/player/ElementFrame.tsx` | T014 creates, T041 extends | Sequential |
| `packages/react/package.json` — exports | T016 declares, T071 finalises | Sequential |
| `tools/eslint-config/index.js` | T005 and T006 both extend | Sequential |
| `tools/scripts/check-packaging.mjs` | T070 extends what feature 001 created | |
| root `vitest.config.ts` — projects | T002 | |
| root `vitest.config.ts` — coverage scope | T078 | Distinct block from T002 |

### Parallel Opportunities

- T003–T005 in Setup; T011–T012 in Foundational
- T017–T022 — the six US1 test files
- T029–T034 — the six US2 test files
- T042–T046 in US3; T050–T059 in US4; T067–T069 in US5
- T023–T024, and T060–T063 — the independent element renderers
- **US3 and US4 are genuine parallel tracks.** US3 touches only the stylesheet and the stage;
  US4 touches only element renderers. Neither needs the other, and neither needs US2.

---

## Parallel Example: User Story 1

```bash
# Six independent US1 test files — write them together:
Task: "Server-render content test in packages/react/test/ssr/content.test.ts"
Task: "Server-render geometry test in packages/react/test/ssr/geometry.test.ts"
Task: "Time-zero test in packages/react/test/ssr/time-zero.test.ts"
Task: "No-DOM test in packages/react/test/ssr/no-dom.test.ts"
Task: "Browser-globals source test in packages/react/test/ssr/no-browser-globals.test.ts"
Task: "Unknown-type degradation test in packages/react/test/ssr/unknown-type.test.ts"

# Then the two US1 renderers, independent of each other:
Task: "Text renderer in packages/react/src/elements/builtin/TextElement.tsx"
Task: "Shape renderer in packages/react/src/elements/builtin/ShapeElement.tsx"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — blocks everything
3. Phase 3: US1
4. **STOP and VALIDATE**: open the example page and disable JavaScript

At this checkpoint there is a lesson slide on a screen that survives having its scripts turned
off. That is the wave's headline claim, and it is demonstrable before hydration, scaling, or the
remaining five element types exist. It is also the first artefact in this project worth showing
anyone.

### Incremental Delivery

1. Setup + Foundational → the stage exists
2. US1 → the first slide is in the markup (**MVP, and the first visible output**)
3. US2 → it hydrates and plays
4. US3 → it fits any screen without shifting
5. US4 → every kind of content appears, accessibly
6. US5 → someone else can embed it

### Parallel Team Strategy

Three tracks after Phase 2:

- **A**: US1, then US2 — the server render and the playback that follows it
- **B**: US3, the stylesheet's behaviour, needing nothing from A
- **C**: US4, the element renderers, each independently testable

They converge at US5, which packages what the others built.

---

## Notes

- Constitution II is non-negotiable: a test never observed failing has proven nothing
- Constitution III becomes a merge gate in this feature. T006 and T007 arm the two gates that
  have been passing placeholders since feature 001 — before the code they guard, not after
- T008 replaces the hand-maintained business-rule tally with a derived one. Four analysis passes
  found errors in that count, two of them introduced while correcting the previous one
- The frame loop is the only imperative DOM writer, confined to `frame/` so the complete set of
  style mutations is auditable in two files
- Commit after each task or logical group
