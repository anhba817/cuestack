# Tasks: A learner can move through a lesson

**Input**: Design documents from `/specs/012-learner-navigation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/navigation.md](./contracts/navigation.md),
[quickstart.md](./quickstart.md)

**Tests are required, not optional.** Constitution II is NON-NEGOTIABLE and this feature is
almost entirely about behaviour that currently looks correct: a button that renders, is
keyboard-operable, is announced properly, and does nothing.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelizable, different files, no dependency on incomplete work
- **[US1]/[US2]/[US3]/[US4]** — the user story a task serves; setup, foundational and polish carry none

---

## The design point tasks resolve first

`next_slide` means **three different things, one per advance mode.** Settled here rather than
during implementation, because each wrong version produces a button that passes a test and fails
a learner.

| Slide's advance mode | A `next_slide` press |
|---|---|
| `on_click` | Raises `AdvanceSignals.learnerAdvanced`; the controller decides with cause `learner_action` — a cause that has existed since Wave 1 and has never once been produced — and the consumer applies it. The kernel's rule is honoured rather than bypassed |
| `after_duration` | Commands `goToSlide(current + 1)` — **only when the control is available**. An author who puts Continue on a timed slide wants a skip-ahead; BR-005 still outranks it |
| `after_interaction`, `after_media_ends` | **Nothing at all.** `available` is false for as long as the slide is shown, and the press does nothing |

Each omission is its own defect:

- Without the first, `learnerAdvanced` and `learner_action` stay unproduced — the
  seam-with-no-producer pattern this project has now recorded twelve times.
- Without the second, Studio's default button — `next_slide`, labelled "Continue", on a slide
  that is almost always `after_duration` — stays inert, which is the defect this feature exists
  to end.
- **Without the third, a learner skips a required question.** The format permits a `next_slide`
  button on a slide declaring `advance: { mode: 'after_interaction', interactionElementId: 'q1' }`,
  and performing the action there carries the learner past the thing the slide waits for. This
  row was missing from the first version of this section and from the spec; analysis found it by
  asking what the two-path rule does on the *third* mode. **A working button that skips a
  required question is worse than the inert one this feature replaces.**

**Availability is a derivation, not a list — and this is the part the table cannot carry.** A
`next_slide` control is available exactly when the lesson would let the learner leave. Two
conditions are known today: an unanswered required question (**BR-005**, which the kernel enforces
at `controller.ts:107` on *every* advance mode, including `after_duration`) and a mode-declared
gate. An earlier version of this section enumerated the modes and declared `after_duration` safe
for a direct command — which would have shipped a Continue button that skips a required question
on a timed slide, defeating a business rule `check:rules` tracks. **The `on_click` path was never
at risk**, because it raises the signal and the controller checks BR-005 before the mode branches;
the direct command is the only path that does not consult the kernel and the only one that needed
a guard.

**Always false on a gated mode, and not "false until satisfied".** The first version of this row keyed
availability on gate state, and that state is unreachable: `controller.ts` decides
`after_interaction` on the first evaluation where the interaction is complete, so the slide leaves
within a frame of the learner answering. A control called available in that frame would be an
available control that does nothing — the original defect, restored for 16ms. Keying it on the
*mode* removes the window and means the capability never has to compute gate satisfaction.

**And it does not consult the editor's override.** `Preview.tsx` passes `overrideAdvance` so a
teacher can move through a lesson without answering every question. That release moves the lesson;
it does not change what a control reports, because a teacher previewing should see what a learner
sees (FR-003b).

---

## Phase 1: Setup

- [X] T001 Add a two-slide fixture with a `next_slide` button to `packages/react/test/harness/corpus.ts`, and a slide whose mode is `on_click` carrying one. **Every fixture decides what the suite can see** — feature 011's element harness was entirely single-slide and hid a missing feature for a whole cycle
- [X] T002 [P] Add the same two fixtures to `packages/element/test/harness/lessons.ts`, alongside a slide that waits for the learner and carries **only** a Back button, for the validation cases
- [X] T003 [P] Add a `button`-bearing slide to `packages/studio/test/` fixtures so the preview and publishing stories have something to act on

---

## Phase 2: Foundational (Blocking Prerequisites)

**Everything in US1–US3 needs the capability. Nothing in US4 does.**

- [X] T003a Write `packages/core/test/advance/may-leave.test.ts` — the pure predicate over `(slide, signals)`: false for an unanswered required question on **every** advance mode (BR-005), false for `after_interaction` and `after_media_ends`, true for `on_click` and for `after_duration` **before its duration elapses** (a Continue button on a timed slide is a skip-ahead and must work early). **Assert it changes nothing**: call it, then call `evaluate`, and the slide must still decide
- [X] T003b Implement it in `packages/core/src/advance/conditions.ts` and export it from `packages/core/src/index.ts`, **adding it to `EXPECTED_VALUES` in `packages/core/test/public-surface.test.ts`** — which now fails if a capability is exported and recorded nowhere, so this is enforced rather than remembered. **FR-003d**. It exists because the question cannot be asked today: the rule lives inside `evaluate`, which records that a slide decided, so a speculative call consumes the decision and the slide never advances; and the conditions live in a module no adapter can import, since core has a single entry point. Without it, BR-005 is reimplemented in two adapters and diverges
- [X] T004 Write `packages/react/test/elements/renderer-boundary.test.ts` — **before** the capability exists. A structural assertion over `packages/react/src/elements/registry.tsx` that `ElementRendererProps` carries no `transport`, no `lesson`, no `slide`, and no time. **FR-012** and SC-007, and the reason it is first: three implementations of this feature break the boundary and all three work (props, `usePlayer()` from inside a renderer, a bubbling DOM event). None fails any other test
- [X] T005 Write `packages/react/test/elements/navigation-access.test.tsx` — `act()` takes no argument, so a renderer can perform only its own element's action; `available` is false for Back on the first slide and Continue on the last; the object is `undefined` for every element that is not a button
- [X] T006 Define `NavigationAccess` in `packages/react/src/elements/registry.tsx` and add it to `ElementRendererProps` as an optional member, exactly as `interaction` already is
- [X] T007 Implement `navigationFor(resolved)` in `packages/react/src/player/LessonPlayerClient.tsx`, beside `interactionFor`, and thread it through `packages/react/src/player/SlideView.tsx` the same way. **The same position, deliberately** — a second pattern for the same problem is how two mechanisms end up disagreeing
- [X] T008 [P] Write `packages/element/test/navigation.test.ts` — the web component's own capability: same members, built by `LessonElement` rather than passed as a prop
- [X] T009 Extend `renderElement` in `packages/element/src/renderers.ts` with a bound navigation parameter, of the same character as `resolveAsset`, and build it in `packages/element/src/LessonElement.ts` where the transport is already in hand. **Its own implementation, not the player's** — sharing would mean depending on `@cuestack/react`, which fails FR-013 structurally

**Checkpoint**: a button can act, and no renderer can reach the lesson.

---

## Phase 3: User Story 1 — A learner presses Continue and the lesson continues (Priority: P1) 🎯 MVP

**Goal**: the reported defect, fixed. Studio's default button works.

**Independent Test**: author a two-slide lesson with a `next_slide` button on the first; press it; the second slide shows.

**Depends on**: Phase 2.

### Tests for User Story 1

- [X] T010 [P] [US1] Write `packages/react/test/playback/navigation.test.tsx` — a `next_slide` press moves the lesson forward, by pointer and by keyboard (Enter and Space, which a native `<button>` gives for free) — FR-003 and **FR-005**
- [X] T011 [P] [US1] Write the last-slide case in the same file — a press past the end completes the lesson rather than moving nowhere or throwing. **Assert against the transport's own clamping** rather than a check in the adapter: `goToSlide` already sets state to `completed` past the last index, and a second check in the adapter is a second rule that can disagree
- [X] T012 [P] [US1] Write the one-press-one-movement cases — a double press, a held key, and a press during a transition each move exactly once (FR-009)
- [X] T013 [P] [US1] Write `packages/react/test/elements/open-url.test.tsx` — `open_url` behaves exactly as it does today. **The regression this feature is most likely to cause**: the tempting shape is to route all four actions through one new path, and `open_url` is the one that already works (FR-004)

- [X] T013a [P] [US1] Write `packages/react/test/playback/gate-not-bypassed.test.tsx` — **FR-003a**, and the case the first version of this plan would have shipped broken. A slide declaring `advance: { mode: 'after_interaction' }` carrying a `next_slide` button: the control reports itself unavailable, a press moves nothing, and the slide still advances by its own rule once answered. **Assert unavailability after the question is answered as well as before** — a first version of this rule made availability a function of gate state, which is true only in the one frame between satisfaction and the slide leaving. The same for `after_media_ends`
- [X] T013c [P] [US1] Write `packages/studio/test/preview/override.test.tsx` — **FR-003b**. With the editor's advance override on, the control on a gated slide still reports itself unavailable. The override moves the lesson, not the control, and a teacher previewing must see what a learner sees
- [X] T013b [P] [US1] Write the same two cases for the web component in `packages/element/test/gate-not-bypassed.test.ts` — the adapter builds its own capability, so the guard is its own code and not inherited
- [X] T013d [P] [US3] Write the companion case in the same file — **FR-003c**: on that gated slide, Back and Replay are available and work. Only `next_slide` is blocked. An implementation reading "navigation is unavailable on a gated slide" traps a learner in front of a question with no way to review it, which is worse than the failure the rule prevents

### Implementation for User Story 1

- [X] T014 [US1] Implement `next_slide` in `packages/react/src/elements/builtin/ButtonElement.tsx` — press calls `act()`, and `act()` follows the **three** paths above: raise the signal on an `on_click` slide, command `goToSlide` on a timed one, and do nothing on a gated one
- [X] T014a [US1] Compute `available` in `navigationFor` by calling the predicate from T003b — **not** by calling `advance.evaluate`, which records a decision and would consume the one the slide needed. False when a required question on the slide is unanswered (BR-005, every mode) or when the mode declares its own gate; false for Back on the first slide and Continue on the last. It does **not** consult the editor's override (FR-003a, FR-003b, FR-008)
- [X] T014b [US1] Write `packages/react/test/playback/br-005.test.tsx` — a slide advancing `after_duration` carrying a required question and a `next_slide` button: the control is unavailable and a press moves nothing, before the question is answered. **The case three earlier versions of this rule would have shipped broken**, and the one where the direct-command path bypasses a rule the kernel already enforces
- [X] T015 [US1] Keep `aria-disabled` on a control whose `available` is false, and **change what it guards**. `ButtonElement.tsx`'s header explains the choice — a `disabled` button leaves the tab order, so a learner using a screen reader never reaches it to hear why. That reasoning stays; what it means changes from "this framework has not wired this up" to "this action has nowhere to go from here" (FR-008, research R-09)

**Checkpoint**: the reported defect is fixed and shippable on its own.

---

## Phase 4: User Story 2 — A slide that waits for the learner can be left (Priority: P1)

**Goal**: the half that strands people. A lesson with an `on_click` slide becomes finishable.

**Independent Test**: author a slide with `advance: { mode: 'on_click' }` carrying a Continue button; it does not move on its own, and it moves when asked.

**Depends on**: Phase 2. Independent of US1 — a slide can be left by a control this story does not add.

### Tests for User Story 2

- [X] T016 [P] [US2] Write `packages/react/test/playback/on-click.test.tsx` — **both halves.** The slide does *not* advance when its authored duration elapses (FR-002), and does when the learner asks. A test that only presses the button passes against an implementation that also advances on duration — which is the feature working and the lesson broken
- [X] T017 [P] [US2] Assert the advance is attributed to `learner_action` — the `AdvanceCause` that has existed since Wave 1 and has never been produced. If the press bypasses the controller, the slide still moves and this fails, which is the point
- [X] T018 [P] [US2] Write the same two cases for the web component in `packages/element/test/on-click.test.ts`

### Implementation for User Story 2

- [X] T019 [US2] Raise `learnerAdvanced` for the evaluation following a press, in `packages/react/src/player/LessonPlayerClient.tsx` — **FR-001**, the request reaching the rule that decides. **Raised for one evaluation and not held**: a flag left true advances every subsequent slide the moment it is evaluated — a lesson racing to its own ending, which is the failure `overrideAdvance`'s own header records from an earlier feature
- [X] T020 [US2] The same in `packages/element/src/LessonElement.ts`, where `#advanceIfDue` already passes `learnerAdvanced: false` as a literal

**Checkpoint**: a lesson that waits for its learner can be finished.

---

## Phase 5: User Story 3 — A learner can go back and repeat (Priority: P2)

**Goal**: the other two inert actions.

**Independent Test**: author `previous_slide` and `replay_slide` buttons; both move the learner where their labels say.

**Depends on**: Phase 2. Independent of US1, US2, US4.

### Tests for User Story 3

- [X] T021 [P] [US3] Write `packages/react/test/playback/replay.test.tsx` — press Replay, the slide restarts, **then reach its end again and continue**. Run this one first: implemented as `transport.restart()` the restart is perfect and the slide then never advances again, because the visit counter did not move and the controller still holds the slide as decided. The first assertion passes and the lesson is broken (research R-02)
- [X] T022 [P] [US3] Assert completion is reported **again** after a learner replays their way to the end (FR-010). Free once replay bumps the visit, and impossible if it does not — the same mechanism that made feature 011's `#announcedComplete` flag wrong
- [X] T023 [P] [US3] Write the `previous_slide` cases — the previous slide shows from its beginning, and a press on the first slide moves nothing and throws nothing. Again asserted against the transport's own clamping (`index < 0 ? 0 : index`)

### Implementation for User Story 3

- [X] T024 [US3] Implement `previous_slide` and `replay_slide`. **Replay is `goToSlide(current)`, never `restart()`** — `restart()` resets the clock without bumping the visit, `instanceId` is "slide id plus visit counter", and the advance controller keys its decided-set on it. The better-named function is the broken one

**Checkpoint**: all four authored actions work.

---

## Phase 6: User Story 4 — A teacher is told when a slide cannot be left (Priority: P2)

**Goal**: the safety net. A lesson nobody can finish is refused before it reaches anybody.

**Independent Test**: author a slide that waits for the learner with no navigation control; the report names it, and publishing refuses.

**Depends on**: Phase 1 only. **Independent of the capability** — this is validation, and it needs no adapter.

### Tests for User Story 4

- [X] T025 [US4] **Split** `packages/core/test/advance/unsatisfiable.test.ts`'s negative assertion rather than relaxing it. It currently reads *"reports nothing for the two rules that cannot be unsatisfiable"* over `['after_duration', 'on_click']`. Widening that to accept the new behaviour is a one-character edit that also stops it catching anything. `after_duration` keeps a test saying it cannot be unsatisfiable; `on_click` moves out
- [X] T026 [P] [US4] Write the three `on_click` reachability cases — and **own the new branch's coverage.** `packages/core/src/advance/**` is inside the 90% branch-coverage floor's include list and the workspace is already red at 89.03%, so a partially-covered new branch makes a failing gate worse by an amount too small to notice. These three cases are what keep it from getting worse — a slide with a `next_slide` control reports nothing; one with no control is reported; one whose only control is Back is reported **with a different message** (FR-011a)
- [X] T027 [P] [US4] Write `packages/studio/test/publishing/` cases — such a lesson is refused, the same as any other dead end

### Implementation for User Story 4

- [X] T028 [US4] Add the `on_click` branch to `packages/core/src/advance/reachability.ts` — the third of the same shape, beside `after_media_ends` and `after_interaction`. It must find a `button` on the slide whose action is `next_slide`; Back, Replay, and `open_url` do not satisfy it, because a slide whose only control goes backwards is a dead end going forwards (**FR-006**, **FR-011**)
- [X] T028a [US4] Add the warning for a `next_slide` control on a gated slide — **FR-011b**. A new code beside `ELEMENT_BEYOND_SLIDE`, warning severity, because the slide is satisfiable through its gate and is not a dead end. Without it a teacher places a button, publishes, and it renders permanently disabled with nothing saying why — this feature's own defect one level up
- [X] T028b [P] [US4] Write the cases for it: a gated slide with a `next_slide` button warns; the same slide with only Back and Replay does not; an `on_click` slide with a `next_slide` button does not. **Assert the severity, not just the code** — an error here would refuse a publishable lesson
- [X] T029 [US4] Two distinct messages, and the second is the one that matters. An author looking at a slide with a button on it, reading "no way to continue", will read that as a bug in the checker rather than in their lesson (FR-011a, research R-06)
- [X] T030 [US4] Register the new rule in `tools/scripts/check-rule-coverage.mjs` if it carries a business-rule id, and confirm `check:rules` still reports every rule covered

**Checkpoint**: all four stories delivered.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T031 Write `packages/react/test/playback/focus.test.tsx` — after a slide change, focus is on the incoming stage rather than on `document.body`. **Two traps**: focus must not move on first render, which would take focus from the host's page; and during a transition two stages exist, so it must land on the entering one and not the `aria-hidden` leaving one (research R-04)
- [X] T032 Add a programmatic focus target to `packages/react/src/player/Stage.tsx` and move focus on slide-index change in `LessonPlayerClient.tsx`. **FR-007 already works; do not add a second announcement** — the player already keys a live region on the slide index, so it already covers a change the learner asked for. Two mechanisms would eventually disagree
- [X] T032a **D2, and pre-existing.** Widen `#uncoveredGate` in `packages/element/src/LessonElement.ts` to report a slide carrying a **required question this adapter cannot render, whatever the advance mode** — using T003b's predicate rather than a second copy of the rule. Today it returns null unless the mode is `after_interaction` — but the adapter passes `completedInteractions: new Set()` permanently, so BR-005 blocks leaving *any* slide with a required question, including a timed one. Such a slide never advances there and nothing says so: a learner sits on a timed slide that silently never ends. Shipped in feature 011 and surfaced by this feature forcing a reading of BR-005's scope
- [X] T032b [P] Write the case in `packages/element/test/stranded.test.ts` — a slide advancing `after_duration` with a required question reports `ADVANCE_UNSATISFIABLE` in the web component. **Run the control**: today it reports nothing at all
- [X] T033 [P] The same for the web component, in `packages/element/src/LessonElement.ts` at the point `#enterSlide` already runs. A test must read the **shadow root's** `activeElement`; `document.activeElement` reports the host element and would pass while proving nothing (research R-08)
- [X] T034 Add `button` to `COVERED` in `packages/element/src/covered.ts` and **correct the comment's reason**, which expires with this feature. `covered.test.ts` asserts the partition and names the excluded set explicitly, so it fails until updated — the right way round. **FR-013a**: `video`, `audio` and `question` stay declined, each for its own reason, and the stranding report keeps covering them
- [X] T035 Update the three other places that state the second adapter's scope: `packages/element/package.json`'s description, `packages/element/README.md`'s table, and the behaviour. **Four places, and `documented.test.ts` plus `readme-api.test.ts` already fail if they disagree** — which is why the covered set is the safest thing in this feature to change
- [X] T036 [P] Write `packages/element/test/a11y.test.ts` cases for a lesson carrying a button — axe at WCAG 2.2 AA, as the other lessons already are
- [X] T037 [P] Write `packages/studio/test/preview/navigation.test.tsx` — a press works in preview, and does **not** give preview a second way to change slides that the timeline does not follow (FR-014, Constitution V)
- [X] T038 Extend the agreement suite in `packages/element/test/agreement.test.ts` to cover a lesson with a button, and confirm `pnpm check:agreement` reports navigation. Add `button` to what the report says both adapters draw
- [X] T039 Update `docs/cuestack_framework_plan.md` — the button seam produced, twelve waves after `ButtonElement.tsx` promised "the seam Wave 3 wires up", and whatever else this feature turns up **including what is not acted on**
- [X] T040 Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm gates && pnpm check:rules && pnpm check:docs && pnpm check:agreement && pnpm check:element-isolation && pnpm check:packaging && pnpm check:isolation && pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations` and confirm every one is green. `check:rules` must still read **18 of 18**. `pnpm test:coverage` is a known red at 89.03% branches — pre-existing, not this feature's to fix, and it must not get worse
- [X] T041 Verify the negative controls by deliberate breakage, restoring each afterwards: implement replay as `restart()` (T021 must fail on its *second* assertion, not its first); raise `learnerAdvanced` permanently rather than per evaluation (T012 must fail); make `next_slide` bypass the controller on an `on_click` slide (T017 must fail); let a `next_slide` press act on an `after_interaction` slide (T013a and T013b must fail, and this is the control to run first — it is the one the design nearly shipped); make `available` true once a gated slide's question is answered (T013a's second assertion must fail — the one-frame window the rule was first written around); make `available` follow the editor's override (T013c must fail); compute `available` by calling `advance.evaluate` (T003a's no-op assertion must fail, and every advance test with it — this is the route the artifacts' own wording invited before FR-003d); make `after_duration` command `goToSlide` without consulting availability (T014b must fail — the BR-005 bypass, and the one that would still leave `check:rules` reporting 18 of 18 because the kernel stays correct and the adapter is what skips it); satisfy the reachability check with a Back button (T026 must fail); focus the stage on first render (T031 must fail); and add `transport` to `ElementRendererProps` (T004 must fail). **`git checkout` is not a restore for an untracked file and is a destructive one for a tracked file** — feature 011 hit both halves of that in one session
- [ ] T042 **(outstanding — requires a person, cannot be done by the implementing agent)** Put a lesson with a Continue button in front of somebody who has not worked on this codebase, and record what they expected that did not happen. **Requires a person.** The specific question worth asking: on a timed slide, did they expect Continue to skip ahead? The two-paths decision at the top of this file rests on the answer being yes

---

## Dependencies & Execution Order

```text
Phase 1 (Setup — fixtures)
   ├──► Phase 2 (the capability)  ──┬──► Phase 3 (US1 — the button)      🎯 MVP
   │                                ├──► Phase 4 (US2 — waiting slides)
   │                                └──► Phase 5 (US3 — back and replay)
   └──► Phase 6 (US4 — validation)   ── needs no capability at all
```

**US4 is independent of the capability**, which makes it the one story a second developer can
take immediately. It touches `@cuestack/core` and `@cuestack/studio`; everything else touches the
adapters.

**US1 and US2 are both P1 and both shippable alone.** Neither subsumes the other: a button is one
way to ask to move on, and a slide with `advance: { mode: 'on_click' }` needs the signal path even
if the control that raises it comes from US1.

**T004 comes before the capability, not after.** It is the assertion that makes the three
convenient shortcuts visible, and writing it afterwards means writing it against whichever one was
already chosen.

## Parallel opportunities

**Phase 1** — three separate fixture files.

**Phase 2** — T004 and T005 are independent test files; T008 is a different package from T006/T007.

**Phase 3–6** — the four stories share no source files once Phase 2 lands. US4 shares none at all.

**Phase 7** — T033, T036, T037 are three packages; T034 and T035 touch the same covered set and
must run in order.

## Implementation strategy

**MVP is Phase 1 + Phase 2 + Phase 3.** That fixes the reported defect: Studio's default button
works. Ship it.

**Then Phase 6**, out of priority order and deliberately. It is independent, it needs no capability,
and until it lands a teacher can still author a lesson nobody can finish. The validation refusal is
worth more than the two remaining actions.

**Then Phase 4, then Phase 5.**

**Phase 7 is not optional garnish.** T031–T033 are the accessibility half of FR-007a, and T041 is
the reason to believe any of the rest.
