# Implementation Plan: A learner can move through a lesson

**Branch**: `012-learner-navigation` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-learner-navigation/spec.md`

## Summary

Make the navigation a lesson already declares actually work. Three of the four authored button
actions have been inert since Wave 2, and a slide set to continue on the learner's request has
never been leavable in either adapter — while validation declares such slides safe.

**What in the kernel changes, and what does not** — stated as a list because the negative version
of this sentence has now needed narrowing twice. It began as "the kernel needs no change", which
was false about validation; corrected to "the advance rule needs no change", which was true and
concealed a second change.

*Unchanged, and the reason this feature is small:*

- **The advance decision logic.** `on_click` is implemented and thoroughly tested;
  `AdvanceSignals.learnerAdvanced` is the input it waits on and both adapters pass `false`
  permanently. What is missing is a producer, not a rule.
- **The transport.** `goToSlide` already clamps both ends and already completes the lesson past
  the last slide.

*Changed:*

- **Validation.** `checkReachability` gains an `on_click` branch and a warning for a control that
  can never be operated. The root README defines `@cuestack/core` as the headless kernel
  *including validation*, so this is a kernel change, and `packages/core/src/advance/**` sits
  inside the 90% branch-coverage floor's include list (`vitest.config.ts`) against a workspace
  already red at 89.03%.
- **The public surface.** Core gains a pure predicate answering *would anything refuse a learner
  who asked to leave this slide* — because today that question cannot be asked. The rule lives
  inside `evaluate`, which records a decision, so a speculative call consumes the one the slide
  needed; and the conditions live in `conditions.ts`, which no adapter can import, since core has
  a single entry point. Without this, BR-005 gets reimplemented in two adapters.

**Phase 0 found the trap.** The obvious implementation of Replay is `transport.restart()`, and
it is wrong: `restart()` resets the clock without bumping the visit, `instanceId` is "slide id
plus visit counter", and the advance controller keys its decided-set on it — so a slide replayed
that way would never advance again. `goToSlide(currentIndex)` is the correct call, and the
better-named function is the broken one ([research R-02](./research.md)).

**The shape of the answer was already in the codebase.** A question's answer reaches the player
through `interactionFor(resolved)` — a narrow capability built per element, closing over the
transport, handed to the renderer as a prop. Navigation is the same shape one type over. That is
what keeps FR-012 intact: a renderer gets a verb and no nouns.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict, ESM-only

**Primary Dependencies**: none new. The work is in `@cuestack/core` (one validation branch),
`@cuestack/react` (the capability, the button renderer, focus placement) and
`@cuestack/element` (the same capability, built differently, plus one covered type)

**Storage**: none. Learner intent is momentary — it describes a press, not a state. Nothing
here is stored and nothing carries anything about the learner

**Testing**: Vitest 4.1.10 with happy-dom. Focus assertions inside a shadow root must read the
root's `activeElement`, not the document's (research R-08)

**Target Platform**: browsers, both adapters

**Project Type**: monorepo of libraries — `@cuestack/schema` ← `@cuestack/core` ← adapters

**Performance Goals**: unchanged. A press is not a frame; nothing here runs in the loop

**Constraints**: no lesson-format change and no migration — all four actions and the `on_click`
mode have been in the schema since Wave 1; a renderer still receives no access to the lesson,
the slide, the transport, or the time; preview and playback are the same renderer and must stay
so

**Scale/Scope**: one capability, one validation branch, one covered type added to the second
adapter, focus placement in both

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — result at the end of this section.*

| Principle | Assessment |
|---|---|
| **I. Code Quality & Modular Boundaries** | **Pass, with the rule this feature is most likely to break.** The capability must be built by the player and bound per element — not handed to renderers as a transport, and not reached by a renderer through `usePlayer()`. Both shortcuts work on the first try and both give a renderer the lesson. No `switch` on element type: the button renderer already exists and is registered like any other. No manifest change, so no `schemaVersion` bump. |
| **II. Test-First & Deterministic Verification** | **Pass, with a coverage consequence worth naming.** `reachability.ts` is inside the 90% branch-coverage floor and measures 77.77% branches over the advance suite today; the workspace sits at 89.03% against that floor and is already red. The new `on_click` branch has two sub-cases, and T026 covers both — but that is now stated rather than hoped for, because a floor that is already failing hides a small worsening. **And one test must be rewritten rather than relaxed.** `unsatisfiable.test.ts` asserts that `on_click` "cannot be unsatisfiable" — a negative assertion, and relaxing it to accept the new behaviour is a one-character edit that also stops it catching anything. It splits: `after_duration` keeps a test saying it cannot be unsatisfiable, `on_click` gets cases in both directions (research R-05). |
| **III. User Experience Consistency** | **Pass, and this is the row the feature is about.** A control that does nothing is the worst version of a UX failure — it looks operable. FR-005 keeps every control keyboard-operable and announced; FR-007a adds the half that was missing, since focus currently falls to `document.body` when the pressed button is removed. `aria-disabled` stays on controls that cannot move, for the reason `ButtonElement.tsx` already gives, but now guarding a fact about the lesson rather than about the framework (research R-09). |
| **IV. Performance as a Contract** | **Pass, and no budget is touched.** A press is an event, not a frame. Nothing added here runs in the frame loop. The one thing to watch is `navigationFor` allocating per element per render, which is the cost `interactionFor` already pays and which React only incurs when the visible set changes. |
| **V. Preview-Player Parity (NON-NEGOTIABLE)** | **Pass, and it needs stating.** Preview and playback are the same renderer, so a button that works in the player works in the preview — but the editor's preview drives the transport itself, and a navigation press that moved a *teacher's* preview without the timeline following would be the two disagreeing. FR-014 requires the behaviour to hold in preview; what it must not do is give preview a second way to change slides that the timeline does not see. |

**The security constraint, and why it is smaller than it looks.** `open_url` already opens
author-supplied URLs and is the one action that works today. This feature does not touch it, and
must not: FR-004 says so explicitly, and the temptation is to "tidy" all four actions through one
new path. The three navigation actions carry no author-supplied string at all — they are enum
values that select a transport call — so the new route has no injection surface of its own.

**What this feature could quietly give up.** The capability route exists so a renderer cannot
reach the lesson. Every convenient implementation breaks it:

- adding `transport` to `ElementRendererProps` (one line, and every third-party renderer can
  then read the lesson shape);
- calling `usePlayer()` inside `ButtonElement` (already possible today, needs no plumbing, and
  hands the renderer the whole transport);
- dispatching a DOM event and listening on the stage (keeps types clean, makes the contract
  implicit, and the web component would need a second mechanism regardless).

None of these fails a test today. SC-007 requires the restriction be verified structurally, and
that assertion is the reason the shortcut gets noticed.

**Post-Phase-1 re-check: passes.** The design adds no violation. The item to watch through
implementation is Principle I, above: three separate shortcuts produce a working button and a
weaker boundary, and the difference is invisible until a third-party renderer breaks.

## Requirement coverage

One row per functional requirement and the artifact that satisfies it. Kept because feature 011
lost a MUST between its contract and its task list, and a table of tasks would have looked
complete.

| Requirement | Satisfied by |
|---|---|
| FR-001 | `navigationFor` in `@cuestack/react`; the equivalent in `LessonElement`; both raise `learnerAdvanced` |
| FR-002 | `createAdvanceController` — already correct; asserted by a test that a waiting slide does not self-advance |
| FR-003 | `ButtonElement.tsx` and the element adapter's button renderer |
| FR-003a | `available` derived from whether the lesson would let the learner leave — false for an unanswered required question (BR-005, every mode) and for a mode-declared gate; asserted per adapter, and separately for the `after_duration` + required-question case the enumeration missed |
| FR-003b | The same computation ignores the editor's `overrideAdvance`; asserted in `@cuestack/studio`'s preview suite |
| FR-003c | Back and Replay stay available on a gated slide; asserted alongside the gate case so the two rules are read together |
| FR-003d | A pure predicate on `@cuestack/core`'s public surface, over `(slide, signals)`; asserted to leave the advance decision untouched when called |
| FR-004 | `open_url` untouched; a test asserts its behaviour is unchanged |
| FR-005 | Native `<button>` in both adapters; axe over a lesson carrying one |
| FR-006 | `checkReachability`'s new `on_click` branch — the control must be on the slide |
| FR-007 | Existing announcement in `LessonPlayerClient`; asserted for a learner-caused change |
| FR-007a | Focus placement on the incoming stage, both adapters (research R-04, R-08) |
| FR-008 | `goToSlide` clamping (already correct) plus `aria-disabled` on a control that cannot move — three cases now: no previous slide, no next slide, unsatisfied gate |
| FR-009 | One press, one movement — asserted against double-press and against a held key |
| FR-010 | `goToSlide(current)` for replay bumps the visit, so completion re-fires (research R-02) |
| FR-011, FR-011a | `checkReachability` + publishing refusal; two distinct messages |
| FR-011b | A warning-severity code beside `ELEMENT_BEYOND_SLIDE` for a `next_slide` control on a gated slide; asserted on severity as well as code |
| FR-012 | `SC-007`'s structural assertion — no transport, lesson, slide, or time in renderer props |
| FR-013 | `COVERED` gains `button`; the four places that state the adapter's scope updated together |
| FR-013a | The stranding report keeps covering `question`; `covered.test.ts`'s partition updated |
| FR-014 | Preview drives the same renderer; asserted in `@cuestack/studio` |

## Project Structure

### Documentation (this feature)

```text
specs/012-learner-navigation/
├── spec.md
├── plan.md              # this file
├── research.md          # nine findings, four of which change the design
├── data-model.md
├── contracts/
│   └── navigation.md    # the capability, and what a renderer may not have
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
packages/core/src/advance/
├── reachability.ts        # CHANGED — an on_click branch, third of the same shape
└── conditions.ts          # CHANGED — a pure "may a learner leave on request" predicate

packages/core/src/index.ts # CHANGED — that predicate joins the public surface

packages/react/src/
├── player/LessonPlayerClient.tsx   # CHANGED — navigationFor, and focus on slide change
├── player/SlideView.tsx            # CHANGED — passes it through, as it does interactionFor
├── player/Stage.tsx                # CHANGED — a programmatic focus target
├── elements/registry.tsx           # CHANGED — NavigationAccess on ElementRendererProps
└── elements/builtin/ButtonElement.tsx  # CHANGED — the actions work; aria-disabled stays

packages/element/src/
├── covered.ts             # CHANGED — button joins COVERED, and its comment's reason expires
├── renderers.ts           # CHANGED — a button renderer, and one more bound parameter
├── LessonElement.ts       # CHANGED — builds the capability; focus on slide entry
└── README.md              # CHANGED — the table, and the package description with it

packages/core/test/advance/unsatisfiable.test.ts   # CHANGED — the negative assertion splits
packages/element/test/covered.test.ts              # CHANGED — the partition names one fewer
```

**Structure Decision.** Nothing new is created. The capability follows `interactionFor`'s
position exactly — built in `LessonPlayerClient`, threaded through `SlideView`, consumed as a
prop — because a second pattern for the same problem is how two mechanisms end up disagreeing.
The element adapter builds its own, since it has no props to thread and already holds the
transport in the same method that would raise the signal.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A second capability type alongside `InteractionAccess` | A button needs a verb the question capability does not have, and giving `InteractionAccess` a `navigate` member would hand every question renderer the ability to change slides | One capability with optional members means every renderer can call anything, which is the boundary FR-012 protects |
| The element adapter builds its own | It has no React props to thread and no context; `renderElement` takes bound functions already (`resolveAsset` is one) | Sharing the player's implementation means depending on `@cuestack/react`, which fails FR-013 structurally |
| Changing a rule the validation engine states confidently | FR-011: `on_click` is only satisfiable if something can satisfy it, and today nothing can | Leaving it means the validator keeps approving lessons that strand every learner, which is the defect |

## Phases

**Phase 0 — Research.** Complete. Nine findings in [research.md](./research.md). Four change the
design; the sharpest is R-02, where the better-named transport method is the wrong one and
picking it produces a slide that replays once and then never advances.

**Phase 1 — Design.** Complete. [data-model.md](./data-model.md), one contract, and
[quickstart.md](./quickstart.md).

**Phase 2 — Tasks.** `/speckit-tasks`. Expected shape: US1 and US2 are both P1 and share the
capability, so the capability is foundational and the two stories split after it. US3 (back and
replay) and US4 (the validation refusal) are independent of each other and of US2.

**What to watch in decomposition.** Feature 011 lost FR-010's transitions between its contract
and its task list while the contract carried them the whole time. The Requirement coverage table
above is keyed to requirements for that reason, and `plan-coverage.test.ts` now checks it
mechanically — but only for what the table lists, so the table is the artifact to get right.
