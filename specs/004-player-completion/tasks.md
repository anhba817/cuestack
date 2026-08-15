---

description: "Task list for Player Completion (Wave 3)"
---

# Tasks: Player Completion

**Input**: Design documents from `/specs/004-player-completion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included and are mandatory. Constitution II is NON-NEGOTIABLE, and this
is the wave where its standing requirement on MVP acceptance scenarios comes due — A, B, C, and F
must exist as automated end-to-end tests before the corresponding feature is called done. Each
lives in the story whose behaviour it proves, not in Polish, so a story's checkpoint means what it
says.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: US1–US5 from spec.md
- Exact file paths are included in every task

## Path Conventions

`packages/core/src/{interactions,media,ports,effects,resolve}/`,
`packages/core/test/{interactions,media,rules,harness}/`,
`packages/react/src/{player,elements,media,styles}/`,
`packages/react/test/{playback,elements,media,acceptance,rules,a11y,harness}/`, `tools/scripts/`.

## Four sequencing notes

**Slide advancement is foundational, and it does not exist.** `specs/003-…/quickstart.md` claims
a slide advances at the end of its duration. It does not: `slideIndex` is a fixed prop, nothing
imports `createAdvanceController`, and no test noticed because every player test renders one slide
(research R-04). US1's gating is vacuous without it and US3 is impossible without it, so it lands
in Phase 2 and blocks both.

**The gating logic itself needs no writing.** `AdvanceSignals.completedInteractions` and
`hasIncompleteRequiredInteraction` have implemented BR-005 in `@cuestack/core` since Wave 1,
against an empty set. US1 supplies the set. This is why the P1 story is smaller than its priority
suggests.

**`check-rule-coverage.mjs` must be updated *with* its tests, never before.** The gate fails when a
rule is declared in scope with no matching test file, so adding BR-014 or BR-015 to `EXPECTED`
ahead of the test that covers it turns the build red for a reason unrelated to the change. Each
update is a task inside the story that supplies the rule.

**Three shared types change, each in the story that needs it.** `MediaPort` gains commands in US2,
`EffectDescriptor` gains `reduced` in US4, `ResolvedElement` gains `reduced` in US4. All three are
additive, so they do not block the other stories and are not foundational. Making them foundational
would front-load type churn for stories that never read the new fields.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The fakes and fixtures every story below drives. No production code.

- [X] T001 Create a scripted media fake at `packages/core/test/harness/media.ts` implementing the full `MediaPort` including the commands US2 adds — it records every command it receives and replays a scripted sequence of position reports, so a test can assert what the lesson asked for as well as what it did. Includes the degenerate scripts the edge cases need — media reporting zero duration, and media that never reports an end — which are runtime behaviours of the fake rather than fields of a manifest, and so belong here and not in the corpus
- [X] T002 [P] Create the React-side media fake at `packages/react/test/harness/media.ts`, wrapping T001's so a player test can attach it without a real `HTMLMediaElement` (Constitution II forbids a test depending on real media playback)
- [X] T003 [P] Create an interaction-state helper at `packages/core/test/harness/interactions.ts` — build a state from a list of submissions, so policy tests read as a sequence of answers rather than as map construction
- [X] T004 [P] Extend `packages/react/test/harness/corpus.ts` with the slides this wave needs. For the stories: a required question that gates, an optional question that does not, a dead-end question (`on_correct`, one attempt), a media-gated slide, a two-slide pair with an authored transition, and a slide whose element is cued to media position. For the edge cases: a required question whose `endMs` precedes the slide's end, media that is muted (`volume: 0`, a manifest field), a lesson of exactly one slide, a transition longer than the slide it moves to, and a lesson whose final slide carries an unanswered required question. **Twelve in total** — every test below names the one it needs, and a test with no fixture is a test that cannot be written
- [X] T005 [P] Add the heavy-lesson generator at `tools/scripts/fixtures/heavy-lesson.mjs` producing 50 slides and 300 elements at run time, **including media elements and required questions** — SC-008 measures seeking with both present, and a fixture of text and shapes would report a number that does not answer the criterion (research R-09) — generated rather than committed, because feature 001 found a checked-in artefact disagreeing with the schema on its first real run

**Checkpoint**: `pnpm test` green, with new harness code that nothing yet imports.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make the lesson move from one slide to the next. **US1 and US3 are both blocked on
this**, and US2's media-end advance has nothing to advance without it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests

- [X] T006 Advance test in `packages/react/test/playback/advance.test.tsx` — a two-slide lesson on `after_duration` reaches slide 2 when slide 1's duration elapses, and stops at the last slide rather than running off the end
- [X] T007 [P] Single-fire test in `packages/react/test/playback/single-fire.test.tsx` — a slide advances exactly once however many times its condition reports satisfied, and a slide revisited after `goToSlide` may advance again (BR-007, keyed on `slideId#visitCount`)
- [X] T008 [P] Advance-mode test in `packages/react/test/playback/advance-modes.test.tsx` — `after_duration` and `on_click` each behave as authored through the player, with `after_media_ends` and `after_interaction` asserted as *not yet* advancing so US2 and US1 have a red line to move

### Implementation

- [X] T009 Move slide index from prop to state in `packages/react/src/player/LessonPlayerClient.tsx`, keeping `slideIndex` as the initial value so a host's deep link still works
- [X] T010 Wire `createAdvanceController` in `packages/react/src/player/LessonPlayerClient.tsx` — evaluate on each transport tick, call `transport.goToSlide` when it fires, and pass an empty `completedInteractions` set until US1 fills it
- [X] T011 Emit `slide_started`, `slide_completed`, `lesson_started`, and `lesson_completed` through the analytics port in `packages/react/src/player/LessonPlayerClient.tsx`, carrying no learner identifier
- [X] T012 Correct the false claim in `specs/003-react-ssr-player/quickstart.md` — "If you press play and reach the end of a slide, it advances" was untrue when written; state what Wave 2 actually did and point at this feature

**Checkpoint**: A lesson plays from its first slide to its last. Story work can begin.

---

## Phase 3: User Story 1 — A learner answers a question and the lesson responds (Priority: P1) 🎯 MVP

**Goal**: Questions answer, feedback appears, and a required one holds the lesson until it is
complete.

**Independent Test**: MVP Acceptance Scenario B — a ten-second slide with an unanswered required
question is still on screen at fifteen seconds; answer it, feedback appears, the lesson advances.
Needs no media, no transitions, and no reduced motion.

### Tests for User Story 1 ⚠️

> Write these first and observe them failing.

- [X] T013 [P] [US1] Completion-policy tests in `packages/core/test/interactions/policy.test.ts` — all three policies, plus the absent-policy default of `on_first_attempt` and why (contract: interaction-contract.md)
- [X] T014 [P] [US1] Outcome tests in `packages/core/test/interactions/evaluate.test.ts` — correctness against `correctResponse`, attempts used and remaining, `exhausted`, and `unsatisfiable` for a question that can never complete
- [X] T015 [P] [US1] State tests in `packages/core/test/interactions/state.test.ts` — `submit` returns a new state rather than mutating, responses key by element so a revisit finds the answer intact and consumes no attempt, and attempts order
- [X] T016 [P] [US1] Extend `packages/core/test/rules/BR-005.test.ts` with the real-state cases: a required question with an incomplete outcome holds a duration-advanced slide, an optional one does not, and two required questions on one slide need both
- [X] T017 [P] [US1] Question-answering tests in `packages/react/test/elements/question-answer.test.tsx` — selecting and submitting, feedback shown, remaining attempts stated, controls closing after the final answer
- [X] T018 [P] [US1] Keyboard and announcement tests in `packages/react/test/elements/question-a11y.test.tsx` — answerable by keyboard alone, outcome and remaining attempts announced through a live region, closed controls `aria-disabled` rather than `disabled`
- [X] T019 [P] [US1] Answer-secrecy test in `packages/react/test/elements/question-secrecy.test.tsx` — `correctResponse` appears nowhere in the markup before the response is final (FR-009)
- [X] T020 [P] [US1] Event test in `packages/react/test/playback/interaction-events.test.tsx` — an `interaction_submitted` event carries kind, attempt, and outcome, and **no** learner identifier (FR-006, SC-012)
- [X] T021 [P] [US1] Answer-survives-seek test in `packages/react/test/playback/answer-persistence.test.tsx` — seek backwards past the question and forwards again; the answer is still recorded (FR-008)
- [X] T022 [P] [US1] Disappearing-question test in `packages/react/test/playback/question-vanishes.test.tsx` — a required question whose `endMs` precedes the learner's answer must not deadlock the slide (spec Edge Cases). The format permits authoring it and BR-011 makes it an authoring concern, so the player's obligation is to report rather than to wait forever
- [X] T023 [P] [US1] **MVP Acceptance Scenario B** end-to-end in `packages/react/test/acceptance/scenario-b.test.tsx`, written from `docs/Cuestack_Framework.md` §34 B verbatim

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement the three completion policies in `packages/core/src/interactions/policy.ts`, as one table rather than three call sites
- [X] T025 [US1] Implement `evaluate(definition, responses) -> InteractionOutcome` in `packages/core/src/interactions/evaluate.ts` (depends on T024)
- [X] T026 [US1] Implement `InteractionState` and `submit` in `packages/core/src/interactions/state.ts`, returning a new state and the `LessonEvent` rather than recording it — the kernel does not own the analytics adapter (depends on T025)
- [X] T027 [US1] Export the interactions surface from `packages/core/src/index.ts`, and add a test asserting each exported name resolves — feature 002 shipped a public surface missing two of four capabilities because nothing checked
- [X] T028 [US1] Add the optional `interaction` member to `ElementRendererProps` in `packages/react/src/elements/registry.tsx`, per contracts/interaction-contract.md
- [X] T029 [US1] Implement `packages/react/src/player/useInteractions.ts` holding session responses and deriving outcomes
- [X] T030 [US1] Thread `interaction` through `packages/react/src/player/SlideView.tsx` to interactive renderers only
- [X] T031 [US1] Make `packages/react/src/elements/builtin/QuestionElement.tsx` answerable — submit, feedback, remaining attempts, live-region announcement, and `aria-disabled` when closed
- [X] T032 [US1] Supply `completedInteractions` from `useInteractions` to the advance controller in `packages/react/src/player/LessonPlayerClient.tsx`, replacing T010's empty set
- [X] T033 [US1] Emit `interaction_submitted` through the analytics port in `packages/react/src/player/LessonPlayerClient.tsx`
- [X] T034 [US1] Add question styles to `packages/react/src/styles/stage.css` — feedback, selected state, and closed state, every value from a theme property with a readable fallback

**Checkpoint**: US1 complete. Scenario B passes. A lesson with questions is answerable and gates
correctly.

---

## Phase 4: User Story 2 — Media and the lesson keep the same time (Priority: P2)

**Goal**: Media-gated advancement, media synchronised to lesson time in both directions, and the
gesture gate.

**Independent Test**: MVP Acceptance Scenario C — a slide set to advance after a video ends does
not advance while it plays, postpones while it is paused, advances once when it ends, and advances
once when the end is reported twice.

### Tests for User Story 2 ⚠️

- [X] T035 [P] [US2] Reconciliation tests in `packages/core/test/media/reconcile.test.ts` — a report within tolerance of the commanded position is an echo and moves nothing; a report outside it seeks the transport; a commanded seek that never lands leaves `following` false (contracts/media-port-contract.md)
- [X] T036 [US2] Loop negative control in `packages/core/test/media/reconcile.test.ts` — with the tolerance check removed, one seek produces an unbounded exchange. The rule exists to prevent a specific failure, and a rule never observed preventing it is not known to work
- [X] T037 [US2] Stuck-flag negative control in `packages/core/test/media/reconcile.test.ts` — a seek the media never acknowledges does not swallow the learner's next genuine scrub, which is the failure an `ignoreNextReport` flag would have had (research R-02)
- [X] T038 [P] [US2] Tolerance-bounds test in `packages/core/test/media/tolerance.test.ts` and `packages/react/test/media/tolerance-bounds.test.ts` — assert `MEDIA_SYNC_TOLERANCE_MS` falls below the seek control's step, read from the `SEEK_STEP_MS` that T057 exports rather than from a second copy of `1000` — that bound is real, because the step is owned by code that can change independently and Wave 4's timeline will want finer scrubbing. The **floor is pinned behaviourally, not numerically**: a report one report-interval past the commanded position is still an echo, and one past the tolerance is not. Asserting `500 > 250` between two literals in the same file would have looked like a check and been a tautology
- [X] T039 [P] [US2] Single-reconciler scan in `packages/core/test/media/one-rule.test.ts` — the position comparison that decides which clock wins appears in `reconcile.ts` and nowhere else, and no other module compares a reported position against a commanded one. FR-037 says one rule applied everywhere; every other one-place rule in this repository is machine-enforced (`no-switch-on-element-type`, `no-ui-in-core`, `no-theme-literals`) and feature 001 found a boundary rule green while enforcing nothing
- [X] T040 [P] [US2] Media-link tests in `packages/core/test/media/link.test.ts` — commands reach the port, `durationMs` from the file wins over the manifest's, and `failed` is reported rather than waited on
- [X] T041 [P] [US2] BR-014 test in `packages/react/test/rules/BR-014.test.tsx` — a lesson with audible media does not begin playback without a learner action, a silent lesson does, and the requirement is not asked twice (research R-08)
- [ ] T042 [P] [US2] Media-cued visibility test in `packages/react/test/media/cued-elements.test.tsx` — an element tied to media position appears within tolerance of its cue, measured against reported position rather than wall clock (FR-013, SC-006)
- [X] T043 [P] [US2] Lesson-seeks-media test in `packages/react/test/media/seek.test.tsx` — seeking the lesson commands the media; scrubbing the media moves the lesson; an unhonoured seek leaves the displayed position honest (FR-034, FR-035, FR-036, SC-014)
- [ ] T044 [P] [US2] Pause-and-resume test in `packages/react/test/media/pause.test.tsx` — pausing the lesson pauses its media, and resuming continues from the stopped position (FR-016)
- [ ] T045 [P] [US2] Hidden-document test in `packages/react/test/media/hidden.test.tsx` — hiding the document pauses the visual timeline *and* its media, and returning resumes both from the same position (FR-018, FR-016, BR-013). Includes hiding mid-transition, which must settle rather than strand two slides visible — one hidden-document concern, one test, rather than split across two stories. The transport half has held since Wave 1; the media half is new and is the reason this is not covered by the existing BR-013 test
- [ ] T046 [P] [US2] Degenerate-media test in `packages/react/test/media/degenerate.test.tsx` — a slide gated on media that is muted, or reports zero duration, still advances rather than waiting on an end that never comes (spec Edge Cases)
- [ ] T047 [P] [US2] Media-failure test in `packages/react/test/media/failure.test.tsx` — a slide gated on media that fails reaches `ADVANCE_MEDIA_FAILED` and offers a way on rather than stalling (FR-017)
- [ ] T048 [P] [US2] Gesture-prompt accessibility test in `packages/react/test/media/gesture-a11y.test.tsx` — the prompt is announced, keyboard-reachable, and names the action
- [ ] T049 [P] [US2] **MVP Acceptance Scenario C** end-to-end in `packages/react/test/acceptance/scenario-c.test.tsx`, written from §34 C verbatim including the duplicate-end-event row

### Implementation for User Story 2

- [X] T050 [US2] Add `play`, `pause`, and `seek` to `MediaPort` in `packages/core/src/ports/media.ts` — fire-and-forget, never throwing, per contracts/media-port-contract.md, and record in the file why they return void
- [X] T051 [US2] Implement the authority rule in `packages/core/src/media/reconcile.ts` as one pure function of two positions and a tolerance, exporting `MEDIA_SYNC_TOLERANCE_MS = 500` and `MEDIA_REPORT_INTERVAL_MS = 250` with the derivation from contracts/media-port-contract.md in a comment (depends on T050)
- [X] T052 [US2] Implement `packages/core/src/media/link.ts`, the only place the transport and the media port meet (depends on T051)
- [X] T053 [US2] Export the media surface from `packages/core/src/index.ts` and extend T027's resolution test to cover it
- [X] T054 [P] [US2] Implement `packages/react/src/media/domMediaPort.ts` over `HTMLMediaElement`, reporting position changes from **every** source including the element's own native controls, and add it to the coverage exclusions in `vitest.config.ts` with the reason — it wraps `HTMLMediaElement`, which happy-dom cannot exercise, exactly as `browserPorts.ts` needed in Wave 2
- [X] T055 [US2] Attach `packages/react/src/elements/builtin/VideoElement.tsx` and `AudioElement.tsx` to the media link by element id (depends on T054)
- [X] T056 [US2] Implement the lesson-level gesture latch and `packages/react/src/player/GesturePrompt.tsx` (research R-08)
- [X] T057 [US2] Wire lesson seek and pause to media commands in `packages/react/src/player/LessonPlayerClient.tsx`, and export the seek control's step as `SEEK_STEP_MS` from `packages/react/src/player/controls/PlaybackControls.tsx` instead of inlining `1000` — T038 asserts the media tolerance against it, and an inlined literal cannot be asserted against (depends on T052)
- [ ] T058 [US2] Add gesture-prompt styles to `packages/react/src/styles/stage.css`, chrome-sized rather than stage-scaled for the same reason the controls are
- [ ] T059 [US2] Add BR-014 to `EXPECTED` in `tools/scripts/check-rule-coverage.mjs` and move it out of the "no code to test yet" comment block

**Checkpoint**: US1 and US2 work. Scenarios B and C pass. Media and the lesson share one time.

---

## Phase 5: User Story 3 — The lesson says where you are and when you are done (Priority: P3)

**Goal**: Transitions between slides, progress where the host enables it, and a completion state.

**Independent Test**: Play a lesson past its last slide and confirm each change is animated for the
authored duration, progress advances, and a completion state appears and is announced.

### Tests for User Story 3 ⚠️

- [ ] T060 [P] [US3] Transition tests in `packages/react/test/playback/transition.test.tsx` — both slides present for the authored duration, each resolved at its own slide time, then only the incoming one (research R-06)
- [ ] T061 [US3] No-transition test in `packages/react/test/playback/transition.test.tsx` — `type: 'none'` and `durationMs: 0` both change immediately and animate nothing, since the format permits either
- [ ] T062 [P] [US3] Transition-interruption test in `packages/react/test/playback/transition-interrupt.test.tsx` — a seek mid-transition settles to the incoming slide and never leaves two slides visible (US3 #8)
- [ ] T063 [P] [US3] Progress tests in `packages/react/test/playback/progress.test.tsx` — shown only when the host enables it, counts slides visited so seeking backwards does not reduce it, and is absent otherwise
- [ ] T064 [P] [US3] Completion tests in `packages/react/test/playback/completion.test.tsx` — a completion state after the final slide, announced, with a way back into the lesson (FR-021, FR-022)
- [ ] T065 [P] [US3] Decorative-failure test in `packages/react/test/playback/decorative-failure.test.tsx` — a failed decorative asset does not interrupt the slide (FR-023)
- [ ] T066 [P] [US3] Degenerate-transition test in `packages/react/test/playback/transition-degenerate.test.tsx` — a transition longer than the slide it moves to, and a lesson of exactly one slide: progress and completion both have to mean something at n=1 (spec Edge Cases)
- [ ] T067 [P] [US3] Gated-final-slide test in `packages/react/test/playback/final-gate.test.tsx` — a final slide carrying an unanswered required question does not reach the completion state, and says why rather than appearing finished (spec Edge Cases, SC-010)
- [ ] T068 [P] [US3] **MVP Acceptance Scenario A** end-to-end in `packages/react/test/acceptance/scenario-a.test.tsx` — the authored sequence at 0.5 s, 2 s, 4 s, and the transition at 8 s, asserted both by playing and by seeking

### Implementation for User Story 3

- [ ] T069 [P] [US3] Implement `packages/react/src/player/SlideTransition.tsx` rendering outgoing and incoming slides, each resolved at its own slide time
- [ ] T070 [P] [US3] Add `packages/react/src/styles/transition.css` for fade, slide, and zoom, driven by custom properties like everything else and scoped beneath the stage, **and register it in `packages/react/src/styles/styles.css` and the `ORDER` list in `tools/scripts/bundle-css.mjs`** — that script fails the build when the two disagree, so a new stylesheet that is not registered breaks the build in the task that creates it
- [ ] T071 [US3] Drive transitions from slide changes in `packages/react/src/player/LessonPlayerClient.tsx`, settling immediately on interruption (depends on T069)
- [ ] T072 [P] [US3] Implement `packages/react/src/player/LessonProgress.tsx`, counting visited slides
- [ ] T073 [P] [US3] Implement `packages/react/src/player/LessonComplete.tsx`, announced and offering a return
- [ ] T074 [US3] Add a `progress` option to the player props in `packages/react/src/player/LessonPlayerClient.tsx` and document why it is a host option rather than a manifest field (spec Assumptions)
- [ ] T075 [US3] Export `SlideTransition`, `LessonProgress`, and `LessonComplete` from `packages/react/src/index.ts`, and from `server.ts` where they are hook-free — feature 003 found the two entries diverged twice
- [ ] T076 [US3] Add progress and completion styles to `packages/react/src/player/controls/controls.css` — the existing chrome stylesheet, already registered and already sized as chrome rather than scaled to the stage

**Checkpoint**: US1–US3 work. Scenarios A, B, and C pass. A lesson runs start to finish.

---

## Phase 6: User Story 4 — Less motion for a learner who asked for it (Priority: P4)

**Goal**: Per-effect substitution, decided by CSS on the first painted frame.

**Independent Test**: Play the corpus with a reduced-motion preference and confirm each moving
effect resolves to its declared alternative, that order and timing are unchanged, and that nothing
becomes invisible or unreachable.

### Tests for User Story 4 ⚠️

- [ ] T077 [P] [US4] Descriptor tests in `packages/core/test/effects/reduced.test.ts` — an effect declaring `reduced` contributes it, one that does not falls back to its end state, and a non-moving effect declares nothing (contracts/reduced-motion-contract.md)
- [ ] T078 [P] [US4] Resolver tests in `packages/core/test/resolve/reduced.test.ts` — `ResolvedElement.reduced` is null when no active effect moves, present when one does, and both visuals are pure functions of `(slide, timeMs)`
- [ ] T079 [US4] Timing-preservation test in `packages/core/test/resolve/reduced.test.ts` — a substitution reaches its end state at the same moment as the effect it replaces (FR-026)
- [ ] T080 [P] [US4] BR-015 test in `packages/core/test/rules/BR-015.test.ts` — every built-in moving effect has a substitution that neither hides the element nor moves it outside the stage (FR-027)
- [ ] T081 [P] [US4] Stylesheet tests in `packages/react/test/scaling/reduced-motion.test.ts` — the media block prefers `--cs-r-*` and falls back to no motion, using the CSS evaluator from feature 003's harness
- [ ] T082 [P] [US4] First-frame test in `packages/react/test/ssr/reduced-motion.test.ts` — both property sets are in the server-rendered markup, and nothing in the server path reads `matchMedia` (FR-028)
- [ ] T083 [P] [US4] **MVP Acceptance Scenario F** end-to-end in `packages/react/test/acceptance/scenario-f.test.tsx`, written from §34 F verbatim

### Implementation for User Story 4

- [ ] T084 [US4] Add optional `reduced` to `EffectDescriptor` in `packages/core/src/effects/registry.ts`, and reject a descriptor declaring `reduced` with `motion: false` — it would never be consulted
- [ ] T085 [P] [US4] Declare substitutions on the moving built-ins in `packages/core/src/effects/builtin/transform.ts` and `pulse.ts` per the table in contracts/reduced-motion-contract.md (depends on T084)
- [ ] T086 [US4] Compose the reduced visual in `packages/core/src/resolve/index.ts` and add `reduced` to `ResolvedElement` in `packages/core/src/resolve/state.ts`, emitting it only when an active effect moves (depends on T085)
- [ ] T087 [US4] Emit the `--cs-r-*` properties in `packages/react/src/frame/properties.ts` and `applyVisual.ts`
- [ ] T088 [US4] Write the reduced set from `packages/react/src/frame/FrameWriter.ts`, skipping it entirely when `reduced` is null
- [ ] T089 [US4] Replace Wave 2's blunt neutralisation in `packages/react/src/styles/stage.css` with the nested-fallback selection, and apply the same substitution to slide transitions in `transition.css` — replaced, not shortened (US4 #4)
- [ ] T090 [US4] Update `specs/002-headless-kernel/data-model.md` for `ResolvedElement.reduced`, as feature 003 did for `accessibility` — the document is checked against reality by review, and drift there has been found before
- [ ] T091 [US4] Record the widened exposure in `tools/scripts/gates/parity.mjs` — the gate stays inert and its message must now name what US4 added that it does not guard: every moving effect gained a `reduced` contribution, and nothing checks that the two agree. **Do not arm it.** FR-FWK-013 is *"registered elements render consistently in editor preview and learner playback"* — entirely editor-versus-player, and there is no editor. An earlier draft of this task invented an "effect half" of a requirement that has no effect-only component, and would have demanded parity fixtures for eight registered effects that have none. A gate cannot be armed against a requirement that is not yet satisfiable; Wave 4 (QA-5) is when it becomes one
- [ ] T092 [US4] Add BR-015 to `EXPECTED` in `tools/scripts/check-rule-coverage.mjs`

**Checkpoint**: US1–US4 work. Scenarios A, B, C, and F all pass.

---

## Phase 7: User Story 5 — The lesson survives things going wrong (Priority: P5)

**Goal**: Present the blocking conditions the kernel has reported since Wave 1 to nobody.

**Independent Test**: Play lessons seeded with each blocking condition and confirm each produces a
stated, announced, recoverable state rather than a blank stage or a silent stall.

### Tests for User Story 5 ⚠️

- [ ] T093 [P] [US5] Blocking-condition tests in `packages/react/test/playback/problems.test.tsx` — each of `ADVANCE_UNSATISFIABLE`, `ADVANCE_MEDIA_FAILED`, and `UNKNOWN_REQUIRED_INTERACTION` produces a learner-facing state naming problem, object, and action (FR-030, NFR-USA-004)
- [ ] T094 [US5] Leak test in `packages/react/test/playback/problems.test.tsx` — no internal identifier, element id, or error code appears in learner-facing output, and `RenderState.problems` appear nowhere at all (FR-024, research R-07)
- [ ] T095 [P] [US5] Retry test in `packages/react/test/playback/asset-retry.test.tsx` — a failed required asset can be retried without restarting the lesson, and a non-retryable condition offers a different way forward (FR-029)
- [ ] T096 [P] [US5] Error accessibility test in `packages/react/test/playback/problem-a11y.test.tsx` — every error state is announced and keyboard-reachable (FR-031)
- [ ] T097 [P] [US5] Dead-end test in `packages/react/test/playback/dead-end.test.tsx` — the corpus's `on_correct` one-attempt required question reaches `unsatisfiable` and the learner is offered a way on rather than waiting (research R-05)
- [ ] T098 [P] [US5] No-stranding sweep in `packages/react/test/playback/no-stranding.test.tsx` — for every corpus lesson, no reachable state leaves the learner unable to progress and unable to learn why (SC-010)

### Implementation for User Story 5

- [ ] T099 [US5] Implement the code-to-message mapping in `packages/react/src/player/problems.ts`, one place, with retryability per code
- [ ] T100 [US5] Implement `packages/react/src/player/PlaybackProblem.tsx` — announced, keyboard-reachable, naming problem, object, and action in learner terms
- [ ] T101 [US5] Present `RenderState.blocked` from `packages/react/src/player/LessonPlayerClient.tsx`, and deliberately not `RenderState.problems` (depends on T100)
- [ ] T102 [US5] Wire asset retry through the asset port in `packages/react/src/elements/AssetFallback.tsx` without restarting the lesson
- [ ] T103 [US5] Add problem-state styles to `packages/react/src/styles/stage.css`

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T104 Extend the rendered-parity sweep in `packages/react/test/hydration/rendered-parity.test.ts` to cover recorded interaction state and media position — seeking equals playing for every corpus slide and every answered state (SC-009)
- [ ] T105 Arm the playback budgets in `tools/scripts/gates/perf.mjs` against T005's fixture: frame cost under 16.7 ms and seek-to-rendered-state under 100 ms, each failing on a 10% regression, and **state in the gate's output that this measures the player's per-frame work rather than paint** so a pass is not mistaken for a full answer (research R-09)
- [ ] T106 [P] Add a perf negative control to `tools/scripts/check-gates.test.ts` — an artificially slowed resolve fails the frame budget, proving the one gate this wave arms actually fires. A gate that has never been observed failing is not known to be a gate, and feature 003 found the theme gate silenceable by an inline comment three tasks after arming it. The parity gate gets no control here because T091 leaves it inert — a negative control for a gate that checks nothing would assert nothing
- [ ] T107 [P] Add an a11y sweep over the new states to `packages/react/test/a11y/axe.test.ts` — question answered and unanswered, feedback, gesture prompt, mid-transition, progress, completion, and every error state (SC-011)
- [ ] T108 [P] Update `packages/react/README.md` for interactions, media, progress, completion, and the reduced-motion contract
- [ ] T109 [P] Add a Changesets entry at `.changeset/player-completion.md` covering the `@cuestack/core` minor (media commands, interactions, `ResolvedElement.reduced`) and the `@cuestack/react` minor
- [ ] T110 Promote the example in `examples/nextjs/app/` to a lesson worth completing — a question to answer, progress, and a completion state, so the wave's claim is demonstrable in a browser
- [ ] T111 Add the acceptance suite to `.github/workflows/ci.yml` as a named job, so §34 A/B/C/F are visible as a gate rather than buried in the test run
- [ ] T112 Run every scenario in `specs/004-player-completion/quickstart.md` by hand, **including the reduced-motion emulation and the keyboard pass over an answered question**, and correct any step that does not work as written
- [ ] T113 Flip PL-1, PL-2, PL-3, PL-4, QA-3, and QA-4 in `docs/cuestack_framework_plan.md`, note that QA-3 covers A/B/C/F only, and confirm the Wave 4 critical path still holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Phase 1. **Blocks every story** — US1's gating is vacuous
  without advancement, US3 is about moving between slides, and US2's media-end advance has nothing
  to advance.
- **US1 (Phase 3)**: depends on Phase 2 only. The only story with no dependency on another.
- **US2 (Phase 4)**: depends on Phase 2. Its *story* needs nothing from US1 — a media-gated slide
  needs no questions — but **one task, the hidden-document test, needs US3's transition** to check
  that hiding mid-transition settles rather than stranding two slides. Land US2 before US3 and that
  clause is the one thing left red.
- **US3 (Phase 5)**: depends on Phase 2, and **the gated-final-slide test needs US1**: a final slide
  held by an unanswered required question is a US1 capability observed through a US3 surface.
  Everything else in US3 is independent.
- **US4 (Phase 6)**: depends on Phase 2, and **on US3 for `transition.css`** — reduced motion has to
  substitute slide transitions, and it cannot substitute a file that does not exist. The effect and
  resolver work needs nothing from US1–US3; only the stylesheet task does.

**On these three.** Each is one task reaching across a boundary, not a story that cannot stand up.
They are declared rather than designed away because the alternative is worse: a final slide gated by
a question genuinely belongs with completion, and reduced motion genuinely has to cover transitions.
Moving those tests to preserve a tidy independence claim would put them where they do not belong.
What matters is that the claim is true, so a reader planning parallel work is not misled.
- **US5 (Phase 7)**: depends on Phase 2. Two of its conditions are *reachable* only once US1
  (`UNKNOWN_REQUIRED_INTERACTION`, the dead-end question) and US2 (`ADVANCE_MEDIA_FAILED`) exist —
  the presentation is independent, the fixtures are not, which is why it is ranked last.
- **Polish (Phase 8)**: T104–T107 depend on the stories they sweep; T108–T113 depend on all five.

### Within Each Story

Tests are written and observed failing before implementation. In core: policy before evaluation
before state. In the adapter: kernel surface before the hook before the renderer.

### Parallel Opportunities

Every `[P]` task in the file, listed exactly. **Derived from the file after it was written**, not
composed alongside it — features 002 and 003 each shipped a Parallel-Opportunities range that a
renumbering had shifted so it no longer described the set it named, and the second time it happened
it happened while correcting the first.

| Phase | Parallel tasks | Why they parallelise |
|---|---|---|
| Setup | T002, T003, T004, T005 | Different harness files, none importing another |
| Foundational | T007, T008 | Different test files |
| US1 | T013–T023, T024 | Eleven independent test files, plus the one core module with no dependency on the others |
| US2 | T035, T038–T049, T054 | Thirteen independent test files, plus the DOM port, which depends only on the port type |
| US3 | T060, T062–T068, T069, T070, T072, T073 | Eight test files and four independent components |
| US4 | T077, T078, T080–T083, T085 | Six test files, plus the built-in substitutions once the descriptor accepts them |
| US5 | T093, T095–T098 | Five independent test files |
| Polish | T106, T107, T108, T109 | Different files |

**Five tasks that look parallel and are not.** T036 and T037 share
`packages/core/test/media/reconcile.test.ts` with T035; T061 shares
`packages/react/test/playback/transition.test.tsx` with T060; T094 shares
`packages/react/test/playback/problems.test.tsx` with T093; T079 shares
`packages/core/test/resolve/reduced.test.ts` with T078. All five carried a `[P]` in the first draft
of this file, which contradicted the same file's own table of shared files two sections below.
Caught by deriving each table from the file rather than writing them alongside it — and the fifth
was found only on the second derivation, after the first four were fixed.

**Renumbering note.** Eight tasks were inserted across three analysis-remediation passes, which
shifted every id after them. The remap was done with collision-safe sentinels rather than a search-and-replace —
renaming `T022` to `T023` while a `T023` still exists is how a previous feature's renumber corrupted
its own file — and both tables above were then re-derived and compared against the file rather than
edited by hand. The sets survived the first pass; three *prose* counts inside them did not. The second pass was
worse and more instructive: a new `[P]` task landed **inside** the range `T038–T048`, and because a
remap moves a range's endpoints and not its membership, the row silently came to exclude the very
task inserted into it. That is the identical failure features 002 and 003 shipped, reproduced here
under a rename. It was caught only because the table is re-derived and compared after every edit —
reading it would not have revealed anything wrong.

The third pass then hit the *other* half of the same failure: the sets survived intact and a prose
count beside one of them did not. A derivation compares sets and says nothing about the English
next to them, so the counts are recomputed separately. Both halves have now failed once, which is
why both are checked.

### Files Touched by More Than One Task

| File | Tasks | Order |
|---|---|---|
| `packages/react/src/player/LessonPlayerClient.tsx` | T009, T010, T011, T032, T033, T057, T071, T074, T101 | Sequential — the busiest file in the wave |
| `packages/react/src/styles/stage.css` | T034, T058, T089, T103 | Sequential |
| `packages/core/src/index.ts` | T027, T053 | Sequential |
| `tools/scripts/check-rule-coverage.mjs` | T059, T092 | Sequential, and each with its own tests |
| `packages/core/test/media/reconcile.test.ts` | T035, T036, T037 | Sequential — same file |
| `packages/react/test/playback/transition.test.tsx` | T060, T061 | Sequential — same file |
| `packages/core/test/resolve/reduced.test.ts` | T078, T079 | Sequential — same file |
| `packages/react/test/playback/problems.test.tsx` | T093, T094 | Sequential — same file |

`LessonPlayerClient.tsx` accumulating nine tasks is worth watching. If it becomes hard to review,
the split to make is extracting the advance/transition orchestration into a hook — but only if the
need shows up, not pre-emptively.

---

## Parallel Example: User Story 1

```bash
# Eleven independent US1 test files — write them together, observe them fail:
Task: "Completion-policy tests in packages/core/test/interactions/policy.test.ts"
Task: "Outcome tests in packages/core/test/interactions/evaluate.test.ts"
Task: "State tests in packages/core/test/interactions/state.test.ts"
Task: "BR-005 real-state cases in packages/core/test/rules/BR-005.test.ts"
Task: "Question-answering tests in packages/react/test/elements/question-answer.test.tsx"
Task: "Keyboard and announcement tests in packages/react/test/elements/question-a11y.test.tsx"
Task: "Answer-secrecy test in packages/react/test/elements/question-secrecy.test.tsx"
Task: "Event test in packages/react/test/playback/interaction-events.test.tsx"
Task: "Answer-survives-seek test in packages/react/test/playback/answer-persistence.test.tsx"
Task: "Disappearing-question test in packages/react/test/playback/question-vanishes.test.tsx"
Task: "Scenario B end-to-end in packages/react/test/acceptance/scenario-b.test.tsx"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — **the lesson learns to move**
3. Phase 3: US1
4. **STOP and VALIDATE**: answer a question with the keyboard alone and hear the result

At that checkpoint a learner can complete a lesson that asks them something, which is the
difference between a slideshow and a lesson. It is also the first point at which MVP Acceptance
Scenario B — written into the framework specification long before any code — actually passes.

### Incremental Delivery

1. Setup + Foundational → the lesson moves between slides
2. US1 → questions answer and gate (**MVP**)
3. US2 → media and the lesson share one clock
4. US3 → it looks finished: transitions, progress, an ending
5. US4 → motion respects a stated preference
6. US5 → failures are visible and recoverable

### Parallel Team Strategy

Three tracks after Phase 2, converging at Polish:

- **A**: US1, then US5 — US5's fixtures need US1's dead-end question
- **B**: US2 — the only track touching the media port. Its hidden-document test has one clause that
  stays red until track C lands transitions
- **C**: US3, then US4 — US4 substitutes the transitions US3 introduces. US3's gated-final-slide
  test needs track A's question gating, so it settles last

---

## Notes

- Constitution II is non-negotiable: a test never observed failing has proven nothing
- **MVP acceptance scenarios A, B, C, and F become automated tests here** — a standing requirement
  since ratification that had no subject matter until this wave. D and E need the editor and the
  publishing pipeline; claiming "A–F" would be false
- Two business rules gain subject matter, BR-014 and BR-015, taking `check-rule-coverage.mjs` from
  10 of 18 to 12 of 18. BR-005, BR-006, and BR-007 are already covered and gain their first
  *end-to-end* exercise, which is a different thing
- The playback budgets arm in T105, discharging the Constitution's 50-slide/300-element fixture
  requirement that Wave 2 deferred with a reason that no longer holds. It is the **only** gate this
  wave arms: the parity gate stays inert (T091) because FR-FWK-013 is about editor-versus-player
  parity and there is still no editor
- Interaction state and media position are **inputs** to resolution, never state inside it — that
  is what keeps seeking a recomputation and parity structural (research R-01)
- Commit after each task or logical group
