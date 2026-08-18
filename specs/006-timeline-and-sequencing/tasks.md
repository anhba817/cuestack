# Tasks: Timeline and Simple Sequence Mode

**Input**: Design documents from `/specs/006-timeline-and-sequencing/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required, and not by preference. Constitution II is NON-NEGOTIABLE and names "playback
timing" and "Simple Sequence to absolute-time conversion" among the things that MUST be developed
test-first. Every test task below precedes its implementation and must **fail first**.

**Organization**: By user story, so each is independently deliverable. The cut line the
specification recorded in advance is US4's effect half — see Implementation Strategy.

**Revised after seven `/speckit-analyze` passes**: 106 tasks, up from 99. Seven were added and one
moved. The changes are listed under Remediation applied at the end of this file.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1–US5, on user-story phases only

## Path conventions

- Editor source: `packages/studio/src/`
- Editor tests: `packages/studio/test/` — DOM project by default; **`*.pure.test.ts` runs in the
  `node` project**, which is how a pure module stays pure (`vitest.config.ts` includes
  `test/{geometry,draft}/**` and `test/**/*.pure.test.ts` there)
- Kernel and adapter: `packages/core/`, `packages/react/`
- Tooling: `tools/eslint-config/`, `tools/scripts/`

---

## Phase 1: Setup

**Purpose**: the bounds and the fixture, before anything can be measured against them.

- [X] T001 Create `packages/studio/src/timeline/constants.ts` with the eight named constants and their bounds from data-model.md §5 — `SNAP_THRESHOLD_MS`, `MIN_ELEMENT_DURATION_MS`, `MIN_EFFECT_DURATION_MS`, `NUDGE_MS`, `NUDGE_MS_COARSE`, `DEFAULT_EFFECT_DURATION_MS`, `MIN_PX_PER_SECOND`/`MAX_PX_PER_SECOND`, `MIN_BAR_PX`, each with a comment stating what its bounds mean, following `packages/studio/src/geometry/constants.ts`
- [X] T002 Add the `no-clock-in-studio` rule to `tools/eslint-config/index.js`: `no-restricted-globals` for `setTimeout`, `setInterval`, `requestAnimationFrame`, and `Date` — which covers `new Date()` too, since that is a reference to the global — plus `no-restricted-syntax` for `Date.now` and `performance.now`, scoped to `packages/studio/src/**` **with no `ignores` at all**. The rule is absolute because it can be: `requestAnimationFrame` lives in `useFrameLoop` and `performance.now` in `browserPorts`, both in `@cuestack/react` (T008 exports the second). An exemption for the playback module would be a hole punched at exactly the file most likely to grow a clock. **Do not add to the existing `no-restricted-properties` block** — flat config replaces a rule's configuration rather than merging it, so a second block with the same rule name would disarm the DOM-measurement ban (research R-01). Spread `NO_INNER_HTML` into the `no-restricted-syntax` array, as the file's own comment instructs
- [X] T003 Add two negative controls to `tools/scripts/check-gates.test.ts`: a `Date.now()` in a studio module is rejected naming `no-clock-in-studio`; and adding the rule did **not** disarm `dom-measurement-confined` — a `getBoundingClientRect` outside `canvas/pointer.ts` is still rejected. The second is the one that matters: feature 005's innerHTML ban silently disarmed two narrower rules and only a self-test found it
- [X] T004 [P] Add a dense single slide to `tools/scripts/fixtures/heavy-lesson.mjs` — **the last slide**, which the file already treats specially ("the remainder rides on the last slide"), carrying a large share of the elements, so SC-012 has something to stress. Measured today: 50 slides, 300 elements, **6 per slide**, 290 effects; a timeline benchmarked against six tracks measures nothing (research R-09). Keep one fixture, not two: the Constitution names *the* performance fixture and a second one is the copy that drifts. `ELEMENTS` stays 300 and the `emitted === ELEMENTS` assertion at the foot of the file must still hold
- [X] T005 Re-run `packages/react/test/perf/playback.test.ts` and `packages/studio/test/perf/editor.test.tsx` against the redistributed fixture and record any movement in quickstart.md §13, beside the budgets it belongs to — not here. A task list tracks work; a measurement needs a reader after the feature ships. Both measure **per-slide** work, and T004 changes the per-slide distribution they were baselined against. Constitution IV reverts a change that regresses a budget — so a budget that moves for a reason unrelated to this feature must be identified as such before it is read as a regression. Depends on T004; not parallel with it
- [X] T006 [P] Create `packages/studio/test/harness/timeline.ts` — slide builders for the shapes the suites need: elements at staggered times, an element with `hidden: true`, an element whose window excludes time 0, an element starting at 0 and ending exactly at the slide's duration, an element with a one-millisecond window, two overlapping effects on one element, an element ending past the slide's duration, a slide with zero elements, and **a slide whose `durationMs` is 0** — legal, because `Slide.durationMs` is `msInt` and not `msDuration` (`lesson.ts:32`), and reachable for any slide that advances `on_click`. Use the `fx-` id prefix, as `test/harness/corpus.ts` does, so fixture ids never collide with `countingIds()`
- [X] T007 [P] Add `BR-016` and `BR-017` to `EXPECTED` in `tools/scripts/check-rule-coverage.mjs` mapped to `studio`, and remove them from the "no code to test yet" comment. Note the filename constraint the gate imposes: it matches `^BR-\d+\.test\.tsx?$`, so these tests **cannot** be `*.pure.test.ts` and will run in the DOM project

**Checkpoint**: the clock rule can fail, the fixture can stress a timeline, and the rule-coverage gate expects two more rules than exist. T007 leaves `pnpm check:rules` red until T099 and T100 — that is the gate doing its job.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the ports the editor needs, the one core change, and the closed edit union every story writes through.

**⚠️ No user story work can begin until this phase is complete.**

- [X] T008 Export `browserPorts` and the `Ports` type from `packages/react/src/index.ts`, in the client-only playback block beside `useFrameLoop` and under the comment that already explains why the server entry omits these. **This is the task that keeps the whole feature's central decision honest.** `browserPorts` exists at `packages/react/src/player/browserPorts.ts` and is not exported; without it the editor cannot construct a transport and would have to write `time: () => performance.now()` itself — a clock in the studio package, which T002 forbids and which is precisely the second clock this feature is designed against. Add an export assertion to `packages/react/test/` so the omission cannot recur
- [X] T009 Write `packages/core/test/effects/parameters.test.ts` **first**: `EffectDescriptor` accepts a `parameters` array of `InspectorField`; a descriptor without one still registers; and `registry.get(type).parameters` is what a consumer reads. Must fail
- [X] T010 Write the sweep half of `packages/core/test/effects/parameters.test.ts`: for every descriptor in `builtinEffects`, each declared parameter key is one its `at()` actually reads, and `slide` declares both `from` and `distance`. This is the assertion that would have caught a guessed parameter table
- [X] T011 Add `parameters?: readonly InspectorField[]` to `EffectDescriptor` in `packages/core/src/effects/registry.ts`, importing `InspectorField` from `../elements/contract.js`. Document the one difference that matters: on an element a `key` is a **dotted path**, on an effect it is a **flat key into `effect.parameters`**. Additive metadata, serialized into no manifest and read on no playback path — no `schemaVersion` implication (FR-045)
- [X] T012 [P] Declare `parameters` on `slide` and `zoom` in `packages/core/src/effects/builtin/transform.ts`: `slide` takes `from` (select of `top`/`bottom`/`left`/`right`) and `distance` (number); `zoom` takes `from` as a **number** — the scale it starts at. One key, two types, in two effects a teacher picks between in the same menu (research R-04). Leave the inlined defaults in `at()` alone: it runs on a server per frame and must work when `parameters` is absent
- [X] T013 [P] Declare `amount` on `highlight` and `dim` in `packages/core/src/effects/builtin/filter.ts` (defaults `0.4` and `0.5`, which differ — do not unify them)
- [X] T014 [P] Declare `amount` on `pulse` in `packages/core/src/effects/builtin/pulse.ts` (default `0.08`)
- [X] T015 Extend `packages/studio/test/draft/read-only.test.ts` to enumerate the six new kinds — `set-timing`, `add-effect`, `set-effect`, `remove-effect`, `apply-sequence`, `extend-slide` — and assert read-only refuses each with a reason. Must fail before T016
- [X] T016 Add the six kinds to `EDIT_KINDS` and the `Edit` union in `packages/studio/src/draft/edit.ts`, with the shapes in data-model.md §4 — note `set-timing` takes a **single `id`**, not an array, because multi-select timing edits are out of scope. The union is closed on purpose: the read-only suite enumerates it, so a variant added later is refused-by-default and fails a test until someone says so deliberately (feature 005 SC-017)

**Checkpoint**: the ports are reachable, the registry declares parameters, the union is closed and enumerated, and the reducer refuses six kinds it has not yet implemented. Stories can now proceed in parallel. The validity sweep over the new kinds is **T096**, in Polish, because its subject is not complete until US5 lands — a Foundational task left red for six phases is not a foundation.

---

## Phase 3: User Story 1 — A teacher sees when everything on the slide happens (Priority: P1) 🎯 MVP

**Goal**: time becomes visible. Tracks, a ruler, a playhead, real playback, and exactly one authoring time.

**Independent Test**: open a slide whose elements appear at different moments; confirm each has a track positioned and sized to its timing; move the playhead and confirm the canvas shows the state a learner would see. Requires no dragging and no sequencing.

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T017 [P] [US1] Write `packages/studio/test/timeline/tracks.pure.test.ts`: one track per element in paint order; a `hidden` element has a track; an element whose window excludes the current moment has a track; a locked element has a track marked locked; a slide of zero elements yields zero tracks and does not throw (FR-001, FR-002, FR-003)
- [X] T018 [P] [US1] Write the negative half of `packages/studio/test/timeline/tracks.pure.test.ts`: `buildTracks` never calls `resolve`, asserted by building tracks from a slide whose every element is outside the window and getting a full set back. `RenderState.elements` is visible elements only (BR-010) — a timeline built from it loses a track exactly when the teacher needs it (research R-03)
- [X] T019 [P] [US1] Write `packages/studio/test/timeline/scale.pure.test.ts`: `toMs(toPx(ms)) === ms` for every millisecond across a slide's duration; `clampPxPerSecond` bounds to `[MIN_PX_PER_SECOND, MAX_PX_PER_SECOND]`; a scale change leaves the authoring time byte-identical (FR-007). And the degenerate case: a slide of `durationMs: 0` yields a ruler of zero width without dividing by zero or looping forever, and the round-trip property over "every millisecond in the slide" is vacuously true rather than silently skipped
- [X] T020 [US1] Extend `packages/studio/test/harness/editor.tsx` so a test can mount playback and the timeline: optional `timeline` and `playback` flags that render `<Timeline>` and call `usePlayback` **inside the tree**, thread the writer and the frame state into `EditorCanvas`, and expose the playback handle and the writer on the holder beside `session`. **Fifteen DOM tests in this feature need this and none of them creates it** — T021–T025, T042, T043, T055–T057, T072, T073, T083, T084, and T090–T092. T006's `harness/timeline.ts` is slide *fixtures*, a different thing. Not parallel: it is the first task of this phase and blocks the rest of the block. It will not compile until T028–T035 land, which is what "must fail first" means here — but the harness must be authored against the components' intended shape rather than retrofitted to whatever they turn out to be. The existing file's header records the failure mode it exists to prevent: rendering the hook outside the tree passes one stale snapshot as a prop, and "nudging did nothing" was the confusing symptom
- [X] T021 [P] [US1] Write `packages/studio/test/playback/transport.test.tsx`: play advances the playhead, pause holds it, restart returns to zero, and seek during playback continues from the new moment. **Plus the assertion that no other test in this feature makes: play from before an element's `startMs` to past it with no seek at all, and assert the element mounts and the writer wrote to it.** Every other playback test here drives a seek — which *does* emit a snapshot and *does* re-render — and that is exactly the blind spot `useFrameLoop`'s own header records from Wave 2: "every test drove `seek()`, which does emit, so the one path a learner takes was the one path untested". **Driven by an injected `TimeSource`** — a test here containing `await sleep(...)` violates Constitution II and is a test to delete (FR-010, FR-011, SC-015)
- [X] T022 [P] [US1] Write `packages/studio/test/playback/visibility.test.tsx`: hiding the document pauses playback and returning resumes it, exactly as it already does for a learner (BR-013, FR-010)
- [X] T023 [P] [US1] Write `packages/studio/test/playback/reconcile.test.tsx`: after playback stops, `session.authoringTime === transport.slideTimeMs`. This is the bound on the declared divergence — while playing the session's copy is permitted to lag, and exactly one module may hold that (research R-02, FR-011) Two more assertions belong here, both about the seam rather than the value. **Idle costs zero writes**: with playback stopped, advancing the fake clock produces no calls to the writer at all — stated as a property of the writer rather than as "the loop is not mounted", because a cancelled `requestAnimationFrame` is not observable and asserting on rAF in happy-dom would be asserting against the environment. A **seek** while idle produces exactly one write, which is T028 *(d)*. And **every authoring-time change goes through `seek`** — calling `session.setAuthoringTime` directly during playback splits the canvas between two moments, which is precisely why no surface does it.
- [X] T024 [P] [US1] Write `packages/studio/test/timeline/render.test.tsx`: each element's bar starts and ends at its authored values; the ruler renders; clicking and dragging the ruler moves the playhead; moving the playhead changes what the canvas renders (FR-004, FR-005, SC-001, SC-002)
- [X] T025 [P] [US1] Write `packages/studio/test/timeline/playhead.test.tsx`: dragging the playhead **during playback** issues a seek and playback continues from there rather than snapping back — the drag commands the clock rather than fighting it (US1 §11, FR-011)

### Implementation for User Story 1

- [X] T026 [P] [US1] Implement `buildTracks(slide)` in `packages/studio/src/timeline/tracks.ts` — pure, no DOM, no `resolve` import, returning `Track[]` with `EffectBar[]` per data-model.md §3.1
- [X] T027 [P] [US1] Implement `createScale(pxPerSecond)` in `packages/studio/src/timeline/scale.ts` — `toPx`, `toMs`, `clampPxPerSecond`; pure, integer-safe round trip
- [X] T028 [US1] Implement `usePlayback(session, options)` in `packages/studio/src/session/usePlayback.ts`: constructs `createTransport(draft, browserPorts())` — imported from `@cuestack/react`, exported by T008 — exposes `play`/`pause`/`restart`/`seek`, owns the `FrameWriter`, and reconciles `session.authoringTime` on every pause, seek, and stop. **Seven things this module must get right, and each has already been got wrong once in this repository.** *(a)* It holds **no clock primitive of its own**: `no-clock-in-studio` has no exemption, and this module is why. *(b)* The writer is created **once and passed always** — `useMemo(() => createFrameWriter(), [])` — because registration happens through a ref on mount. A writer that only appears at `play()` leaves already-mounted elements unregistered until React reattaches, and the first frame writes into an empty node map. Only the **loop** is conditional. *(c)* `transport` is passed to `useFrameLoop` **only while playing**, `null` otherwise. `useFrameLoop` has no state guard of its own — it ticks from mount — so an unguarded loop would run a full `resolve()` and a DOM write pass every frame while a teacher is merely dragging an element, against SC-004's budget at 300 elements, and would inflate what T097 and T098 measure. *(d)* **While the writer exists it owns the continuous properties**, so `write()` runs once on every authoring-time change as well as once per frame. This is the rule that makes *(c)* safe. Most continuous values self-heal — reconciliation on stop re-renders the same moment the writer last wrote, so React takes ownership of exactly those keys — but **`will-change` cannot**: `FrameWriter.ts:104-108` sets it imperatively and it appears in no render path at all (`elementProperties` is geometry, visual, and reduced; none emits it). Pause mid-effect and seek away with the loop unmounted, and the hint is stranded on every element that was animating — a compositor promotion per element, permanently. One write per seek clears it through the writer's own `activeEffects.length === 0` branch, and costs a write rather than a frame. *(e)* It keeps the frame's resolved state in a **ref**, plus a `visibleIds` string in state set from `onFrame`, and returns the ref's value. This is the player's pair at `LessonPlayerClient.tsx:266-267` — `const state = visibleIds === '' ? initial : latest.current` — and **both halves are required**: `visibleIds` is only the trigger that re-renders when the element set changes, `latest.current` is the value rendered. A trigger without the value recomputes `resolve(slide, session.authoringTime)` from a time R-02 leaves stale, and mounts the same frozen element set. *(f)* `resolveAt` passes the **same `ResolveContext`** the canvas renders with, so the playing path and the idle path resolve against one effect registry. `resolve(slide, timeMs, context?)` defaults `context.effects` to a module-level registry over `builtinEffects`, and a registry reaching one call site and not the other is a forked path in the one function that exists to prevent forked paths (T029 *(iv)*, Constitution V). *(g)* There is **one write path for time**: every authoring-time change — the ruler, the playhead drag, its keyboard nudge — goes through `seek`, never through `session.setAuthoringTime` directly. **A slide change is not a seek and needs its own sequence**: clear the writer, build the new slide's transport, **seek it to that slide's restored authoring time**, and write once. The session keeps time per slide — `times[slideId] ?? 0` at `useEditorSession.ts:97`, "so returning to a slide returns to where the teacher left it" (FR-012, feature 005) — so a fresh transport starting at zero would leave the canvas rendering 3 000 ms while the clock says 0, and the first `play()` would jump the canvas backwards. The writer applies `--cs-opacity`, `--cs-tx` and the rest from the moment it was last given; a caller that moves one without the other splits the canvas between two moments. FR-011 says this in prose and this is what makes it hold. The transport is constructed **once per slide**, not per draft revision; `writer` and `resolveAt` are stable references (`useFrameLoop`'s deps are `[transport, writer, resolveAt]`, and the player memoises `resolveAt` on the slide); and `writer.clear()` runs on slide change and unmount, as `LessonPlayerClient.tsx:531` does. Never calls `goToSlide` — playing across slides is out of scope
- [X] T029 [US1] Wire `packages/studio/src/canvas/EditorCanvas.tsx` and `packages/studio/src/canvas/Overlay.tsx` for playback — **three changes in one seam**. *(i)* Add `writer?: FrameWriter` to `EditorCanvasProps` and pass it to `<SlideView state={state} renderers={renderers} />`. Optional for the static and host cases only — a canvas that will ever play is always given one, from first render, because registration runs on mount (T028 *(b)*). Without it the writer has nothing to write to: registration runs `SlideView` → `ElementFrame` → `writer.refFor(element.id)`, and the editor passes no writer today, so `write()` would iterate an empty node map. `SlideView` and `ElementFrame` already accept the prop — one prop threaded through, not a new mechanism. *(ii)* Add `state?: RenderState` and `atMs?: number`, supplied by `usePlayback` while playing. `EditorCanvas.tsx:81` computes `resolve(slide, session.authoringTime)` at render time and R-02 leaves that time stale during playback, so the canvas must render the **frame's** state while playing and fall back to its own `resolve` when idle. This is the half of the fix that a re-render trigger alone does not give you. *(iii)* `Overlay.tsx:302` calls `ghostReason(element, session.authoringTime)`. Thread `atMs` to it, or an element that has already finished is labelled **"not yet"** during playback — a wrong label, not a stale one. `absent` derives from the same state and follows for free. *(iv)* Add `effects?: EffectRegistry` to `EditorCanvasProps` and pass it as `ResolveContext.effects` to the render-time `resolve`, defaulting to core's own default so the common case is unchanged. **Nothing in this repository has ever passed a `ResolveContext`** — every call site in the player and the editor is two-argument — so the field exists, is well designed, and has no producer. It is the fourth such member this wave has found, after `ElementPlugin.inspector`, `EffectDescriptor.parameters`, and `RenderState.problems`. Without it, T052's synthetic ninth effect can appear in the menu and render as `UNKNOWN_EFFECT_TYPE` on the canvas — the registry principle passing its own test while failing its purpose
- [X] T030 [P] [US1] Implement `packages/studio/src/timeline/Ruler.tsx` — the time axis and the seek target, with tick labelling that stays legible across the scale range, and ends that stay visually distinct from a bar sitting on the boundary (edge case)
- [X] T031 [P] [US1] Implement `packages/studio/src/timeline/Track.tsx` — one element's bar, rendered at no less than `MIN_BAR_PX` so a one-millisecond window stays grabbable (edge case). Handles arrive in US2
- [X] T032 [P] [US1] Implement `packages/studio/src/timeline/Playhead.tsx` — position written by the frame loop during playback, not by React state (research R-02)
- [X] T033 [P] [US1] Implement `packages/studio/src/timeline/TransportControls.tsx` — play, pause, restart, and the current time, announced **with a subject** rather than as a bare number (FR-008). Feature 004's manual sweep found a progress bar announcing a position with no subject and no automated check flagged it
- [X] T034 [US1] Implement `packages/studio/src/timeline/Timeline.tsx` — composes ruler, tracks, playhead, and transport controls; owns the time-scale state; scrolls tracks rather than laying all of them out at once (SC-012)
- [X] T035 [US1] Delete `packages/studio/src/canvas/AuthoringTime.tsx` and `packages/studio/test/canvas/authoring-time.test.tsx`; remove the `<AuthoringTime>` render from `packages/studio/src/canvas/EditorCanvas.tsx:107` and its import; **remove the `AuthoringTime` and `AuthoringTimeProps` exports from `packages/studio/src/index.ts:23,30`**; and rework `packages/studio/test/keyboard/focus.test.tsx`, whose first top-level block is `describe('the authoring-time scrub (FR-037)')` — **five tests**, not one reference: it is a real control, it is labelled rather than announcing a bare number, it conveys its value with units, it changes the authoring time when operated, and it spans the slide's duration. Those are the playhead's requirements restated, so they **migrate** to the playhead rather than being deleted; FR-008 is the same promise under a new number. FR-006: the timeline **replaces** the scrub rather than sitting beside it. Deletion, not deprecation — two controls writing one value disagree the moment one is dragged during playback. `session.setAuthoringTime` stays; it is the control that moves, not the value
- [X] T036 [US1] Add timeline styles to `packages/studio/src/styles/editor.css` using theme tokens only — no colour literals (Constitution III). The gate cannot see CSS, so this is convention-enforced; say so in the file
- [X] T037 [US1] Wire the timeline into the example editor route at `examples/nextjs/app/edit/page.tsx`, replacing the authoring-time scrub. Confirm the stylesheet is imported by `app/edit/layout.tsx` — feature 005 shipped an overlay that swallowed clicks because it was not The writer comes from `usePlayback` and must be handed to `EditorCanvas` — the route is where the two meet, and one that mounts the timeline without passing it gets a playhead moving over a still canvas.
- [X] T038 [US1] Export `Timeline`, `usePlayback`, `buildTracks`, `createScale`, and the constants from `packages/studio/src/index.ts`

**Checkpoint**: US1 is independently functional. Time is visible, the playhead moves the canvas, playback runs the player's clock, and there is exactly one authoring time.

---

## Phase 4: User Story 2 — A teacher changes when things happen by dragging (Priority: P2)

**Goal**: direct manipulation of timing, with the inspector showing the same values.

**Independent Test**: drag a bar and both handles; confirm the element's stored times change to match and that the inspector shows the same values.

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T039 [P] [US2] Write `packages/studio/test/timeline/timing.pure.test.ts` for `moveRange`: start and end move together, duration unchanged; a drag before zero stops at zero **keeping its duration**; every returned value is a non-negative integer (FR-012, FR-014, BR-001, BR-002)
- [X] T040 [P] [US2] Write the resize half of `packages/studio/test/timeline/timing.pure.test.ts`: `resizeRangeStart` changes `startMs` alone, `resizeRangeEnd` changes `endMs` alone, and neither lets `endMs - startMs` fall below `MIN_ELEMENT_DURATION_MS` (FR-013, FR-014)
- [X] T041 [P] [US2] Write the snap half of `packages/studio/test/timeline/timing.pure.test.ts`: a target 70 ms away snaps and lands **exactly**; one 90 ms away does not; an event never snaps to itself; `SNAP_THRESHOLD_MS === 0` disables snapping entirely and nothing else changes (FR-015)
- [X] T042 [P] [US2] Write `packages/studio/test/draft/set-timing.test.ts`: `set-timing` takes a single element id, succeeds on an unlocked element, refuses on a locked one with `reason: 'locked'` and a message, refuses in read-only, and leaves the draft untouched when refused (FR-016, BR-011, FR-042)
- [X] T043 [P] [US2] Write `packages/studio/test/timeline/drag.test.tsx`: dragging a bar and both handles produces the stored values the pure engine computed; changing the time scale **mid-drag** continues against the moment the drag started from, not the pixel; a one-millisecond bar is still hittable and draggable at the smallest scale; an element spanning 0 to the slide's full duration exposes both handles distinguishably from the ruler's ends (FR-012, FR-013, edge cases)
- [X] T044 [P] [US2] Write the parity half of `packages/studio/test/timeline/drag.test.tsx`: timing changed on the timeline shows the same values in the inspector — two views, one source of truth (FR-017, SC-002)

### Implementation for User Story 2

- [X] T045 [P] [US2] Implement `moveRange`, `resizeRangeStart`, `resizeRangeEnd` in `packages/studio/src/timeline/timing.ts` — pure, milliseconds in and out, never pixels, clamped so the reducer can never be handed something the schema rejects. **Not a reuse of `geometry/transform.ts`**: time is one-dimensional, integer, floored at zero, and snaps to event boundaries rather than edges and centres (research R-07)
- [X] T046 [P] [US2] Implement snap-candidate collection in `packages/studio/src/timeline/timing.ts` — every *other* event's start and end on the slide, plus 0 and `slide.durationMs`
- [X] T047 [US2] Implement the `set-timing` case in `packages/studio/src/draft/reducer.ts`, honouring the five promises feature 005 established: pure, no mutation, validated result, read-only refusal, locked refusal
- [X] T048 [US2] Add bar and handle drag to `packages/studio/src/timeline/Track.tsx`, converting a horizontal pixel delta to milliseconds through `createScale` measured **once per gesture**. The existing rule that DOM measurement is confined to `canvas/pointer.ts` applies here — extend that module rather than measuring in the component
- [X] T049 [US2] Add keyboard re-timing to `packages/studio/src/timeline/Track.tsx`: arrow keys move by `NUDGE_MS`, with a modifier by `NUDGE_MS_COARSE`, and modifier-plus-arrow resizes (FR-009)
- [X] T050 [US2] Surface the locked refusal in the timeline through the existing announcer path used by `packages/studio/src/canvas/Announcer.tsx`, so a refused drag says why rather than doing nothing visible (FR-016)

**Checkpoint**: US1 and US2 both work. Timing is directly manipulable and the inspector agrees.

---

## Phase 5: User Story 3 — A teacher makes something appear, move, and leave (Priority: P3)

**Goal**: eight effects, implemented and tested since Wave 1, become reachable by a teacher.

**Independent Test**: add a fade to an element, set its duration, scrub through it and confirm the element fades; add a second effect and confirm both run in chronological order.

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T051 [P] [US3] Write `packages/studio/test/effects/registry-sourced.test.tsx`: the effects offered are `registry.types()`; the phases offered for a chosen effect are `descriptor.phases`; the parameters offered are `descriptor.parameters`; the easing defaults to `descriptor.defaultEasing` (FR-018, FR-020, FR-026). The registry under test is supplied through the props T029 *(iv)* and T064 add — **one instance reaching both the menu and `resolve`**
- [X] T052 [P] [US3] Write the ninth-effect control in `packages/studio/test/effects/registry-sourced.test.tsx`: register a synthetic effect in a test registry, pass that registry to both the canvas and the inspector, and assert it appears with its declared phases and parameter fields **and renders on the canvas** — with no editor change. Both halves matter: an effect the menu offers and the resolver rejects as `UNKNOWN_EFFECT_TYPE` is worse than one it never offered. If it does not, a per-effect branch has crept in — the switch statement Constitution I calls a defect
- [X] T053 [P] [US3] Write `packages/studio/test/draft/effect-edits.test.ts` for `add-effect`: the new effect is immediately valid — phase, start, positive duration — its `id` comes from the session's `IdSource`, and its `order` sorts it last among equal starts. Refused on a locked element, on an unknown type, and in read-only (FR-019, FR-022, FR-025)
- [X] T054 [P] [US3] Write the `set-effect` half of `packages/studio/test/draft/effect-edits.test.ts`: a duration of zero or less is refused **with a reason** rather than a schema path; a phase outside `descriptor.phases` is refused; `startMs` stays a non-negative integer; changing an effect never changes the element's own timing (FR-020, FR-021, FR-023, FR-025, BR-004)
- [X] T055 [P] [US3] Write the `remove-effect` half of `packages/studio/test/draft/effect-edits.test.ts`: the element keeps its own `startMs`/`endMs` and only the effect is gone (FR-021, FR-025)
- [X] T056 [P] [US3] Write `packages/studio/test/effects/sweep.test.tsx`: **all eight** registered effects can be applied from the editor, and each visibly changes what the canvas renders at a moment inside its window. Eight effects, eight assertions — the shape of the `ELEMENT_TYPES` sweep that caught feature 005's guessed defaults (SC-006)
- [X] T057 [P] [US3] Write `packages/studio/test/effects/authoring.test.tsx`: two effects with different starts run in chronological order; two sharing a start run in a deterministic, repeatable order via `Effect.order`; two overlapping effects both render as bars; an effect starting after its element has gone is authorable and the timeline says it would never run (FR-022, edge cases)
- [X] T058 [P] [US3] Write `packages/studio/test/effects/reduced-motion.test.tsx`: an effect authored in the editor honours the reduced-motion preference exactly as one from a hand-written manifest does — a slide-in becomes a fade, not a blink. **No reduced-motion branch may appear anywhere in this feature** (FR-024, BR-015)

### Implementation for User Story 3

- [X] T059 [P] [US3] Implement `packages/studio/src/effects/defaults.ts` — a new effect born valid: phase from `descriptor.phases[0]`, `startMs` at the current authoring time clamped into the element's window — **a default, not an invariant**: `set-effect` must not clamp, because an effect starting after its element has gone is authorable and T057 asserts it. A clamp copied from here into the reducer makes that edge case unreachable, `durationMs` of `DEFAULT_EFFECT_DURATION_MS`, easing from `descriptor.defaultEasing`, `order` last among equal starts. Same promise `elements/defaults.ts` makes, and what keeps FR-041 true without the reducer repairing anything
- [X] T060 [US3] Implement the `add-effect`, `set-effect`, and `remove-effect` cases in `packages/studio/src/draft/reducer.ts`, with the effect-shaped helpers in `packages/studio/src/draft/effects.ts`
- [X] T061 [P] [US3] Implement `packages/studio/src/effects/EffectFields.tsx` — renders `descriptor.parameters` through the inspector's existing field components. **Flat keys into `effect.parameters`, never a dotted read**: `InspectorField.key` means something different here than on an element, and `packages/studio/src/inspector/path.ts` must not be reached for
- [X] T062 [US3] Implement `packages/studio/src/effects/EffectControls.tsx` — add, configure, and remove, with the type list from the **injected** registry's `types()` and the phase list from the chosen descriptor. The removal confirmation follows the terms feature 005 set for delete, and is expected to be **removed** when ED-5 lands real undo, not kept beside it
- [X] T063 [US3] Render effect bars on the element's track in `packages/studio/src/timeline/Track.tsx`, one per effect, overlapping bars drawn rather than collapsed
- [X] T064 [US3] Add `effects?: EffectRegistry` to `InspectorProps` and wire `EffectControls` into `packages/studio/src/inspector/Inspector.tsx` for the selected element, then export the effect surface from `packages/studio/src/index.ts`. The prop mirrors the existing `plugins?: ElementRegistry` exactly — optional, defaulting to core's own, documented in the same place and for the same reason. Naming that symmetry is what stops the effect registry arriving as a differently-shaped afterthought, and it is the same instance T029 *(iv)* hands the canvas

> **Shipped incomplete — recorded during feature 007's analysis.** T029 part *(iv)* was not
> implemented: `EditorCanvasProps` never gained `effects`, and the canvas still calls
> `resolve(slide, atMs)` with two arguments. `InspectorProps` and `EffectControlsProps` both
> received the registry, so a host registering a ninth effect gets it **offered in the menu and
> rendered as `UNKNOWN_EFFECT_TYPE` on the canvas** — the exact defect J1 was raised to prevent.
>
> It escaped because T051's ninth-effect test called `resolve(slide, 500, { effects: registry })`
> **directly** rather than through the canvas: the path that works was tested, not the path a host
> takes. That is the same shape as the defects this project keeps finding, and it is why the fix
> (feature 007 T008) writes a *canvas-level* test first.

**Checkpoint**: the framework's own effect library is reachable by a teacher for the first time since Wave 1.

---

## Phase 6: User Story 4 — A teacher sequences without touching the timeline (Priority: P4)

**Goal**: With Previous, After Previous, and a delay — over **events**, so a list can be revealed one line at a time.

**Independent Test**: set three elements to With Previous, After Previous, and After Previous with a delay; confirm the absolute times; switch to the timeline and confirm they are unchanged.

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T065 [P] [US4] Write `packages/studio/test/sequence/events.pure.test.ts`: one event per element at its `startMs` and one per effect at the effect's `startMs`; ordering is by start, then the owning element's paint order, then `Effect.order`; a hidden element still produces an event; a slide of zero elements produces zero events and does not throw (FR-035, edge cases)
- [X] T066 [P] [US4] Write the no-conversion assertion in `packages/studio/test/sequence/events.pure.test.ts`: an effect's position in the list is derived from its raw `startMs`, because `Effect.startMs` is **slide** time. Asserted rather than assumed — it is what lets one ordered list hold both kinds
- [X] T067 [P] [US4] Write `packages/studio/test/sequence/classify.pure.test.ts` against the table in contracts/sequence-contract.md §2: equal starts → With Previous; start equals previous end → After Previous; start after previous end → the delay variant with the exact `delayMs`; **1 ms after is a delay of 1, not After Previous**; an event beginning while its predecessor still runs → Custom; no predecessor → First (FR-028, FR-031, FR-033)
- [X] T068 [P] [US4] Write `packages/studio/test/sequence/resolve.pure.test.ts`: every event ends with absolute times; an element's duration and an effect's `durationMs` are preserved when a start moves; `first` resolves to 0; every produced value is a non-negative integer (FR-029, FR-033)
- [X] T069 [P] [US4] Write `packages/studio/test/sequence/round-trip.pure.test.ts`: `classify(resolveSequence(events, relationships))` returns the relationships it was given. **This single property is the mode's correctness** and is the test to write first within this story
- [X] T070 [P] [US4] Write `packages/studio/test/sequence/adjacency.pure.test.ts`: a relationship is expressible between **any two adjacent events**, asserted across all four shapes — element→element, effect→effect on one element, element→effect, and effect→element. Each shape classifies and resolves identically to the others (FR-036). This is the requirement that distinguishes an event list from an element list, and it is the one the clarification widened US4 for; without it the mode can be half-built and still pass every other suite in this phase
- [X] T071 [P] [US4] Write `packages/studio/test/draft/apply-sequence.test.ts`: succeeds over a slide; **applies to the unlocked events and reports the locked ones**, refusing outright only when every affected element is locked; refuses in read-only; leaves the draft untouched when refused; routes through `applyEdit` (FR-016, FR-042, BR-011). The locked half follows `partitionLocked` in `reducer.ts:47-56`, which is the convention every other multi-element kind already uses — and its comment says why: "returning a refusal for the whole set would let one locked element silently veto a five-element drag". One locked element must not veto a slide's sequence
- [X] T072 [P] [US4] Write `packages/studio/test/sequence/view.test.tsx`: relationships are settable per event; the first event is shown as starting at the slide's beginning; switching to the timeline changes **zero** values; and **reordering re-classifies without rewriting timing** — after a reorder the view may show different relationships, and every element's `startMs`/`endMs` is byte-identical until the teacher applies. An element carries its effects with it. Assert the narrow case too: because events are ordered by `startMs` first and paint order only as a tie-break, reordering three elements at 0/1000/2000 changes **nothing**, while reordering two that share a start time changes which is "previous" (FR-027, FR-030, FR-033, FR-034, SC-007)
- [X] T073 [P] [US4] Write `packages/studio/test/sequence/custom.test.tsx`: an event the timeline made non-simple shows as Custom rather than being silently reinterpreted; taking it back to a relationship states the current absolute time **and** the one the change would produce, and requires confirmation before applying (FR-031, FR-032)
- [X] T074 [P] [US4] Write `packages/studio/test/sequence/uc-02.test.tsx`: a three-line reveal is authorable **entirely in the sequence view**, with no timeline interaction at all. This is UC-02, and SC-016 is the measurable form of whether the mode serves the teacher §7.1 describes

### Implementation for User Story 4

- [X] T075 [P] [US4] Implement `eventsOf(slide)` in `packages/studio/src/sequence/events.ts` — pure, no React, no DOM; the ordering rule stated in a comment because "previous" is undefined without it
- [X] T076 [P] [US4] Implement `classify(events)` and `resolveSequence(events, relationships)` in `packages/studio/src/sequence/relationships.ts` — pure, **exact equality** with no tolerance, storing nothing, and operating on adjacency alone so the four shapes in T070 need no special cases. Neither function writes: reordering changes what `classify` returns, never what the draft holds — only `apply-sequence` writes timing, and it writes it because the teacher asked (Constitution III, research R-05)
- [X] T077 [US4] Implement the `apply-sequence` case in `packages/studio/src/draft/reducer.ts` with helpers in `packages/studio/src/draft/sequence.ts`. `eventKey` is `elementId`, or `elementId + ':' + effectId` for an effect event — derived, because minting an id for an event would be storage (FR-029)
- [X] T078 [P] [US4] Implement `packages/studio/src/sequence/SequenceRow.tsx` — one event, its label, its relationship control, and its resolved absolute time
- [X] T079 [P] [US4] Implement `packages/studio/src/sequence/CustomConfirmation.tsx` — states the current time and the one the relationship would produce, and requires confirmation. Not a courtesy dialogue: making a Custom event simple discards timing the teacher authored on purpose (FR-032)
- [X] T080 [US4] Implement `packages/studio/src/sequence/SequenceView.tsx` — the ordered list, the view toggle against the timeline, and the empty state for a slide with no events (FR-027)
- [X] T081 [US4] Add sequence-view styles to `packages/studio/src/styles/editor.css` using theme tokens only, and export the sequence surface from `packages/studio/src/index.ts`

**Checkpoint**: all four stories work independently. UC-02 is servable without opening the timeline.

---

## Phase 7: User Story 5 — The slide and what is on it stay consistent (Priority: P5)

**Goal**: an overrun is shown where the teacher is looking, with an action that computes the number for them.

**Independent Test**: author an element ending after the slide's duration, confirm the timeline identifies it, use the offered action, and confirm the slide extends to contain it.

### Tests for User Story 5 ⚠️ write first, must fail

- [X] T082 [P] [US5] Write `packages/studio/test/timeline/overrun.pure.test.ts`: `overrunsOf` returns exactly the `ELEMENT_BEYOND_SLIDE` and `EFFECT_BEYOND_SLIDE` problems from a `RenderState` and invents none of its own; `requiredDurationMs` is the maximum end across elements **and** their effects (FR-037, FR-038). Plus the zero-duration slide: `collectProblems` tests `endMs > slide.durationMs` and every element has `endMs >= 1`, so a slide of duration 0 reports **every** element as an overrun. That is the kernel answering correctly; the timeline must present it as one problem about the slide rather than three hundred about its elements, and `requiredDurationMs` must still compute the right target
- [X] T083 [P] [US5] Write `packages/studio/test/draft/extend-slide.test.ts`: the action extends the slide to contain the latest end **exactly**; refuses in read-only; leaves the draft untouched when refused; and the target is computed by the reducer from the draft so the surface cannot supply a different number (FR-038, SC-011)
- [X] T084 [P] [US5] Write `packages/studio/test/timeline/overrun.test.tsx`: each overrun is attributed to the element it belongs to; the message states the problem, the element, and the action; with **no** overrun the timeline says nothing about durations (FR-037, FR-040, US5 §5)
- [X] T085 [P] [US5] Write the non-clamping half of `packages/studio/test/timeline/overrun.test.tsx`: reducing a slide's duration below an existing end leaves every authored value intact and reports the overrun. Nothing is silently clamped or truncated (FR-039, BR-017)

### Implementation for User Story 5

- [X] T086 [P] [US5] Implement `overrunsOf(state)` and `requiredDurationMs(slide)` in `packages/studio/src/timeline/overrun.ts` — a **filter and an arithmetic**, not a detector. The kernel has emitted both codes since Wave 1 and nothing has ever read them (research R-08)
- [X] T087 [US5] Implement the `extend-slide` case in `packages/studio/src/draft/reducer.ts`, computing the target from the draft rather than accepting one
- [X] T088 [US5] Implement `packages/studio/src/timeline/TimelineProblems.tsx` — the overruns, attributed, each with the extend action. Reuse the kernel's own message wording rather than composing a second one; it already names the problem, the element, and the recommended action (FR-040, NFR-USA-004)
- [X] T089 [US5] Wire `TimelineProblems` into `packages/studio/src/timeline/Timeline.tsx`, rendering nothing at all when there are no problems

**Checkpoint**: BR-017 has a surface for the first time since Wave 0. PB-1 still owns the publication gate.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T090 Write `packages/studio/test/keyboard/timeline.test.tsx`: every action in User Stories 1–5 performed with **no pointer events at all** — move the playhead, move between tracks, read the current time, move and resize a bar, play, pause, restart, add and configure and remove an effect, set every relationship, confirm a Custom-to-simple change, and take the extend-slide action (FR-009, SC-009). **State the focus model, because the dense slide makes it matter.** The editor has no roving tabindex anywhere — feature 005's canvas "uses real buttons, so focus and activation come from the platform", one focusable control per affordance. Inherited unchanged, a keyboard user reaches the transport controls by tabbing through every track on T004's dense slide. Choose deliberately: one tab stop for the track list with arrow-key traversal inside it, or the canvas's per-control model accepted on purpose. Either is defensible; leaving it unstated is what is not
- [X] T091 Extend `packages/studio/test/keyboard/focus.test.tsx` to the new surfaces: every interactive control on the timeline, the sequence view, and the effect controls shows a **visible focus indicator** and takes focus in a sensible order. axe does not check focus indicators, so T092 cannot cover this and FR-046 would otherwise be half-asserted
- [X] T092 Extend `packages/studio/test/a11y/axe.test.tsx` to cover the timeline, the sequence view, the effect controls, and the FR-032 confirmation, asserting zero violations and an accessible name on every interactive control (FR-046, SC-010)
- [X] T093 Extend `packages/studio/test/canvas/read-only.test.tsx` to the new surfaces: every mutating control is unavailable and says why, while **seeking and playing remain available** (FR-047)
- [X] T094 Extend `packages/studio/test/session/no-leak.test.tsx`: time scale, scroll position, open view, authoring time, and transport state never reach a saved manifest, and applying a sequence changes only `startMs`, `endMs`, and `durationMs` (FR-044, SC-008, SC-014)
- [X] T095 Extend `packages/studio/test/parity/state.test.tsx`: the render state the frame loop produces during playback at time *t* equals the one a seek to *t* produces. True by construction — `useFrameLoop` calls the same `resolveAt` — but this feature gives the editor its second path to visual state, and Constitution V is NON-NEGOTIABLE precisely because "true by construction" is what every parity bug was before it shipped (FR-043)
- [X] T096 Extend `packages/studio/test/draft/validity-sweep.test.ts` to include the six new kinds in the generated edit sequence, asserting `validate()` after each one. FR-041 and SC-005: no editor action can produce a lesson the player would refuse. **Split during implementation.** The *generator* half could not wait: `nextEdit` picks a kind at random from `EDIT_KINDS`, so the moment T016 grew the union the sweep began selecting kinds it could not build — a typecheck error and a broken sweep from that commit onward. Those six generator cases landed with T016. What remains here is the *assertion* half: that the six produce valid drafts once their reducer cases exist, the last of which is T087
- [X] T097 Write `packages/studio/test/perf/timeline.test.tsx` against the **dense slide** T004 added: playhead move to rendered state ≤ 100 ms (SC-003), drag feedback ≤ 100 ms (SC-004), and the track list scrollable rather than all laid out at once (SC-012)
- [X] T098 Arm the playhead budget in `tools/scripts/gates/perf.mjs` and add its negative control to `tools/scripts/check-gates.test.ts` — a 200 ms synchronous delay in the seek path must turn the gate red. The gate must state out loud that it measures the editor's own work and not paint; happy-dom has no compositor and a green line here is not a frame-rate claim
- [X] T099 Write `packages/studio/test/rules/BR-016.test.ts` — the manifest comparison: apply a sequence, serialize, read back, and assert the only differences are timing values (SC-013). **Not** `*.pure.test.ts`: `check-rule-coverage.mjs` matches `^BR-\d+\.test\.tsx?$` and a pure-named file would leave the gate reporting an uncovered rule while the test passes
- [X] T100 Write `packages/studio/test/rules/BR-017.test.ts` — a slide duration reduced below an existing end leaves authored values intact and reports the overrun (SC-013)
- [X] T101 [P] Add a timeline and sequencing pass to `examples/nextjs/app/edit/page.tsx` and its tour copy in `examples/nextjs/app/tour.ts`, so the example demonstrates the whole feature rather than the canvas alone
- [X] T102 [P] Update `docs/cuestack_framework_plan.md`: mark ED-3 and ED-4 delivered; record the obligations this feature discharges (the scrub becomes the playhead; BR-017 gains a surface), the ones it does not (navigation `on_click`, `ElementPlugin.validate`, the delete confirmation, the theme gate's blindness to CSS), and the **two public API changes** — `AuthoringTime`/`AuthoringTimeProps` removed from `@cuestack/studio`, `browserPorts`/`Ports` added to `@cuestack/react`. Every package is at `0.0.0` and unpublished, so no bump is owed yet; what is owed is the record, so the first published version can state them (Constitution I)
- [X] T103 [P] Record the `EffectDescriptor.parameters` change in `packages/core/README.md` or the equivalent registry documentation, including the flat-key-versus-dotted-path difference from element inspector fields
- [X] T104 Run the whole suite and every gate from the repository root — `pnpm test && pnpm typecheck && pnpm lint && pnpm gates && pnpm check:rules && pnpm check:studio-isolation` — and fix what it finds. `pnpm lint` catches what no individual suite can: feature 005's equivalent pass went red here on an unused variable in a perf test, because vitest does not lint
- [X] T105 Execute every command in [quickstart.md](./quickstart.md) **verbatim** and correct whatever the document got wrong, including the negative controls in §2, §4, §6, and §13. Feature 004's pass found three commands matching no test files at all, one claiming to run an acceptance scenario it did not; record what this pass finds in the document itself
- [ ] T106 Manual keyboard and screen-reader pass over quickstart.md §15's ten steps. This needs a human with assistive technology. Feature 005 left its equivalent (T116) open rather than marking it done, and the same applies here — an unfinished item recorded honestly is worth more than a checked box

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies; T005 depends on T004
- **Foundational (Phase 2)**: needs Setup — **blocks every user story**. T008 blocks T028 specifically
- **US1 (Phase 3)**: needs Foundational. **T020 comes first and blocks the rest of the phase** — fifteen DOM tests mount through it. Within it, T028 and T029 are one change in two files — the frame loop is
  inert without both, and the tests in T021–T024 are what prove it
- **US2 (Phase 4)**: needs US1 — it drags the tracks US1 draws
- **US3 (Phase 5)**: needs US1 for the track to draw bars on; independent of US2
- **US4 (Phase 6)**: needs US3 **only for the effect half** of the event list. The element half needs nothing beyond Foundational — which is what makes the cut line severable
- **US5 (Phase 7)**: needs US1 for a surface; independent of US2, US3, and US4
- **Polish (Phase 8)**: needs the stories being shipped. T096 needs T087, the last reducer case

### Within each story

- Tests first, and failing, before the implementation task that satisfies them
- Pure modules before the components that render them
- Reducer cases before the surfaces that dispatch them

### Single-owner files

These take sequential tasks only — every task touching them is unmarked:

| File | Tasks |
|---|---|
| `packages/studio/src/draft/reducer.ts` | T047, T060, T077, T087 |
| `packages/studio/src/draft/edit.ts` | T016 |
| `packages/studio/src/timeline/Track.tsx` | T031, T048, T049, T063 |
| `packages/studio/src/timeline/Timeline.tsx` | T034, T089 |
| `packages/studio/src/canvas/EditorCanvas.tsx` | T029, T035 |
| `packages/studio/src/canvas/Overlay.tsx` | T029 |
| `packages/studio/src/timeline/timing.ts` | T045, T046 |
| `packages/studio/src/styles/editor.css` | T036, T081 |
| `packages/studio/src/index.ts` | T035, T038, T064, T081 |
| `packages/studio/test/harness/editor.tsx` | T020 |
| `packages/studio/test/keyboard/focus.test.tsx` | T035, T091 |
| `tools/scripts/check-gates.test.ts` | T003, T098 |
| `tools/scripts/fixtures/heavy-lesson.mjs` | T004 |

T045 and T046 are both in `timing.ts` and marked `[P]` against each other only because they add
disjoint exports; if that proves awkward, run them in order.

### Parallel opportunities

- T004, T006, T007 in Setup (T005 waits on T004)
- T012, T013, T014 — three different built-in effect files
- T017–T019 and T021–T025 — eight US1 test tasks, different files. **T020 runs first and alone**: the DOM tests among them mount through the harness it extends
- T039–T044: all six US2 test tasks
- T051–T058: all eight US3 test tasks
- T065–T074: all ten US4 test tasks
- T082–T085: all four US5 test tasks
- T026, T027 · T030, T031, T032 · T078, T079 · T101, T102, T103

## Parallel example: User Story 1 tests

```bash
Task: "Write test/timeline/tracks.pure.test.ts — one track per element, hidden included"
Task: "Write test/timeline/scale.pure.test.ts — round trip, bounds, moment preserved"
Task: "Write test/playback/transport.test.tsx — and one play-through with no seek at all"
Task: "Write test/playback/visibility.test.tsx — BR-013 in the editor"
Task: "Write test/playback/reconcile.test.tsx — the bound on the declared divergence"
Task: "Write test/timeline/render.test.tsx — bars, ruler, playhead moves the canvas"
Task: "Write test/timeline/playhead.test.tsx — dragging during playback commands the clock"
```

---

## Implementation Strategy

### MVP: Setup + Foundational + US1

Time becomes visible and playable, and the authoring-time scrub is finally replaced. Stop here and
the feature has already discharged the obligation feature 005 recorded against it.

### Incremental delivery

1. Setup + Foundational → the ports are exported, the registry declares parameters, the edit union is closed
2. **US1** → tracks, playhead, playback, one clock — demo
3. **US2** → direct manipulation — demo
4. **US3** → eight effects reachable for the first time — demo
5. **US4** → Simple Sequence, elements and effects — demo
6. **US5** → overruns shown where the teacher is looking — demo

### If this has to be cut

The specification recorded the line in advance rather than leaving it to be improvised: **US4's
effect half** is severable. Sequencing elements alone is a smaller mode that still serves the simple
case, and the effect half roughly doubles it. Cutting it costs UC-02 and SC-016 — a real loss, not a
free saving — and nothing else depends on it. In tasks: T066, T074 go, T070 narrows to the
element→element shape, and T075's event list narrows to elements.

The order of what remains, cheapest to lose last: US5, then US3, then US2 and US1 which are the
feature.

---

## Remediation applied after `/speckit-analyze`

Twelve findings at MEDIUM and above. What changed:

| Finding | Change |
|---|---|
| **E1** `browserPorts` not exported | **New T008**, first in Foundational, exporting it and `Ports` from `@cuestack/react` with an export assertion. T028 now names the import |
| **F1** clock rule exempted the wrong file | T002 drops `ignores` entirely — the rule is absolute. T003 loses the exemption control and keeps the two that matter. T028 states it holds no clock primitive |
| **D1** public export deleted without a record | T035 now removes the `index.ts` exports explicitly; T102 records both API changes and states why no bump is owed at `0.0.0` |
| **E2** FR-036 uncovered | **New T070**, the four adjacency shapes. T076 now says the classifier works on adjacency alone so they need no special cases |
| **E3** fixture change shifts existing budgets | T004 names the last slide as the dense one and keeps `ELEMENTS` at 300; **new T005** re-runs the two existing perf suites and records movement |
| **F2** `set-timing` plural vs single | T016 and T042 fix it to a single `id`; data-model.md §4 corrected |
| **C1** validity sweep red for six phases | Moved from Foundational to **T096** in Polish, with the reason stated in both places |
| **C2** control asserted against a file not yet created | Dissolved by F1 — with no exemption there is nothing to assert against `usePlayback.ts` in Phase 1 |
| **E4** two edge cases untested | Added to T043; T006 grows the two fixtures; T030 states the ruler-end requirement |
| **E5** visible focus indicator unasserted | **New T091** extending `test/keyboard/focus.test.tsx`, with the note that axe cannot cover it |
| **E6** no playback-vs-seek parity assertion | **New T095** extending `test/parity/state.test.tsx` |
| **D2** scrub deletion vs the focus suite | T035 names `test/keyboard/focus.test.tsx` and requires the playhead to take the scrub's place |

Not applied, all LOW: the FR-018/FR-020/FR-025/FR-026 restatement, and the "previous element has
no end" assertion. The missing FR/SC citations were closed in passing — every one of the 63
requirement ids now appears in this file.

## Remediation applied after the second `/speckit-analyze`

The first pass read the documents. The second traced the render path, and found that playback as
designed would have advanced the playhead over a frozen canvas.

| Finding | Change |
|---|---|
| **G1** nothing re-renders the canvas during playback | T028 gains the `visibleIds` trigger the player already carries at `LessonPlayerClient.tsx:433`. `EditorCanvas` resolves at render time from `session.authoringTime`, which R-02 deliberately leaves stale while playing — so without a structural trigger no element entering mid-slide ever mounts. R-02 and plan.md now state the qualification the player keeps in a comment: **React still owns structure** |
| **G2** the frame writer had no nodes | **New T029**, threading a `writer` prop through `EditorCanvas` into `SlideView`. Registration runs `SlideView` → `ElementFrame` → `refFor`, and the editor passed no writer, so `write()` would have iterated an empty map |
| **G3** every planned test drove a seek | T021 gains a play-through with **no seek at all**, asserting an element mounts mid-playback. This is the assertion whose absence hid the same defect in Wave 2 |
| **G4** transport and callback lifetimes unstated | T028 states the transport is built once per slide, not per draft revision, and that `writer`/`resolveAt` are stable — otherwise an edit during playback resets the clock and every render tears down the loop |
| **G5** `EditorCanvas.tsx` took two tasks, untracked | Added to the single-owner table (T029, T035) |
| **G6** `new Date` specified twice | T002 states the globals form covers it; the contract's separate syntax entry is redundant |

## Remediation applied after the third `/speckit-analyze`

The second pass found that playback would render nothing and fixed the re-render trigger. The third
pass read the player's render line — `const state = visibleIds === '' ? initial : latest.current`
— and found the fix was **half of one**: the trigger was specified, the value was not. Four related
gaps in the same seam came with it. No new tasks; T023, T028, T029, and T037 grew.

| Finding | Change |
|---|---|
| **H1** the trigger was named, the value was not | T028 *(c)* now requires **both** halves — the `visibleIds` state that triggers and the ref that supplies the value — and T029 *(ii)* gives `EditorCanvas` the `state`/`atMs` props to render from. Re-rendering while `resolve(slide, session.authoringTime)` still reads a stale time mounts the same frozen element set; the writer can only style what React mounted |
| **H2** two writers of time, one unconstrained | T028 *(d)*: while playback is mounted, **every** authoring-time change goes through `seek`. The writer applies the continuous properties from `transport.slideTimeMs` while structure and geometry come from `session.authoringTime` — move one without the other and the canvas is split between two moments. `session.setAuthoringTime` is public and feature 005's tests call it directly, so this had to be said |
| **H3** the loop had no playing guard | T028 *(b)*: `transport` is passed to `useFrameLoop` only while playing. `useFrameLoop` ticks from mount, so an unguarded loop resolves and writes every frame while a teacher is merely dragging — against SC-004 at 300 elements. Guarding it also collapses H2's scope: when nothing plays, the render path alone owns the canvas |
| **H4** ghosts would carry a wrong label | T029 *(iii)*: `atMs` threaded to `Overlay.tsx:302`, so an element that has already finished is not labelled "not yet" during playback |
| **H5** writer lifetime unspecified | T028 *(e)*: `usePlayback` owns the writer, `clear()` runs on slide change and unmount as `LessonPlayerClient.tsx:531` does; T037 states the route hands it to `EditorCanvas` |
| **H6** two recorded parity lessons uncited | R-02 now cites both: `ElementFrame`'s "anything timing-derived written here goes stale between renders — the rendered-parity sweep caught precisely that with will-change", and `FrameWriter`'s "seeking to 500ms produced different markup from stepping to 500ms". They are the evidence for H1–H3 and the reason T095's parity assertion exists |

T023 also gained the two assertions that hold this seam shut: a direct `setAuthoringTime` during
playback visibly splits the canvas, and idle playback costs nothing.

## Remediation applied after the fourth `/speckit-analyze`

The third pass guarded the frame loop on `playing`. The fourth checked what that guard cost, and
found one property it strands. No new tasks; T005, T023, T028, and T029 changed.

| Finding | Change |
|---|---|
| **I1** `will-change` stranded when the loop unmounts | T028 *(d)* states the owning rule: **while the writer exists it owns the continuous properties**, so `write()` runs once on every authoring-time change as well as once per frame. Every other continuous value self-heals — reconciliation on stop re-renders the moment the writer last wrote, so React takes ownership of those keys — but `will-change` is set imperatively at `FrameWriter.ts:104-108` and appears in **no** render path, so nothing else can ever remove it. Pause mid-effect, seek away, and it is stuck on every animating element. One write per seek clears it and costs a write rather than a frame, so the loop guard keeps its saving. **This was a consequence of the guard added in the previous pass**, and does not arise in the player, whose loop runs for the component's life |
| **I2** writer creation confused with writer passing | T028 *(b)*: created once via `useMemo`, passed always; only the loop is conditional. Registration runs through a ref on mount, so a writer appearing at `play()` would leave mounted elements unregistered and lose the first frame. T029 *(i)* marks the prop optional for the static and host cases only |
| **I3** an assertion with no observable | T023 restates "the loop is not mounted" as **idle costs zero writes**, with a seek producing exactly one. A cancelled `requestAnimationFrame` cannot be observed, and asserting on rAF in happy-dom asserts against the environment rather than the code |
| **I4** a measurement recorded in a task list | T005 records the perf re-baseline in quickstart.md §13, beside the budgets, where it still has a reader after the feature ships |

## Remediation applied after the fifth `/speckit-analyze`

The fourth pass closed the frame seam. The fifth left it — it verifies clean — and went to US3 and
the schema. No new tasks; T006, T019, T028, T029, T051, T052, T062, T064, and T082 changed.

| Finding | Change |
|---|---|
| **J1** the effect registry had no route into the editor | T029 *(iv)* adds `effects?: EffectRegistry` to `EditorCanvasProps`, passed as `ResolveContext.effects`; T064 mirrors it on `InspectorProps`; T028 *(f)* makes `resolveAt` share the same context so the playing and idle paths resolve against one registry; T051 and T052 now thread a test registry through both and assert the ninth effect **renders**, not merely appears. `resolve(slide, timeMs, context?)` has always taken `context.effects` and **nothing in this repository has ever passed a `ResolveContext`** — every call site in the player and the editor is two-argument. Without the threading, T052 could pass with an effect the menu offers and the canvas rejects as `UNKNOWN_EFFECT_TYPE`: the registry principle satisfying its own test while failing its purpose |
| **J2** a constraint asserted from memory | data-model.md §1.3 said `Slide.durationMs` is `msDuration`, integer > 0. It is **`msInt`** (`lesson.ts:32`) — integer ≥ 0. Corrected, with the consequence recorded rather than buried |
| **J3** the zero-duration slide | Legal by J2 and reachable for any slide that advances `on_click`. Added to T006's fixtures, to T019's scale bounds (a zero-width ruler must not divide by zero, and a vacuous round-trip must be visibly vacuous rather than silently skipped), and to T082: `collectProblems` tests `endMs > durationMs`, so a slide of duration 0 reports **every** element as an overrun — correct of the kernel, and the timeline must show one problem about the slide rather than three hundred about its elements. Also added to spec.md's Edge Cases |
| **J4** the effect registry's API shape unstated | T064 states that `effects?: EffectRegistry` mirrors `plugins?: ElementRegistry` — optional, defaulting to core's own, documented in the same place. One sentence, and it is what stops the effect registry arriving as a differently-shaped afterthought |

**A pattern worth recording, now at four instances.** `ElementPlugin.inspector` had no consumer and
no producer (feature 005). `EffectDescriptor` never declared its parameters (R-04). `RenderState.problems`
had been emitted since Wave 1 and never read (R-08). `ResolveContext.effects` has never been passed
by anything. The kernel has consistently been built ahead of its consumers, and every feature that
builds a consumer finds one more. That is a good problem — but it means the reliable way to review a
kernel contract is to try to use it, not to read it.

## Remediation applied after the sixth `/speckit-analyze`

The first five passes found defects where the plan met code that already existed. This one found a
contradiction inside `spec.md` itself — one that had survived the clarification round and five
analyses, and only surfaced when `reorder`'s actual effect on `zIndex` was traced. No new tasks;
T035, T071, T072, T076, and T090 changed.

| Finding | Change |
|---|---|
| **K1** `apply-sequence` inverted the reducer's locked convention | The contract and T071 said "refused if **any** affected element is locked". `partitionLocked` (`reducer.ts:47-56`) does the opposite everywhere else — apply to the movable members, report the rest — and its comment says why: "returning a refusal for the whole set would let one locked element silently veto a five-element drag." A sequence is the largest multi-element edit in the editor, so it is the last place to invert that. Now: unlocked events apply, locked ones are reported, refusal only when all are locked |
| **K2** did reordering rewrite timing, or only re-label it? | Settled as **re-classify, not re-resolve**. The edge case said "the times change accordingly" — a destructive rewrite of authored timing triggered by a stacking change, with no undo until ED-5, contradicting FR-029's "stores nothing" and FR-031's "shown as Custom rather than silently reinterpreted". FR-034, the edge case, the contract's §4, T072, and T076 now all say the same thing: reordering changes what the view shows; only `apply-sequence` writes |
| **K3** the premise was far broader than the mechanism | Events sort by `startMs` first and by paint order only as a tie-break (R-06); `reorder` swaps adjacent `zIndex` (`resolve/index.ts:61`). So reordering three elements at 0/1000/2000 changes "previous" **not at all** — it matters only among events sharing a start time, which is exactly the case `Effect.order` is stored explicitly to make deterministic. Stating the narrow scope is what stops K2's destructive reading from sounding reasonable, which is how it survived five reviews |
| **K4** `focus.test.tsx` untracked and its scale understated | Added to the single-owner table (T035, T091). T035 now names the block it must rework: `describe('the authoring-time scrub (FR-037)')` is **five** tests — a real control, labelled rather than a bare number, value with units, changes the time when operated, spans the duration. Those are the playhead's requirements restated, so they **migrate** rather than being deleted |
| **K5** the timeline's focus model unstated | T090 requires a deliberate choice. The editor has no roving tabindex anywhere — feature 005's canvas "uses real buttons, so focus and activation come from the platform" — so inherited unchanged, a keyboard user tabs through every track on T004's dense slide to reach the transport. One tab stop with arrow traversal, or the per-control model on purpose; either is defensible, unstated is not |

## Remediation applied after the seventh `/speckit-analyze`

This pass checked the render harness and the slide-change path, neither touched by the first six.
**New T020**; T028, T059, and the single-owner table changed.

| Finding | Change |
|---|---|
| **L1** fifteen DOM tests, no harness to run them | **New T020**, first in US1 and blocking the rest of the phase: `test/harness/editor.tsx` gains optional `timeline` and `playback` mounting, threading the writer and frame state into `EditorCanvas` and exposing the playback handle. T006's `harness/timeline.ts` is slide *fixtures*, a different thing. Constitution II's "failing test first" only means something if the test can be run, and none of T021–T092's DOM tests could |
| **L2** "born clamped" read as "always clamped" | T059 marks the window clamp a **default, not an invariant**: `set-effect` must not clamp, or T057's edge case — an effect starting after its element has gone is authorable, and the timeline says it would never run — becomes unreachable. An implementer copying the clamp into the reducer is the likely mistake |
| **L3** slide change would desynchronise the clock | T028 *(g)* no longer lists a slide change among things that "go through `seek`" — it is not a seek, it rebuilds the transport. Its own sequence: clear the writer, build the new transport, **seek it to that slide's restored authoring time**, write once. The session keeps time per slide (`useEditorSession.ts:97`, FR-012 from feature 005), so a fresh transport at zero would render 3 000 ms against a clock saying 0, and the first `play()` would jump the canvas backwards |
| **L4** the harness untracked | Added to the single-owner table |


---

## Notes

- `[P]` means different files and no dependency on an incomplete task
- Every test task must **fail** before its implementation task starts (Constitution II, NON-NEGOTIABLE)
- Mark each task `[X]` as it completes
- If a suite in `test/timeline/` or `test/sequence/` starts reaching for the DOM, rename it away from `*.pure.test.ts` deliberately rather than letting it quietly grow the dependency — that filename is what keeps the pure half testable with no browser
- Two things this feature must not do, both of which would be the drift signal the specification named: introduce a second clock, or change the resolver
