# Tasks: Preview Harness

**Input**: Design documents from `/specs/007-preview-harness/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required, not optional. Constitution II is NON-NEGOTIABLE and names playback timing among
the things that MUST be developed test-first. Every test task below precedes its implementation and
must **fail first**.

**Organization**: By user story, so each is independently deliverable. The cut line the
specification recorded in advance is US5 — see Implementation Strategy.

**Revised after nine `/speckit-analyze` passes**: 63 tasks, up from 60. Three added and forty-two
sharpened; the changes are listed under Remediation applied at the end of this file. The
specification gained two requirements along the way — FR-024 and FR-030 — and the renumbering they
caused.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task — except that several `[P]` tasks below deliberately share one test file, writing independent `describe` blocks into it (T010/T011, T022–T024, T029/T030, T035–T038, T043/T044). Feature 006 did the same in eight files and shipped. It looks like a defect on every reading and is not one
- **[Story]**: US1–US5, on user-story phases only

## Path conventions

- Editor source: `packages/studio/src/` · Editor tests: `packages/studio/test/`
- **`*.pure.test.ts` runs in the `node` project**; everything else under `test/` runs with happy-dom
- Adapter: `packages/react/src/`, `packages/react/test/`
- Tooling: `tools/scripts/`

---

## Phase 1: Setup

- [X] T001 Create `packages/studio/src/preview/constants.ts` with `PREVIEW_PRESETS` — `desktop: 1280`, `tablet: 834`, `mobile: 390` — each with a comment stating what it is for **and which floor it sits on**. Desktop matches the Constitution's authoring target; the other two are the common logical widths of a tablet and a phone in portrait — and they happen to land correctly, which is worth checking rather than assuming. Against a 1600-wide canvas the floors are 960 px (captions), 800 px (UI text), and 600 px (body text), so **desktop 1280 clears every floor, tablet 834 crosses the caption floor, and mobile 390 crosses all three**. That spread is the point: a preset above every floor shows the teacher nothing, because the lesson scales proportionally and a smaller preview is otherwise the same picture (FR-024). Note in the file that the numbers are chosen against the floors rather than against devices, and that a lesson with a different canvas has different floors — a 9:16 lesson is 900 wide
- [X] T002 [P] Create `packages/studio/test/harness/preview.ts` — lesson fixtures the preview suites need: a multi-slide lesson, a slide gated by a required question, a slide gated by media, a slide whose `after_media_ends` names an element that is not there (unreachable), a slide carrying an image element, and a one-slide lesson. Use the `fx-` id prefix as `harness/corpus.ts` does, so fixture ids never collide with `countingIds()`. **Then the thing the preview suites cannot run without: a full-`Ports` fake.** `Ports` has six members — `time`, `media`, `visibility`, `storage`, `assets`, `analytics` (`packages/core/src/ports/index.ts:22`) — and `LessonPlayerClient` either takes all of them or builds `browserPorts()` itself, in which case there is no clock a test can advance. The studio's existing `fakePorts()` supplies **two** and must stay that way: `usePlayback` is typed to `Pick<Ports, 'time' | 'visibility'>` and widening it in place would change a signature four feature-006 suites depend on. So this is a second export beside it — `fakePlayerPorts()`, with a hand-advanced clock, a scripted media port, and inert storage, assets, and analytics — modelled on `packages/react/test/harness/ports.ts`'s `testPorts()`, which is the right object and is not exported from `@cuestack/react`'s `src/index.ts`, so it cannot be imported across the package boundary. Constitution II names substitutability and `usePlayback`'s own comment states the rule: "Substitutable so a test can hand-advance the clock". This one supplies a **full** `Ports` deliberately, including the scripted media port — under T005's per-member merge a full object still wins outright, which is what keeps a test from reading a DOM with no decoder behind it. Production passes a partial; tests pass the whole thing

**Checkpoint**: fixtures exist for every state the preview must handle, including the two that cannot be reached from the editor's own UI.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the two props outside this feature's directory. Both are additions to packages a
learner loads, so both are guarded before they are made.

**⚠️ No user story work can begin until this phase is complete.**

- [X] T003 Write `packages/react/test/playback/override-absent.test.tsx` **first**: mount `LessonPlayerClient` with **no** `overrideAdvance` prop over a slide gated by a required question, drive time past its duration, and assert it does **not** advance. Must fail only if someone later makes the override reachable by default. This is the guard the option's own comment demands — "a test affordance that leaks into playback is worse than none, because it will eventually fire by accident (FR-025)"
- [X] T004 Write the positive half of `packages/react/test/playback/override-absent.test.tsx`: with `overrideAdvance` set, the same slide advances and the decision's cause is `'override'`. **And the ports half**, in the same file: mounting with a *partial* `ports` — analytics only — leaves the DOM media port in place, so a media-gated slide still satisfies; mounting with a full `ports` carrying a scripted media fake still wins outright. Both are T005's fallback change, and the first is the one the preview depends on. Must fail before T005
- [X] T005 Add `overrideAdvance?: boolean` to `LessonPlayerClientProps` in `packages/react/src/player/LessonPlayerClient.tsx`, construct the controller with `allowOverride: overrideAdvance !== undefined`, and read the **current** value through a ref when building signals. Two mechanics, both consequences of the controller being built once in a mount effect while the switch is live: presence of the prop marks a preview host, and the ref keeps FR-020's "turning it off restores every gate immediately" true. Name it after what it does — **not** `previewing` — so the player gains no editor concept. Update `AdvanceControllerOptions`' and `AdvanceSignals`' comments from "test-only" to "test and preview": this is a documentation change to a contract that anticipated the consumer, since FR-ADV-011 predates Wave 1. **In the same file, make `ports` a per-member override rather than a replacement** — widen it to `Partial<Ports>` and change the fallback from `ports ?? { ...browserPorts(), media: createDomMediaPort({ nodeFor }) }` to `{ ...browserPorts(), media: createDomMediaPort({ nodeFor }), ...ports }` (`:311-315`). Today it is all-or-nothing, and the preview needs browser ports **and** the DOM media port **and** a discarding analytics adapter (R-09) — a combination the prop cannot express, because `createDomMediaPort` closes over the writer created inside this component (`:201`) and exposed to nobody. Without this, a preview that overrides analytics silently loses media: `media.query()` returns null for every element, so nothing plays, slides gated on `after_media_ends` never satisfy, and the teacher gets the gesture prompt followed by silence. **The comment's intent is preserved and should stay**: "a caller-supplied `ports` wins outright: a test handing in a scripted media fake must not have it replaced by one reading a DOM that has no decoder behind it" — with `...ports` last a scripted fake still wins, and every existing test supplies a full `Ports`, so nothing changes for them. Reword it to say *per member*. This also closes a trap nobody has hit: any host supplying ports today to set analytics already loses DOM media
- [X] T006 Write `packages/studio/test/canvas/assets.test.tsx` **first**: a resolver passed to `EditorCanvas` reaches the rendered element, and passing none falls back to `defaultAssetResolver`. Must fail
- [X] T007 Add `resolveAsset?: AssetResolver` to `EditorCanvasProps` in `packages/studio/src/canvas/EditorCanvas.tsx` and pass it to `SlideView`, which has accepted one since Wave 3. **This closes a gap in the editor, found by asking a question about the preview**: a host supplying a resolver to `<LessonPlayer>` has never been able to supply one to the canvas, and it looked correct only because the reference lesson's asset ids are opaque and nothing serves them

- [X] T008 Finish feature 006's T029 part *(iv)*, which shipped incomplete: add `effects?: EffectRegistry` to `EditorCanvasProps` in `packages/studio/src/canvas/EditorCanvas.tsx` and pass it as `ResolveContext.effects` to the render-time `resolve`, which is still called with two arguments (`EditorCanvas.tsx:106`). `InspectorProps` and `EffectControlsProps` both received it; the canvas did not — so a host registering a ninth effect gets it **offered in the menu and rendered as `UNKNOWN_EFFECT_TYPE` on the canvas**, which is exactly the defect that requirement was raised to prevent. It escaped because feature 006's ninth-effect test called `resolve(slide, 500, { effects: registry })` **directly** rather than through the canvas: the path that works was tested, not the path a host takes. Write the canvas-level test first — mount `EditorCanvas` with a host registry and assert no `UNKNOWN_EFFECT_TYPE` — and amend feature 006's T029 to record that it shipped incomplete. **This feature inherits the gap**: FR-027's parity claim cannot hold for a host's effects while the canvas cannot be told about them

**Checkpoint**: the player can be told to allow an override and cannot be tricked into one; the editor can be told what an asset id means. Both are additive and both have a guard.

---

## Phase 3: User Story 1 — A teacher watches their lesson as a learner would (Priority: P1) 🎯 MVP

**Goal**: the promise becomes checkable. The editor mounts the player over the draft, with no editing chrome, and closing returns the teacher to where they were.

**Independent Test**: open a lesson, start a preview, confirm it plays with no editing affordances visible, close it, confirm the editor is unchanged.

- [X] T009 [US1] Extend `packages/studio/test/harness/editor.tsx` with a `preview` option that mounts `<Preview>` **inside the tree**, threads T002's `fakePlayerPorts()` into it, and exposes its handle and that clock beside `session`. Not parallel: it is the first task of this phase and every DOM test below mounts through it. It will not compile until T015 lands, which is what "must fail first" means here — the harness is authored against the component's intended shape rather than retrofitted to whatever it becomes. The file's own header records why mounting inside the tree is not optional: a hook rendered outside passes one stale snapshot as a prop

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T010 [P] [US1] Write `packages/studio/test/preview/mounts.test.tsx`: the preview renders lesson content, and **no editor markup at all** — no `.cs-overlay`, `.cs-track`, `.cs-timeline`, `.cs-sequence`, or inspector (FR-004, SC-004). Assert it as a *negative* query, because "looks like the player" is not checkable and "contains no element carrying an editor class" is
- [X] T011 [P] [US1] Write the control for that negative in `packages/studio/test/preview/mounts.test.tsx`: render `EditorCanvas` instead and confirm the same query finds plenty. A test that would pass against an empty document is not testing anything
- [X] T012 [P] [US1] Write `packages/studio/test/preview/draft.test.tsx`: an edit applied and not saved appears in a preview opened afterwards (FR-002), and no editor state — selection, time scale, open view, authoring time — reaches the preview (FR-005)
- [X] T013 [P] [US1] Write `packages/studio/test/preview/assets.test.tsx`: a host resolver given to the editor reaches the preview and the real asset is requested (FR-003); a resolver returning nothing produces the player's own recoverable error state rather than a placeholder (FR-PLY-011/012)
- [X] T014 [P] [US1] Write `packages/studio/test/preview/lifecycle.test.tsx`: closing returns the editor to the slide, selection, and authoring time it held (FR-006, SC-010); focus moves into the preview on open and back to the control that opened it on close (FR-007); closing while playing stops the clock (edge case). **Two more, both added in the fifth pass because the spec stated them and nothing delivered them.** *(i)* **Opening while the editor is playing stops the editor's clock first** — assert the editor's playback is paused and its authoring time is the moment the preview opened, then that closing restores exactly that (edge case, FR-006). Two clocks over one slide are two answers to what time it is. *(ii)* **The editor behind is unreachable** (FR-030): the preview is a `<dialog>` opened with `showModal()`, so assert that — happy-dom implements the call but not the top layer's focus containment, so this asserts the mechanism is in place, not that Tab was blocked. Say which of the two is being checked, the same honesty quickstart §8 uses about layout. The focus half follows feature 005's delete confirmation, which asserts each direction separately. **Two assertions that would have caught the defect this feature nearly shipped**: the close control is reachable **at the completion state**, and reachable **while a gesture prompt is showing**. The player replaces `children` at both moments (`LessonPlayerClient.tsx:645-651`), so a preview whose frame lived there would strand a teacher at the end of their own lesson with nothing but Review

### Implementation for User Story 1

- [X] T015 [US1] Implement `packages/studio/src/preview/usePreviewSession.ts` — `{ startPoint, overrideAdvance, preset, state }`, all session state that dies with the preview (data-model §3). `overrideAdvance` is **false at every open**; nothing here is serialized
- [X] T016 [US1] Implement `packages/studio/src/preview/Preview.tsx` — mounts `<LessonPlayerClient>` over `session.draft` with the editor's `resolveAsset`, **`autoPlay`**, and an optional **`ports`** passed straight through. That last one is not a convenience: it is the only way a test can hand-advance the clock, since a player given no ports builds `browserPorts()` and there is nothing to advance. Constitution II is NON-NEGOTIABLE about this and `usePlayback` already carries the precedent, comment and all — "Substitutable so a test can hand-advance the clock". A production host passes nothing and gets the browser's, exactly as the player does today — **except for one member, which the preview replaces either way**. `LessonPlayerClient` records `lesson_started` on mount and `slide_started`, `slide_completed`, and `lesson_completed` as the lesson runs (`:326`, `:376`, `:470`, `:477`), so a preview that passed the host's ports straight through would report a teacher's checking as a learner's progress — and under US4's override, completions nobody earned. So the preview passes **only** `{ analytics: discarding }` (FR-031) — a partial, which T005 makes meaningful. It must not pass a whole `Ports`: the player builds the DOM media port over its own frame writer, which nothing outside can reach, so replacing the object wholesale would leave the preview silent and stall every media-gated slide. It is inert today only because `browserPorts()` uses the in-memory adapters, and that file's own comment names the path out of that: "a host that wants persistence supplies its own ports" (`browserPorts.ts:16-18`). Structural beats remembering. **Note also what `ports` does not carry**: assets. `Ports.assets: AssetAdapter` is declared (`core/src/adapters/index.ts:43`) and read by nobody — resolution runs entirely through the `resolveAsset` prop (`SlideView.tsx:48`). Wiring the port would do nothing. That is the **sixth** contract member this wave has found declared without a producer, after `ElementPlugin.inspector`, `EffectDescriptor.parameters`, `RenderState.problems`, `ResolveContext.effects`, and `AdvanceControllerOptions.allowOverride` — and unifying the two asset paths is a kernel decision, not a preview one, so this task only records it. **The chrome is split, and this is the decision the whole component turns on.** The player renders `children` inside a ternary: `complete ? <LessonComplete/> : gestureGiven ? children : <GesturePrompt/>` (`LessonPlayerClient.tsx:645-651`). So anything passed as `children` **disappears when the lesson completes and while a gesture prompt is showing** — and if the Close button lived there, a teacher reaching the end of their lesson would have no way out but replaying it. **The question is not what needs the transport — it is what must survive that ternary.** The preview holds the transport in a ref regardless, because T027 captures it in `onReady` to perform the start-point seek, so the frame can drive it. Therefore: *(a)* **inside, as `children`**, go the controls that are only meaningful while the lesson is playing — play, pause, seek, previous, next. They read `usePlayer`, and the prop's comment is right that a host holding its own transport would be "a second idea of the current time"; *(b)* **outside, in the frame**, goes everything that must stay reachable at the completion state and behind a gesture prompt — close, **restart**, the override switch, its indicator, and the viewport preset. Restart is the one that makes the distinction matter: it needs the transport *and* US3 §7 requires it at the completion state, so a rule about transport access would have put it in the half that disappears. **`autoPlay` has a visible consequence worth expecting**: `needsGesture = autoPlay && hasAudibleMedia(lesson)` (`LessonPlayerClient.tsx:233`), so previewing a lesson with audio shows the gesture prompt before anything plays. That is correct and is what a learner gets — and with the frame outside, the teacher can still close. **Opening stops the editor's own clock first** (edge case, FR-006). `usePlayback` runs `useFrameLoop` for as long as its state is `playing` (`usePlayback.ts:139`) and writes custom properties every frame; nothing about mounting a preview stops it, so a preview opened mid-playback would run two clocks and two frame loops over the same slide, and the authoring time FR-006 promises to restore would move while the teacher watched. Call the session playback's existing `pause()` — it commits the moment through the one write path already — so "the time it held before" resolves to the moment of opening. **No player component is forked, wrapped, or reimplemented** (FR-001, FR-013, FR-015, R-01)
- [X] T017 [US1] Give `packages/studio/src/preview/Preview.tsx` modal behaviour (FR-007, FR-030): it covers the editor, takes focus on open, returns focus to the opener on close, and is dismissible by keyboard. **Covering is not enough, and the mechanism is `<dialog>` with `showModal()`.** Tab does not respect z-index. Every key handler in the studio is element-scoped (`onKeyDown` in `Track.tsx`, `Overlay.tsx`, `TextEditSurface.tsx`; there are no document- or window-level listeners), so focus is the entire path into an edit: without containment a teacher tabs out onto a timeline bar where an arrow key nudges by `NUDGE_MS` immediately, and the edit is invisible besides, because the preview holds the draft as it stood at open. **`inert` on the editor is not available to this package**: the studio exports parts a host composes — `EditorCanvas`, `usePlayback`, the timeline, the inspector — and has no editor root `Preview.tsx` could reach without touching a tree it does not own. A modal `<dialog>` needs none: the platform puts it in the top layer and makes everything outside inert, contains focus, and closes on Escape, which is FR-007's "dismissible by keyboard" for free. happy-dom 20.11.2 implements `showModal()` but not the top layer's focus semantics, so the test asserts the element is a `<dialog>` and that it is open — say which of the two is being checked. Feature 005's delete confirmation is a `role="alertdialog"` div that moves focus without containing it — right for two buttons, not for a surface a teacher sits in for minutes. **State the focus contract, because the split chrome gives the preview two focusable regions**: opening moves focus to the frame; closing returns it to the Preview button in the editor, *wherever focus was inside* — including inside the player's own controls or the completion state. Feature 005's delete confirmation is the precedent and is simpler, being one dialogue; this needs the rule written down. FR-006 must need **no restore code** — the preview never touches the session, so there is nothing to put back; if the implementation grows a snapshot, the modal promise has leaked
- [X] T018 [US1] Add preview styles to `packages/studio/src/styles/editor.css` using theme tokens only — no colour literals (Constitution III). The gate cannot see CSS, so this is convention-enforced; say so in the file as the existing sections do
- [X] T019 [US1] Add a Preview control to the example editor route at `examples/nextjs/app/edit/editor-view.tsx`, and confirm the stylesheet import in `app/edit/layout.tsx` still covers it. Feature 005 shipped an overlay that swallowed clicks because a stylesheet was not imported
- [X] T020 [US1] Export `Preview`, `usePreviewSession`, and `PREVIEW_PRESETS` from `packages/studio/src/index.ts`

**Checkpoint**: US1 is independently functional. A teacher can watch their lesson as a learner would, and the editor is untouched by it.

---

## Phase 4: User Story 2 — A teacher checks the moment they are working on (Priority: P2)

**Goal**: the preview starts where the teacher is, not at the lesson's beginning.

**Independent Test**: put the playhead at a known moment on a known slide, preview from there, confirm playback begins at that moment.

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T021 [P] [US2] Write `packages/studio/test/preview/startPoint.pure.test.ts`: `startPointFor` returns `(0, 0)` for the beginning, `(slide, 0)` for the current slide, and `(slide, authoringTime)` for the current position (FR-008–FR-010); an unknown slide id falls back to index 0 rather than throwing. Pure, in the `node` project — a start point is a lookup and an arithmetic, and if it needs a DOM something has been threaded that should not have been
- [X] T022 [P] [US2] Write `packages/studio/test/preview/start.test.tsx`: previewing from the current position begins at that moment on that slide, and the canvas shows what a learner would see there (FR-010)
- [X] T023 [P] [US2] Write the continuation half of `packages/studio/test/preview/start.test.tsx`: a preview started mid-lesson runs on into the next slide under that slide's own advance rule (FR-011), driven by the studio harness's `runFrames(ports, ms, stepMs = 100)` against T002's `fakePlayerPorts()` clock, not by waiting. **Say which one and mind the step**: two helpers of that name exist — the studio's takes `{ advance(ms) }` (`test/harness/editor.tsx:134`) and `@cuestack/react`'s takes `TestPorts` and calls `ports.clock.advance` (`test/harness/frames.ts:16`) — and the 100 ms default is not decoration: `createClock` caps a single tick at `CLAMP_CEILING_MS = 250`, so one 2 500 ms jump yields 250 ms of lesson time. Feature 006 lost time to exactly this
- [X] T024 [P] [US2] Write the restart half of `packages/studio/test/preview/start.test.tsx`: restart returns to the position **the preview began at**, not the lesson's beginning and not the slide's zero (FR-012). This is the assertion most likely to be got wrong by reusing the player's own restart, which returns to the slide's zero

### Implementation for User Story 2

- [X] T025 [P] [US2] Implement `startPointFor(session, from)` in `packages/studio/src/preview/startPoint.ts` — pure, no DOM, returning `{ slideIndex, atMs }`. It holds the only translation between the editor's vocabulary (slide **ids**, because the session keys per-slide state by id) and the player's (slide **indices**, because a lesson is an ordered array); stating it once means the mismatch is written down rather than assumed at each call site
- [X] T026 [US2] Capture the start point **once**, when the preview opens, in `packages/studio/src/preview/usePreviewSession.ts`. That single word does three jobs: a value that cannot change cannot drift (FR-012), the editor is never modified so closing restores nothing (FR-006), and everything after the seek belongs to the player (FR-011)
- [X] T027 [US2] Seek to the start point through the transport `onReady` hands back, in `packages/studio/src/preview/Preview.tsx`. `onReady` exists so a host can drive playback, and a preview is a host — this is what turns a starting *slide* into a starting *moment* with no new mechanism (R-01). **`onReady` and `ports` must be memoised**, and the seek must be idempotent. The player's mount effect lists both in its dependencies (`LessonPlayerClient.tsx:533`), so an inline arrow — the natural way to write this — gives a new identity every render and tears the effect down and back up: a fresh transport, a fresh controller, `writer.clear()`, and `play()` again. The preview would restart continuously, and it would look like a timing bug rather than a dependency one
- [X] T028 [US2] Offer all three ways to open — from the beginning (FR-008), from the current slide (FR-009), from the current position (FR-010) — in `packages/studio/src/preview/Preview.tsx` and `examples/nextjs/app/edit/editor-view.tsx`. **SC-002 is the measure**: going from editing to watching the current moment must be one action, so the third is a control in its own right rather than a setting reached through the first

**Checkpoint**: US1 and US2 both work. A teacher checking a fade at four seconds into slide three sees it without watching two minutes of lesson.

---

## Phase 5: User Story 3 — A teacher drives the preview (Priority: P3)

**Goal**: play, pause, scrub, jump between slides, restart, close — and the ending.

**Independent Test**: with a preview open, use each control and confirm it does what it says.

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T029 [P] [US3] Write `packages/studio/test/preview/controls.test.tsx`: play holds, pause holds the moment, scrubbing shows the moment under the control, and next and previous each play from that slide's start (FR-013)
- [X] T030 [P] [US3] Write the boundary half of `packages/studio/test/preview/controls.test.tsx`: previous is unavailable on the first slide and next on the last, each **saying why** rather than being inert (FR-014); a one-slide lesson has both unavailable (edge case)
- [X] T031 [P] [US3] Write `packages/studio/test/preview/completion.test.tsx`: playing to the end shows the lesson's completion state (FR-015), the preview **stays open** until the teacher closes it, and **restart is reachable and works from there**, replaying from the preview's start (US3 §7, FR-012). That last assertion is the one that catches a restart placed in `children`: it would be absent at exactly the moment this exercises it — the same defect close nearly shipped with, one control later. Assert close is reachable there too. **Then the assertion about what it restarts into** (FR-032): answer the required question, play to the end, restart — and the question is unanswered and gates the slide again. A restart implemented as a seek passes every other assertion in this file and fails this one, which is the entire reason it is here

### Implementation for User Story 3

- [X] T032 [US3] Implement `packages/studio/src/preview/PreviewControls.tsx` (FR-013, FR-016) — compose the player's own `PlaybackControls` for play, pause, and seek, and add the two the player has no opinion about: previous and next. This component is the **inside** half of T016's split: play, pause, seek, previous, next — the controls that are only meaningful while the lesson is playing. It renders as `children` and may therefore use `usePlayer`. Previous and next are `transport.goToSlide`, which exists; what this task writes is the arrangement and the boundary states. **Close and restart do not live here** — both must be reachable at the completion state, where `children` is replaced, so both belong to the frame. `goToSlide` past the last index sets the transport to `completed`, so next must be *unavailable* at the end rather than calling it — which T030 already requires, and this is the reason. **Previous and next deliberately keep the learner's answers**: `goToSlide` bumps the visit count so `instanceId` changes and the advance controller re-decides the slide, while the answers persist — which is exactly what a learner moving within one run would experience. Only restart is a fresh run (FR-032). Do not add a reset here
- [X] T033 [US3] Keep the preview open at the end of the lesson, in `packages/studio/src/preview/Preview.tsx` (FR-015, SC-013). **The completion state arrives from the player** — `LessonPlayerClient` renders `<LessonComplete>` itself when the lesson finishes (`LessonPlayerClient.tsx:645`), so rendering one here would double it. What this task owes is that the preview's own frame stays reachable at that moment, which is what T016 *(b)* makes possible: `children` is replaced by the completion state, and the frame is not `children`. Closing on the teacher's behalf would make the ending the one part of a lesson a preview refuses to show. **Record that the completion screen's "Review" differs from the preview's Restart, deliberately**: `onReview` calls `goToSlide(0)` then `play()` (`LessonPlayerClient.tsx:243-247`) — the *lesson's* beginning — while FR-012 sends Restart to the *preview's* start. That is the lesson's own affordance behaving as a learner's would, which is what a preview is for; two buttons doing different things is only confusing if neither says which
- [X] T034 [US3] Implement restart **in the preview's frame** in `packages/studio/src/preview/Preview.tsx`, seeking to the captured start point through the transport ref rather than delegating to the player's own restart, which returns to the slide's zero (FR-012, FR-013). It belongs to the frame and not to `PreviewControls.tsx` because US3 §7 requires it **at the completion state**, where `children` is replaced — the same reasoning that moved close out, one control later. **Restart is a fresh run, not a seek** (FR-032), and that changes the mechanism: seeking alone would replay a lesson whose gates are all already satisfied. The learner's answers live in `useInteractions`' component state and the `Interactions` interface exposes **no reset** (`useInteractions.ts:19-29`), while `hasIncompleteRequiredInteraction` reads `signals.completedInteractions` (`conditions.ts:40-44`) — so an answered question stops gating for good. And the advance controller keys decisions by `instanceId` in a private `Set` (`controller.ts:76,80,90`) where `instanceId` is `` `${slide.id}#${visitCount}` `` (`transport.ts:51-53`); `restart()` calls only `clock.reset(0)` and emits (`:140-143`), so the count does not move and the slide is **never re-decided**. So: **key `<LessonPlayerClient>` on a restart counter**. Remounting discards the interaction state, the controller, and the transport together, and `onReady` re-seeks to the captured start point through the path T027 already builds — no new player API, and no reaching into a controller the preview does not own (T042). Note the symmetry with T027's warning: an unmemoised `onReady` causes this teardown *by accident*, and restart wants it *on purpose*. Do not let the two mechanisms merge

**Checkpoint**: the preview is a test rather than a video.

---

## Phase 6: User Story 4 — A teacher tests a lesson that would otherwise trap them (Priority: P4)

**Goal**: one switch past every gate, and a dead-end lesson reported to its author.

**Independent Test**: preview a slide gated by a required question, turn on the override, confirm the lesson advances, close, confirm the lesson is unchanged.

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T035 [P] [US4] Write `packages/studio/test/preview/override.test.tsx`: the switch lets a slide gated by a required interaction through, and a **second and third** gated slide through without being asked again (FR-017, SC-008). One action, not one per gate — that is the property clarification chose the switch for, and it would otherwise go untested
- [X] T036 [P] [US4] Write the lifecycle half of `packages/studio/test/preview/override.test.tsx`: the switch is off at every open (FR-018), turning it off restores every gate immediately (FR-020), and it is gone when the preview reopens
- [X] T037 [P] [US4] Write the indicator half of `packages/studio/test/preview/override.test.tsx`: while the switch is on the preview says so **continuously**, not once (FR-019). A switch that lasts is a switch that gets forgotten, and a teacher who forgets will conclude the lesson works when what worked was the switch
- [X] T038 [P] [US4] Write the byte-identity half of `packages/studio/test/preview/override.test.tsx`: after any amount of overriding, the lesson is byte-identical to what it was before (SC-008, FR-018) — **and the analytics adapter recorded nothing** (FR-031). Pass a recording adapter through T016's `ports` seam, override past three gated slides to the end, and assert the event list is empty. This is the assertion that catches the leak, and the override is where it matters most: every gate skipped would otherwise report a `slide_completed` no learner earned. It passes trivially today, because `browserPorts()` uses in-memory adapters — write it anyway, because it is the day a host wires real telemetry that it earns its keep
- [X] T039 [P] [US4] Write `packages/studio/test/preview/reachability.test.tsx`: a slide whose `after_media_ends` names an element that is not there is reported to the **teacher**, naming the slide and the reason, in the kernel's own wording (FR-021, SC-011, NFR-USA-004)

### Implementation for User Story 4

- [X] T040 [US4] Add the override switch to the preview's **frame** in `packages/studio/src/preview/Preview.tsx` — outside the player, per T016 *(b)*, not to `PreviewControls.tsx` — and thread it to `LessonPlayerClient`'s `overrideAdvance`. A switch that vanished at the completion state or behind a gesture prompt would be a switch a teacher could not turn off. Nothing new decides whether a slide may advance: the controller's short-circuit already outranks BR-005's required-interaction gate, which is exactly what lets a teacher past a question they have not answered (R-03)
- [X] T041 [US4] Implement the continuous indicator in the preview's frame in `packages/studio/src/preview/Preview.tsx` — findable at any moment, not a notification that has gone by the time the teacher reaches the slide they were testing, and **not inside `children`**, where the completion state would replace it exactly when a teacher is judging whether the lesson works (FR-019)
- [X] T042 [US4] Report reachability in `packages/studio/src/preview/Preview.tsx`, rendering nothing when there is no problem. **The preview must build its own controller for this**: `LessonPlayerClient` constructs one internally and `PlayerContextValue` exposes only `transport` and `slideDurationMs` (`usePlayer.ts:16,24`), so there is none to borrow. `createAdvanceController(ports).reachability(slide)` is safe for exactly this — it is a query over the slide and the media port, with no state. **It must not be wired to `evaluate`**, which keys decisions by `instanceId` and would double-decide against the player's own controller. The editor still detects nothing: `checkReachability` has existed since Wave 1 and Wave 3 wired it to the learner; this is its second *consumer* (R-08, FR-021, SC-011, NFR-USA-004). PB-1 still owns blocking a publish

**Checkpoint**: no slide can trap a teacher testing the one after it, and a lesson that strands a learner is visible to its author for the first time.

---

## Phase 7: User Story 5 — The preview says what a learner would see, at what size (Priority: P5)

**Goal**: desktop, tablet, and mobile sizes, chosen so the type floor is what they reveal.

**Independent Test**: preview at each preset and confirm the lesson renders at that size with no element repositioned in the manifest, and that at tablet and mobile the type held at the legibility floor is visibly larger than the authored proportion.

### Tests for User Story 5 ⚠️ write first, must fail

- [X] T043 [P] [US5] Write `packages/studio/test/preview/viewport.test.tsx`: each preset sets the width of the preview's **viewport wrapper** (FR-022) — not "the stage container", which names the element the preset must specifically not touch, since `.cs-stage` *is* the container (`container-type: size; container-name: cs-stage`) — the manifest is **byte-identical** before and after (FR-023), and the lesson's aspect ratio is untouched. **Then the assertion with a number in it, which is the only one that can fail for a reason a teacher cares about** (FR-024): assert each preset's width against the floor it crosses. Body text is `max(12px, var(--cs-theme-font-size, 32) / var(--cs-canvas-w) * 100cqw)` (`stage.css:113`) and a 16:9 canvas is 1600×900 (`tokens.ts:26`), so the floor bites below **600 px**; captions are `20/1600` → below **960 px** (`:154`); UI text `24/1600` → below **800 px** (`:174`, `:212`). So captions and UI labels are already off-scale at tablet and body text at mobile. Without this the other three assertions pass on a preview that changed nothing a teacher could see
- [X] T044 [P] [US5] Write the non-persistence half of `packages/studio/test/preview/viewport.test.tsx`: the chosen preset does not survive the preview closing and reopening, and never appears in a saved manifest (SC-005)

### Implementation for User Story 5

- [X] T045 [P] [US5] Implement `packages/studio/src/preview/ViewportPreset.tsx` — a control in the preview's frame that sets **the width** of the preview's own wrapper around the player — not a maximum, and not the stage. **A maximum would size nothing**, because T017 makes the preview a `<dialog>` and the HTML spec's suggested rendering gives dialog `width: fit-content`: the dialog would size to its contents, the wrapper's `max-width` would cap something with no width of its own, and the stage's `width: 100%` would resolve against a fit-content ancestor — leaving the preview as wide as the control row happens to be. So the dialog takes the viewport with `max-width: none`, and the wrapper takes `width: <preset>; max-width: 100%`. `Stage` renders `.cs-stage` inside `LessonPlayerClient`, so a control outside cannot style it directly — and does not need to: geometry is logical and the stage scales through container query units, so constraining the wrapper makes the lesson rescale itself. That is why FR-023's "no stored geometry changes" is true by construction rather than by care (R-05). **Choose the preset widths against the floors, not against device marketing numbers** (FR-024): the widths are the feature, and one that sat above every floor would produce a smaller identical picture. Desktop above 960 px, tablet between 600 and 960, mobile below 600, for a 1600-wide canvas — and derive them from the canvas rather than hard-coding, since a 9:16 lesson is 900 wide and its floors sit elsewhere
- [X] T046 [US5] Add preset styles to `packages/studio/src/styles/editor.css`, theme tokens only. Record in the file what this **is** — a width on the preview's viewport wrapper, and nothing else, because the stage rescales itself through container query units — and that the `<dialog>`'s own UA `width: fit-content` must be overridden here or the preset has nothing to act on — and what it deliberately is **not**: no touch simulation, no user-agent spoofing, no device chrome — emulation that is not faithful is worse than none, because it invites conclusions it cannot support

**Checkpoint**: all five stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T047 Extend `packages/studio/test/parity/renderers.test.tsx` — a **new file in the existing `test/parity/` directory**, beside the suites feature 005 already wrote. Compare the **static** and **interactive** renderer sets over one manifest: `staticRenderers` and `builtinRenderers` are the same seven objects except one, `staticQuestionRenderer` against `questionRenderer` (`elements/builtin/static.ts:23`), so that single element is the whole divergence surface — and it is where feature 005 found a real one, the submit control on a canvas that should not have had it. Assert that both render the question's **content** identically — its text, its options, its geometry — while the interactive set alone adds the controls a learner needs and an author does not. Drive the seven types from the registry so an eighth cannot arrive unnoticed (FR-027, FR-028, SC-001)
- [X] T048 Run the **existing** parity suites from `tools/scripts/gates/parity.mjs` as well as T047's: `test/parity/overlay.test.tsx` already asserts the editor's render layer is byte-identical to the player's with the overlay subtracted — across all seven types, with a selection active, with a ghost present — and `geometry.test.tsx` covers geometry, rotation, and paint order. Feature 005 even guarded the tautology this feature nearly repeated: *"changes with time, so the equality above is not vacuous"*. The gate's job is to run what exists plus what T047 adds, not to re-derive it. Arm `tools/scripts/gates/parity.mjs`, following `gates/a11y.mjs:32`'s shape — `execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', '@cuestack/studio', 'parity'])`: run T047's sweep, exit non-zero when it fails, and state what it checked — **naming the two renderer sets it compared**, so a reader can tell it is not comparing one with itself. **Keep its predecessor's honesty** — the armed version must still say what it does *not* check: not paint (happy-dom has no compositor), not published playback (SC-003 is a network claim), and not a host's own registered types
- [X] T049 Add the parity negative control to `tools/scripts/check-gates.test.ts`: make `staticQuestionRenderer` disagree with `questionRenderer` about the question's *content* — not about its controls, which differ legitimately — and require the gate to go red naming the element type (SC-012). A control that instead perturbed a shared value would prove only that the kernel is shared, which nobody doubts. **This feature does not ship without it.** The project has been bitten twice by a gate green while enforcing nothing — the theme-values gate's inherited escape hatch, and feature 006's near-miss where a new lint rule would have disarmed the one beside it
- [X] T050 Write `packages/studio/test/parity/composition.test.tsx`: the preview mounts the player **unmodified** — its rendered output contains no editor markup (FR-004), and no component in `packages/studio/src/preview/` re-implements a renderer. A *composition* claim rather than a parity one, and cheap: it is what makes preview-versus-player uninteresting to compare, and asserting it is how that stays true. Read it beside `overlay.test.tsx`'s *"adds no editor prop to SlideView — the render layer takes what the player takes"*: that one guards the canvas, this one the preview.
- [X] T051 Write `packages/studio/test/keyboard/preview.test.tsx`: every action in User Stories 1–5 performed with **no pointer events** — open from each of the three start points, play, pause, seek, previous, next, restart, toggle the override, change preset, and close (SC-006)
- [X] T052 Extend `packages/studio/test/keyboard/focus.test.tsx`: every preview control shows a visible focus indicator and takes focus in a sensible order. axe cannot check a focus indicator, which is why this needs its own assertions
- [X] T053 Extend `packages/studio/test/a11y/axe.test.tsx` to the preview, its controls, the override indicator, the reachability report, and the completion state — zero violations, every interactive control named (SC-007), **and the dialog itself named — asserted directly, because the gate will not catch it**. The suite runs `runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }` (`axe.test.tsx:22`) and axe's `aria-dialog-name` rule is tagged `best-practice`, so it never runs. Do not widen the tag set for one rule; write the assertion. An unnamed modal is announced as "dialog" and nothing else, and the studio's own three — `DeleteConfirmation`, `CustomConfirmation`, `EffectControls` — all carry a label already. Name it after the lesson, so a teacher with two windows open can tell them apart. Note that this file uses `afterEach(cleanup)` for a reason recorded there: several mounted React roots eventually mint colliding `useId` values, which axe correctly reports
- [X] T054 Extend `packages/studio/test/session/no-leak.test.tsx`: start point, override switch, viewport preset, whether a preview is open, and transport state never reach a saved manifest (SC-005). Features 005 and 006 each added values to this invariant; this one adds four more and must not be the feature that breaks it
- [X] T055 Write `packages/studio/test/preview/read-only.test.tsx`: in read-only the preview opens and plays while the editor stays unmodifiable (FR-029). This is the one place read-only **widens** rather than narrows — a reviewer who cannot preview cannot review, and the preview writes nothing so there is nothing to forbid
- [X] T056 Write `packages/studio/test/preview/immutability.test.tsx`: the preview receives the manifest and no mutation path — no session `apply`, no reducer — and a draft is byte-identical after any preview session (FR-026)
- [X] T057 Write `packages/studio/test/perf/preview.test.tsx`: opening a preview on the fixture's **dense** last slide stays inside the editor's own interactive budget (NFR-PERF-001, SC-009). Since feature 006 that slide carries 55 elements; previewing a six-element slide would measure nothing, which is the trap that feature's R-09 described. Opening a preview is a mount, and it must not cost more than the editor did. **Open it while the editor is playing**, which is the expensive case and the one T016 has to handle: measured against an idle editor this budget never sees the second frame loop it is there to prevent
- [X] T058 [P] Update `docs/cuestack_framework_plan.md`: mark ED-6 delivered, record the parity gate armed, note the fifth instance of the declared-but-unproduced pattern (`allowOverride`), and record the obligations this feature discharges and the ones it does not
- [X] T059 [P] Record the two new props in `packages/react/README.md` and the studio's own documentation — `overrideAdvance` with the reason it is absent by default, and `EditorCanvasProps.resolveAsset` with the gap it closes
- [X] T060 Run the whole suite and every gate from the repository root (`package.json` scripts) — `pnpm test && pnpm typecheck && pnpm lint && pnpm gates && pnpm check:rules && pnpm check:studio-isolation` — and fix what it finds. `check:studio-isolation` is the one to watch: a preview that leaked into `@cuestack/react` would fail exactly there
- [X] T061 Execute every command in [quickstart.md](./quickstart.md) **verbatim**, including the five negative controls in §2, §4, §5, §10, and §12, and correct whatever the document got wrong. Record what the pass finds in the document itself, as features 005 and 006 did
- [X] T062 Extend `tools/scripts/gates/a11y.mjs` to run the studio project's suite as well as the player's — a second `execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', '@cuestack/studio', 'a11y'])` behind its own `existsSync` guard, matching the shape the file already uses for `packages/react/test/a11y`. **Until this lands, T053's assertions run in `pnpm test` and not in the blocking gate**, which is the gap this feature creates: the constitution's CI gate 6 reads "automated accessibility checks on learner-facing components", and a preview is learner-facing by construction — it *is* the player. The precedent is that gates follow the editor as it grows: `perf.mjs:53` already runs `@cuestack/studio test/perf` and `theme-values.mjs:39` already targets `packages/studio/src`. a11y is the one that was never extended, and it was correct not to be until now. Keep the honest-placeholder shape, so a checkout without the suite prints a reason rather than failing
- [ ] T063 Manual keyboard and screen-reader pass over quickstart.md §15's eight steps. This needs a human with assistive technology. Two things no assertion can settle: whether the override indicator is findable at the moment a teacher needs it, and whether a slide holds together at the mobile preset

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: needs Setup — **blocks every user story**. T005 blocks US4; T007 blocks US1's asset tests
- **US1 (Phase 3)**: needs Foundational. **T009 comes first and blocks the rest of the phase** — every DOM test mounts through it
- **US2 (Phase 4)**: needs US1 — it changes where the preview US1 built starts
- **US3 (Phase 5)**: needs US1; independent of US2
- **US4 (Phase 6)**: needs US1 and T005; independent of US2 and US3
- **US5 (Phase 7)**: needs US1; independent of everything else — which is what makes it the cut line
- **Polish (Phase 8)**: needs the stories being shipped. **T047–T050 need only US1** — the parity sweep compares the *canvas* with the *player*, neither of which the preview's controls touch, so the gate can be armed on the MVP

### Within each story

- Tests first, and failing, before the implementation task that satisfies them
- Pure modules before the components that render them
- The harness before the suites that mount through it

### Single-owner files

These take sequential tasks only — every task touching them is unmarked:

| File | Tasks |
|---|---|
| `packages/studio/src/preview/Preview.tsx` | T016, T017, T027, T033, T034, T041, T042 |
| `packages/studio/src/preview/PreviewControls.tsx` | T032, T040 |
| `packages/studio/src/preview/usePreviewSession.ts` | T015, T026 |
| `packages/studio/src/styles/editor.css` | T018, T046 |
| `packages/studio/src/index.ts` | T020 |
| `packages/studio/test/harness/editor.tsx` | T009 |
| `packages/react/src/player/LessonPlayerClient.tsx` | T005 |
| `tools/scripts/check-gates.test.ts` | T049 |
| `tools/scripts/gates/a11y.mjs` | T062 |
| `packages/studio/test/parity/registered.test.tsx` | T047 |

### Parallel opportunities

- T002 in Setup
- T010–T014: all five US1 test tasks, different files
- T021–T024: all four US2 test tasks
- T029–T031: all three US3 test tasks
- T035–T039: all five US4 test tasks
- T043, T044 · T045 · T058, T059

## Parallel example: User Story 1 tests

```bash
Task: "Write test/preview/mounts.test.tsx — no editor markup at all"
Task: "Write test/preview/draft.test.tsx — unsaved changes appear, editor state does not"
Task: "Write test/preview/assets.test.tsx — real assets, and the player's error state"
Task: "Write test/preview/lifecycle.test.tsx — close, focus, and the clock stopping"
```

---

## Implementation Strategy

### MVP: Setup + Foundational + US1

The promise becomes checkable and the parity sweep becomes possible — T047–T049 need only US1, so
the gate can be armed on the MVP. That is most of this feature's value.

### Incremental delivery

1. Setup + Foundational → the player can be told; the editor can be told
2. **US1** → a teacher watches their lesson; the parity gate can be armed — demo
3. **US2** → starting where they are — demo
4. **US3** → driving it, and the ending — demo
5. **US4** → testing a gated lesson, and dead ends made visible — demo
6. **US5** → sizes — demo

### If this has to be cut

**US5** is the line, recorded in the specification rather than improvised. It is a `Should` in the
source requirements, it exercises a property the engine already has rather than adding one, and
nothing depends on it. In tasks: T043–T046 go.

US4 is the next to consider and a harder loss: without it, testing slide nine of a gated lesson
means answering eight questions first, every time — the friction that makes a feature go unused.

US1 through US3 are the feature.

---

## Notes

- `[P]` means different files and no dependency on an incomplete task
- Every test task must **fail** before its implementation task starts (Constitution II, NON-NEGOTIABLE)
- Mark each task `[X]` as it completes
- Two things this feature must not do, both of which would be the drift signal the specification
  named: fork the player, or let the override become reachable from a learner's player

---

## Remediation applied after `/speckit-analyze`

Six findings. The first was the feature's headline claim specified in a way that could not fail; the
rest are three places where the plan asserted a capability the code does not have, and two
behaviours the code has that the plan did not expect.

| Finding | Change |
|---|---|
| **A1** the parity check was tautological, and aimed at the wrong surface | T047 now compares the **editor canvas** with the **learner player**, not the preview with the player. The preview mounts `LessonPlayerClient` unmodified, so those two are one component; and stating the assertion as `resolve(slide,t) === resolve(slide,t)` compares a pure function with itself and passes forever, including after parity breaks. `EditorCanvas` uses `staticRenderers` and the player `builtinRenderers` — a deliberate split, and the one across which feature 005 found the question element's submit control on a canvas that should not have had it. T048 names both sets in its output; T049's control makes one renderer disagree with its counterpart rather than perturbing a shared value, which would prove only that the kernel is shared |
| **A1b** the honest preview-versus-player claim | **New T050**: the preview mounts the player unmodified and re-implements no renderer. A *composition* assertion, and the thing that makes T047's target the right one — if the preview ever stopped mounting the player, this is what would notice |
| **A2** an inline `onReady` would rebuild the transport every render | T027 requires `onReady` and `ports` to be memoised and the seek to be idempotent. The player's mount effect lists both among its dependencies (`LessonPlayerClient.tsx:533`), so the natural way to write the task produces a preview that restarts continuously — presenting as a timing bug and being a dependency one |
| **A3** the preview had no controller to ask | T042 now says the preview builds its own via `createAdvanceController(ports)`, **for `reachability` only**. `LessonPlayerClient` constructs one internally and `PlayerContextValue` exposes only `transport` and `slideDurationMs`. `reachability` is a stateless query and is safe to duplicate; `evaluate` keys decisions by `instanceId` and is not |
| **A4** two Restart buttons disagreeing | T033 records that `LessonComplete`'s own "Review" goes to the *lesson's* beginning (`LessonPlayerClient.tsx:243-247`) while the preview's Restart goes to the *preview's* start. Deliberate — the completion screen is the lesson's affordance behaving as a learner's would, which is what a preview exists to show — and two buttons differing is only confusing if neither says which |
| **A5** `autoPlay` and the gesture prompt | T016 states `autoPlay` explicitly and records its consequence: `needsGesture = autoPlay && hasAudibleMedia(lesson)`, so previewing a lesson with audio shows the gesture prompt first. Correct, and what a learner gets — written down so it is not read as the preview failing to start |
| **A6** `goToSlide` past the last index | T032 notes that it sets the transport to `completed`, which is why T030 requires next to be *unavailable* at the end rather than merely inert |

## Remediation applied after the second `/speckit-analyze`

The first pass retargeted the parity check. The second read `test/parity/` and found the new target
was already occupied — and found a task in the previous feature marked complete that was not.

| Finding | Change |
|---|---|
| **B1** the retargeted check duplicated feature 005 | `overlay.test.tsx` already asserts the editor's render layer is byte-identical to the player's with the overlay subtracted — all seven types, selection active, ghost present — and `state.test.tsx` carries the guard *"changes with time, so the equality above is not vacuous"*, anticipating this feature's tautology a whole feature earlier. T047 now **runs the existing suites**, and T046 narrows to what is genuinely untested: `staticRenderers` and `builtinRenderers` are the same seven objects except `staticQuestionRenderer` against `questionRenderer`, so the question element is the entire divergence surface — and where feature 005's real divergence was |
| **B2** feature 006 shipped a requirement half-done | **New T008**: `EditorCanvasProps` still lacks `effects`, and the canvas still calls `resolve(slide, atMs)` with two arguments (`EditorCanvas.tsx:106`). The inspector and the effect controls both received the registry; the canvas did not — so a host's ninth effect is offered in the menu and rendered as `UNKNOWN_EFFECT_TYPE`, exactly the defect that requirement was raised to prevent. It escaped because the ninth-effect test called `resolve(slide, 500, { effects: registry })` **directly** rather than through the canvas: the path that works was tested, not the path a host takes. The task writes the canvas-level test first and amends feature 006's T029 to record that it shipped incomplete |
| **B3** the first assertion line was tautological too | Dropped. `resolve(slide,t,canvasContext) ≡ resolve(slide,t,playerContext)` holds by construction: `ResolveContext` carries the *core* registries, nothing gives the two sides different ones, and the renderer difference is a React-level concern the kernel knows nothing about |
| **B4** effect parity across renderer sets is not a thing | Stated. Effects are CSS custom properties written by `FrameWriter` from one `resolve`, on both sides — there is no renderer-set difference for them to disagree across. What is asserted instead is that both sets *accept* the same resolved contribution |
| **B5** the composition assertion's neighbour | T050 now cites `overlay.test.tsx`'s *"adds no editor prop to SlideView"*: that one guards the canvas, this one the preview, and they are worth reading as a pair |

## Remediation applied after the third `/speckit-analyze`

The first pass read the player's props, the second its tests, the third its **render output** — and
one line of it broke the design each of the first two had signed off.

| Finding | Change |
|---|---|
| **C1** the preview's controls vanish at the ending, and behind a gesture prompt | `LessonPlayerClient` renders `children` inside a ternary: `complete ? <LessonComplete/> : gestureGiven ? children : <GesturePrompt/>` (`:645-651`). So `children` is absent at the completion state and while a gesture prompt shows — and the Close button was specified to live there. A teacher reaching the end of their own lesson would have had one control: Review, which replays it. The override switch would have vanished with it, at the moment a teacher is judging whether the lesson works. **T016 now splits the chrome**: transport-dependent controls stay inside as `children` because they need `usePlayer`; close, the override switch, its indicator, and the viewport preset go outside, where the ternary cannot reach them. T032, T040, T041, and T045 follow, and T014 gains the two assertions that would have caught it |
| **C2** the preview was asked to render a completion state the player already renders | T033 rewritten: the completion state arrives from the player, so rendering one here would double it. What the task owes is that the frame stays reachable at that moment — which is exactly what C1's split makes possible |
| **C3** focus return had no defined target once the chrome split | T017 states the rule the split creates a need for: opening moves focus to the frame; closing returns it to the Preview button **wherever focus was inside**, including in the player's own controls or the completion state. Feature 005's delete confirmation is the precedent and did not need this, being one dialogue |
| **C4** the gate's invocation was unstated | T047 cites `gates/a11y.mjs:32`'s shape — `execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', …])` |

**Worth recording about the process.** Three passes, three layers: props, tests, render output. Each
had something the layer above did not, and the plan's premise — "the preview is the player,
composed" — stayed right throughout while being wrong about one line of the composition. The seam
this feature borrows from is forty lines long and has now been read three times.


**Worth recording about the process.** The first pass improved the parity target and did not check
whether the target was already occupied — the same class of error as the original, one level up. The
repository knew more than the plan did, twice: feature 005 had already written the comparison, and
feature 006 had left a requirement half-built behind a test that drove the working path.

## Remediation applied after the fourth `/speckit-analyze`

The third pass split the chrome and stated a rule for the split. The fourth checked the rule against
every control the specification asks for, and one of them — restart — does not fit it.

| Finding | Change |
|---|---|
| **D1** restart was unassigned, and both homes were wrong under C1's rule | FR-013 lists restart among the preview's controls and US3 §7 requires *"restarting a finished preview replays from the preview's start"* — **at the completion state**. C1's rule sent transport-dependent controls inside as `children`, which is exactly where the completion state removes them; T034 implemented restart without naming a half. **Restart now lives in the frame** (T034), and T032 says so explicitly alongside close |
| **D2** C1's rationale was wrong, and D1 is what exposed it | T016 said the four frame controls go outside because "none of those four needs the transport". But the preview *holds* the transport regardless — T027 captures it in `onReady` to perform the start-point seek — so the frame can drive it, and transport access never divided anything. **The rule is restated as what must survive the ternary**: inside go the controls only meaningful while the lesson plays (play, pause, seek, previous, next); outside goes everything that must stay reachable at the completion state and behind a gesture prompt (close, restart, the override switch, its indicator, the viewport preset). Mirrored in `contracts/preview-contract.md` §1 and §4, `research.md` R-06, and `plan.md` |
| **D3** no test covered restart at the completion state | T014 asserted close is reachable there; T031 asserted the completion state appears and the preview stays open. Neither exercised US3 §7. **T031 now asserts restart is reachable from the completion state and replays from the preview's start** — the assertion that would have failed D1, and the same defect close nearly shipped with, one control later. `quickstart.md` §7 says *reachable* for the same reason |
| **D4** the viewport preset is in the frame but constrains something inside the player | `Stage` renders `.cs-stage` within `LessonPlayerClient`, so a control in the frame cannot style it. **T045 now states the mechanism**: the preset sets the width of the preview's own wrapper around the player, and the stage rescales through container query units because geometry is logical. That is why FR-023's "no stored geometry changes" holds by construction rather than by care |

**Worth recording about the process.** The third pass found a real defect and wrote a rule that
explained it. The rule was wrong — it described a symptom of the split rather than its cause — and it
survived one pass because the control that disproves it had not been assigned to either half yet. A
rule stated from a single example is worth re-deriving against the rest of them.

## Remediation applied after the fifth `/speckit-analyze`

Four passes read the player: its props, its tests, its render output, its controls. This one read
the two layers the preview sits *between* — the **stylesheet** beneath it and the **editor** behind
it — and found a story that could not do what it claimed and two requirements the specification had
stated in prose and nothing delivered.

| Finding | Change |
|---|---|
| **E1** a viewport preset cannot change the proportion, and five places said it could | `.cs-stage` declares `aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h)` (`stage.css:18`) and a 16:9 canvas is 1600 × 900 (`tokens.ts:26`), so a preset makes the lesson **smaller**, never a different shape — and since every dimension beneath is in `cqw`/`cqh` against that same canvas, a smaller preview is otherwise the *same picture*. US5 was therefore vacuous as written, and T043's three assertions all passed without touching it. **The one real difference is the legibility floor**: body text is `max(12px, 32/1600 · 100cqw)`, which takes over below **600 px**, captions below **960 px** (`:154`), UI text below **800 px** (`:174`, `:212`) — so at tablet the captions are already off-scale and at mobile the body text is, growing relative to the box it was authored in. That is the teacher's actual question. New **FR-024** states it; FR-023 and US5's scenarios now say *size*; **T043 gains the assertion with a number in it**, T045 chooses the preset widths against the floors and derives them from the canvas, T046 records the mechanism. Mirrored in R-05, the contract §7, quickstart §8, and a fourth Complexity item |
| **E2** "editing must be impossible rather than undefined" had no requirement, no task, and no test | The spec said it twice — as an edge case and as an out-of-scope note — and T017's modal behaviour ("covers the editor, takes focus, returns focus, dismissible") does not achieve it, because Tab does not respect z-index. Every key handler in the studio is element-scoped — `onKeyDown` in `Track.tsx`, `Overlay.tsx`, `TextEditSurface.tsx`, and **no** document- or window-level listeners — so focus is the entire path into an edit: one Tab out and one arrow key nudges an element by `NUDGE_MS`, invisibly, since the preview holds the draft as it stood at open. New **FR-030**; T017 makes the preview a `<dialog>` opened with `showModal()`; T014 asserts it. The first draft of this remediation said "mark the editor `inert`" and was wrong — the studio exports parts a host composes and has no editor root to mark, so `Preview.tsx` would have had to reach into a tree it does not own. A modal `<dialog>` needs no such reach: the platform supplies the top layer, the inertness, the focus containment, and Escape. Feature 005's delete confirmation moves focus without trapping — right for two buttons, not for a surface a teacher sits in for minutes |
| **E3** opening the preview while the editor is playing was uncovered, and it breaks FR-006 | The spec anticipated a clock behind the editor and covered one direction: *"Closing the preview while it is playing. The clock stops."* Nothing stopped the editor's own. `usePlayback` runs `useFrameLoop` for as long as its state is `playing` (`usePlayback.ts:139`), so a preview opened mid-playback runs **two clocks and two frame loops** over one slide — and the authoring time FR-006 promises to restore moves while the teacher watches, which would make quickstart §9's *"FR-006 should need no restore code"* false. **T016 pauses the editor's playback on open**, through `usePlayback.pause()`, which already commits the moment through the one write path; T014 asserts it; **T057 now opens the preview while playing**, since measured against an idle editor the budget never sees the second frame loop it exists to prevent. New edge case in the spec |
| **E4** "stage container" named the element the preset must not touch | D4 renamed one end of this and left the other. `.cs-stage` *is* the container — `container-type: size; container-name: cs-stage` — so T043 and quickstart §8 asking a preset to set "the stage container's width" read as the opposite of what T045 implements. One term throughout: **the preview's viewport wrapper** |

**Numbering.** FR-024 was inserted in the US5 group and FR-030 appended, so the old FR-024–FR-028
shifted to FR-025–FR-029 across every artifact. 30 requirements, 13 success criteria, 62 tasks.

**Worth recording about the process.** Every earlier pass read the thing the preview *is*. This one
read what it sits between, and both findings came from there: the editor behind it and the
stylesheet beneath it. E1 is the more uncomfortable of the two — the story was not wrong, it was
**empty**, and four passes checked its requirements against its tasks without ever asking whether
the mechanism could produce the effect. Coverage checks cannot find that. Reading `stage.css` could,
and did in ten minutes.

## Remediation applied after the sixth `/speckit-analyze`

The fifth pass made two structural decisions — `<dialog>` for modality, a wrapper width for the
viewport. This one read the **test harness**, then checked those two decisions for consequences.
Both had one, and one of them contradicted the other.

| Finding | Change |
|---|---|
| **F1** the preview's tests had no clock | T023 said a mid-lesson preview is "driven by `runFrames`", and two helpers of that name exist with incompatible signatures — the studio's takes `{ advance(ms) }` (`test/harness/editor.tsx:134`), `@cuestack/react`'s takes `TestPorts` and calls `ports.clock.advance` (`test/harness/frames.ts:16`). Neither could drive a preview, because nothing gave one a clock: `Ports` has six members (`core/src/ports/index.ts:22`), the studio's `fakePorts()` supplies **two** — and must, since `usePlayback` is typed to that `Pick` — and `LessonPlayerClient` either takes all six or builds `browserPorts()` itself. `@cuestack/react`'s `testPorts()` is the right object and is not exported from `src/index.ts`, so it cannot cross the package boundary. **Three changes**: T016 states `ports` on `PreviewProps` as the substitutability seam Constitution II requires; T002 adds `fakePlayerPorts()` beside the existing fake rather than widening it; T009 threads it; T023 names which `runFrames` and why the 100 ms step matters — `CLAMP_CEILING_MS = 250` caps a single tick, so one 2 500 ms jump yields 250 ms of lesson time, which cost feature 006 real time. Mirrored in the contract §1, R-01's prop table, and plan.md. This blocked the test tasks of US2, US3, and US4 |
| **F2** `<dialog>` defeats a max-width-only preset, and the fifth pass wrote both halves | Every artifact said the preset "sets a **maximum** width" on the viewport wrapper. That was right while the preview was an ordinary block filling its parent, and wrong the moment T017 made it a `<dialog>`: the HTML spec's suggested rendering gives dialog `width: fit-content`, so the dialog sizes to its contents, a `max-width` caps an element with no width of its own, and the stage's `width: 100%` resolves against a fit-content ancestor — leaving the preview as wide as the control row, with the preset able only to narrow it. It would have looked roughly right and been wrong. **T045 and T046 now set a width**: the dialog takes the viewport with `max-width: none`, the wrapper takes `width: <preset>; max-width: 100%`. Mirrored in R-05, contract §7 and §8, and quickstart §8 |
| **F3** the dialog's accessible name is invisible to the gate | T053 required "every interactive control named", which a `<dialog>` is not. The suite runs `runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }` (`axe.test.tsx:22`) and axe's `aria-dialog-name` rule is tagged `best-practice`, so an unnamed modal passes silently and is announced as "dialog" and nothing else. T053 asserts it directly — **not** by widening the tag set, which is deliberate. The studio's own three dialogues all carry a label; this one was missed because the `<dialog>` decision was one pass old. Named after the lesson, so a teacher with two windows open can tell them apart. Quickstart §12 says why the assertion is hand-written |
| **F4** thirteen `[P]` tasks share five test files | **No change, deliberately.** Feature 006 has the identical pattern in eight files and shipped 105 of 106 tasks with 1860 passing tests, so `[P]` here means independent in content, written sequentially into one file. Recorded as a line in the Format section so the seventh pass does not re-find it |

**Worth recording about the process.** Three consecutive passes have now found a defect created by
the previous pass's fix: C1's rule was disproved by D1's control, D-era prose was disproved by E1's
stylesheet, and E2's `<dialog>` disproved E1's "maximum width" — one section of the same document
apart, applied in the same edit. The lesson is not that the fixes were careless. It is that a
decision which changes the *containing element* invalidates statements about everything inside it,
and nothing in this process re-reads those statements automatically. F1 is the different kind:
nobody's fix caused it, and six passes over the same forty-line seam did not find it, because it
lives in the harness rather than in the design.

## Remediation applied after the seventh `/speckit-analyze`

Six passes read the preview's own surfaces. This one read the two things it inherits without
choosing — **what the player does through its ports**, and **which gates actually run** — and read
the constitution directly rather than from memory.

| Finding | Change |
|---|---|
| **G1** a preview emits the learner's analytics stream | `LessonPlayerClient` records `lesson_started` on mount and `slide_started`, `slide_completed`, `lesson_completed` as the lesson runs (`:326`, `:376`, `:470`, `:477`), and the preview mounts it unmodified. So a teacher checking slide three reports a lesson started, and **under US4's override every skipped gate reports a completion no learner earned** — indistinguishable in a host's data from a real one. The word "analytics" appeared in these artifacts exactly once before this pass, in a harness fixture. New **FR-031**; T016 builds the preview's ports as `{ ...base, analytics: discarding }`; T038 asserts an empty event list after overriding to the end. It is inert today only because `browserPorts()` uses in-memory adapters, and that file names the way out — "a host that wants persistence supplies its own ports". New **R-09**, and contract §9 renamed from "what never reaches a manifest" to **"what never leaves the preview"**, which is the sentence the whole finding turns on: FR-005, FR-018, and SC-005 all stop at the manifest, and nobody asked what else leaves |
| **G2** the preview's accessibility assertions are not in the blocking gate | `gates/a11y.mjs` hard-codes `packages/react/test/a11y` and runs `--project @cuestack/react a11y`; T053 puts the preview, its controls, the override indicator, the reachability report, and the completion state in the **studio's** suite, which the gate never reaches. The other two studio-relevant gates were extended as the editor grew — `perf.mjs:53` runs `@cuestack/studio test/perf`, `theme-values.mjs:39` targets `packages/studio/src` — and a11y was correctly left alone until now, because until now the editor package held nothing learner-facing. It does now: the preview *is* the player, and the constitution's CI gate 6 covers learner-facing components. New **T062** extends the gate, keeping its honest-placeholder shape; the manual pass becomes T063. plan.md's Constitution Check row III no longer reads a bare "Pass" |
| **G3** `Ports.assets` has no consumer, and the new seam exposes it | `AssetAdapter.resolve` is declared (`core/src/adapters/index.ts:43`) and read by nobody; assets reach the player through the `resolveAsset` prop (`SlideView.tsx:48`), which is what R-04 correctly builds on. F1 added `ports` to `PreviewProps` last pass, so the contract now hands a preview an object with a member that does nothing beside a prop that does everything. Recorded in T016, contract §1, and R-01 — **not fixed**, because unifying two asset paths is a kernel decision, not a preview one. This is the **sixth** contract member this wave has found declared without a producer, after `ElementPlugin.inspector`, `EffectDescriptor.parameters`, `RenderState.problems`, `ResolveContext.effects`, and `AdvanceControllerOptions.allowOverride`; plan.md carries the count, because the count is now the finding |

**Constitution, read in full rather than from memory.** No violations. Principle IV's 100 ms
preview-versus-published divergence is deliberately argued rather than measured, and plan.md's
Complexity Tracking is the Deviation note the governance section requires. Principle II's
injectable-clock rule is what F1 restored. Principle V is the feature.

**Worth recording about the process.** Every previous pass asked what the preview *does*. This one
asked what it *inherits* — and both real findings came from there, because inheriting the player
unmodified is the design, so everything the player does the preview does too, including the things
nobody listed. G1 is the sharper of the two: the spec had three separate requirements saying nothing
escapes a preview, and all three said "manifest", so the analytics stream was invisible to a reader
checking coverage and to six passes of one.

## Remediation applied after the eighth `/speckit-analyze`

Seven passes read the preview's surfaces, its stylesheet, its harness, its gates, and its ports.
This one read the **learner state a preview accumulates while running** — answers and advance
decisions — and asked what happens to it when a teacher goes round again.

| Finding | Change |
|---|---|
| **H1** restart replays a lesson whose gates are all already satisfied | FR-012 decided *where* restart goes and never *what state it goes there in*. Two mechanisms carry the finished run forward. The answers live in `useInteractions`' component state and the `Interactions` interface exposes `state`, `completedIds`, and `submit` — **no reset** (`useInteractions.ts:19-29`) — while `hasIncompleteRequiredInteraction` reads `signals.completedInteractions` (`conditions.ts:40-44`), so an answered question stops gating for good. And the advance controller keys decisions by `instanceId` in a private `Set` (`controller.ts:76,80,90`), where `instanceId` is `` `${slide.id}#${visitCount}` `` (`transport.ts:51-53`) and the count is bumped by `goToSlide` — but `restart()` calls only `clock.reset(0)` and emits (`:140-143`), so the slide is never re-decided. Half the reason a teacher restarts is "does that question actually stop it?", and the answer would have been no. New **FR-032**, a ninth US3 scenario, and **R-10**. **T034 keys `<LessonPlayerClient>` on a restart counter** — the remount discards interaction state, controller, and transport together and `onReady` re-seeks through the path T027 already builds, so no new player API and no reaching into a controller the preview deliberately does not own (T042). **T031 asserts it**: answer the question, restart, and it gates again. A restart written as a seek passes every other assertion in that file |
| **H1, second half** navigation is not a restart, and that is deliberate | `goToSlide` bumps the visit count, so previous and next re-decide the slide while the answers persist — which is what a learner moving within one run experiences, and is correct. T032 says so and says **not** to add a reset there; a new edge case records it. Restart means a fresh run; previous and next mean movement within one |

**The symmetry worth not losing.** T027 warns that an unmemoised `onReady` tears the player's mount
effect down and back up — "a fresh transport, a fresh controller, `writer.clear()`, and `play()`
again" — as a hazard to avoid. That teardown is exactly what restart needs, done on purpose. Both
tasks now say so, and both say the two mechanisms must not merge.

**Verified correct on inspection**, three of them places this pass expected to find gaps: business
-rule coverage (`check-rule-coverage` reports 14 of 18; the missing BR-008, BR-009, BR-012, BR-018
are all Wave 5, so 007 moves no number), `check-data-model.mjs` (reads feature 001's data-model, not
this one's, and correctly so), the example app (T019 has the current path, `edit/editor-view.tsx`),
and the two new `EditorCanvasProps` — where feature 006's escape could have repeated and does not,
because T006 is a canvas-level test written first and T008 names the escape mechanism outright:
"the path that works was tested, not the path a host takes".

**Worth recording about the process.** Every pass so far found something the preview *does* or
*inherits*. This one found something it *accumulates* — state that builds up during a run and has to
go somewhere when the run starts again. The spec had a requirement for restart, a test for restart,
and an analysis pass that added the reachability assertion for restart, and none of the three asked
what the lesson looked like on the other side of it.

## Remediation applied after the ninth `/speckit-analyze`

One finding, and the seventh pass created it.

| Finding | Change |
|---|---|
| **I1** the analytics decision would have silenced the preview | The player's ports fallback is all-or-nothing — `ports ?? { ...browserPorts(), media: createDomMediaPort({ nodeFor }) }` (`LessonPlayerClient.tsx:311-315`) — and its comment states the rule on purpose: *"a caller-supplied `ports` wins outright: a test handing in a scripted media fake must not have it replaced by one reading a DOM that has no decoder behind it."* R-09 made the preview construct `{ ...base, analytics: discarding }` and pass it **in production**, which drops `createDomMediaPort`. Everything follows: `media.query()` returns null for every element, so nothing plays; slides gated on `after_media_ends` never satisfy and the preview stalls where a learner advances, which US4's override would then mask as the lesson's fault; FR-021 would report a dead end in a lesson that is fine; and `hasAudibleMedia` reads the lesson rather than the ports, so the teacher still gets the gesture prompt, presses start, and hears nothing. **The preview cannot work around it** — `createDomMediaPort` closes over the frame writer created inside `LessonPlayerClient` and exposed to nobody, so the prop simply cannot express what a preview needs. **T005 makes the fallback a per-member merge**: `ports?: Partial<Ports>` and `{ ...browserPorts(), media: createDomMediaPort({ nodeFor }), ...ports }`. The comment's intent survives — a full object still wins, and every existing test passes one — and "override one member" becomes expressible. **T016 passes only `{ analytics: discarding }`**; T002 records that its full fake still wins; **T004 gains both halves**: a partial keeps DOM media, a full object with a scripted fake still replaces it. Mirrored in R-09, R-01's prop table, contract §1 and §9, plan.md, and quickstart §5, which also gains a manual "can you hear it" check for §15 |
| **I2** the contract's code comment contradicted its own prose | `ports={ports} // absent in production` two paragraphs above prose saying "except analytics", both written in the same pass. Now `ports={{ analytics: discard }}`, which is what the code will say |

**A trap this closes for everyone, not just the preview.** Any host supplying `ports` today to set
an analytics adapter already loses the DOM media port, silently. Nobody has hit it because nobody
has supplied ports outside a test, where losing DOM media is the point.

**Worth recording about the process.** This is the fourth time a pass has found a defect created by
an earlier pass's fix — C1→D1, D→E1, E2→F2, and now G1→I1 — and every one has been in the same
place: a decision that changed **what the preview hands the player**. The pattern is specific enough
to state as a rule. A change to that boundary invalidates the assumptions on both sides of it, and
the player's side is forty lines of `useEffect` whose behaviour depends on whether an argument is
present at all. Each of the four has been smaller than the last, which is the only encouraging thing
about the sequence.

## Delivered

**62 of 63 tasks.** T063 — the manual keyboard and screen-reader pass — stays open deliberately: it
needs a human with assistive technology, and quickstart §15's eight steps are what it covers.
Feature 006 left its equivalent open for the same reason.

**1,964 tests**, up from 1,860. Typecheck 9/9. Lint clean apart from the two pre-existing
`no-orphans` warnings. Five gates green, two of them changed by this feature: `gate:parity` stopped
being a placeholder and names five suites, and `gate:a11y` reached the editor package for the first
time. `check:rules` unchanged at 14 of 18 — the four missing rules are all Wave 5.

### Three things implementation found that nine analysis passes did not

**The override skipped the slides, not just the gates.** The kernel's short-circuit outranks *every*
condition, duration included — correct for the test affordance it was written as, and wrong for this
prop. Raised unconditionally, the lesson raced to its own ending the instant the switch went on: a
teacher could skip a question and then see nothing. The signal is gated on the slide's own duration
now, so the override releases a **gate** and never a slide's length. `override-absent.test.tsx`
carries the assertion, and `preview/override.test.tsx` carries it at the preview's level.

**An inline `onReady` rebuilt the transport, in a test.** T027 documents this exact hazard for the
component, and the first draft of `override-absent.test.tsx` walked into it: a new arrow identity on
every render tore down the mount effect and gave the lesson a fresh clock at zero. The failure read
as "the override does not work" rather than "the player restarted". Both the test and the component
now say so.

**Restart leaves the controls absent for one commit.** The remount means the player's transport is
null until its mount effect runs, and `PreviewControls` renders nothing in between. One frame in a
browser; in a test it needs an awaited flush, which `no-leak.test.tsx` records.

### What the parity gate actually checks

Five suites, and finding the right comparison took the whole of the first analysis pass to get
wrong and three more to settle. Preview-versus-playback is tautological. Canvas-versus-player is
real and feature 005 already wrote it. What was untested is the **renderer sets** — and the negative
control in `check-gates.test.ts` had to change what a question *says* rather than what affordances
it carries, because the two sets are supposed to differ there. It also has to rebuild
`@cuestack/react`: the suites import through the package entry, so a probe that edited `src` and did
not rebuild reported a passing gate. A first draft did exactly that.
