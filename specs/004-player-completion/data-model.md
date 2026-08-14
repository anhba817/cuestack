# Phase 1 Data Model: Player Completion

**Date**: 2026-08-15 · **Feature**: `004-player-completion`

Feature 001 described stored data, 002 computed data, 003 presented data. This one describes
**session data** — what is true of one learner's pass through a lesson, none of which is in the
manifest and none of which outlives the session.

---

## Where the new state sits

```
LessonManifest ──resolve(slide, t)──> RenderState ──> CSS properties
   (001)               (002)                (003)

InteractionState ──┬──> AdvanceSignals ──> AdvanceController ──> slide index
   (this feature)  └──> QuestionElement                             (this feature)

MediaLink ─────────┴──> AdvanceSignals
   (this feature)
```

The important shape is what is *absent*: no arrow from `InteractionState` or `MediaLink` into
`resolve`. Both feed the advance decision and the renderer, and neither feeds the resolver
(research R-01). That is what keeps seeking a recomputation.

---

## Entity: InteractionResponse

One learner's answer to one question. Held for the session; never persisted.

| Field | Type | Notes |
|---|---|---|
| `elementId` | string | The question answered. |
| `selected` | string \| readonly string[] | Option id, or ids when a later wave adds multi-select. |
| `attempt` | integer ≥ 1 | Which submission this was. |
| `correct` | boolean | Compared against `correctResponse` by the kernel, not the renderer. |
| `atMs` | integer | Lesson time when submitted. Diagnostic and event payload; nothing reads it to decide anything. |

**No learner identifier, of any kind.** NFR-PRV-002 forbids one in the manifest; FR-006 extends that
to what this feature emits. A host that wants attribution correlates on its own side, from its own
session, and the framework never sees it.

## Entity: InteractionState

Every response so far, keyed by element.

| Member | Purpose |
|---|---|
| `responses` | `ReadonlyMap<elementId, InteractionResponse[]>` — attempts in order |
| `outcomeOf(elementId)` | The derived `InteractionOutcome`, never stored |
| `completedIds` | The set the advance controller consumes, derived from outcomes |

**Keyed by element, not by slide instance.** A learner who answers, navigates back, and returns
finds their answer intact, and navigation does not consume attempts (spec Assumptions). Wave 1's
`slideId#visitCount` instance key exists to make *advancement* fire once per visit; it deliberately
does not scope answers, because those are two different questions — "has this slide advanced on
this visit" and "has this learner answered this question".

`outcomeOf` derives rather than stores. A stored outcome is a second copy of something computable
from the responses, and the two disagree the moment the policy is read twice.

## Entity: InteractionOutcome

| Field | Type | Notes |
|---|---|---|
| `complete` | boolean | What gating reads. Derived from the policy — see the table in research R-05. |
| `correct` | boolean | Whether a correct answer has been given at all. |
| `attemptsUsed` | integer | |
| `attemptsRemaining` | integer \| null | `null` when unlimited. Shown to the learner (FR-004). |
| `exhausted` | boolean | No attempts left and not correct. |
| `unsatisfiable` | boolean | Complete can never be reached — `on_correct`, exhausted, no retries left. Feeds `ADVANCE_UNSATISFIABLE` rather than a silent stall. |

`unsatisfiable` is the field worth having. Without it a dead-end question is indistinguishable from
one the learner has not got to yet, and the slide waits forever with nothing to report.

## Entity: MediaLink

The two-way relationship between the lesson and one media element. Replaces Wave 1's one-way
`MediaStatus` observation (research R-02).

| Field | Type | Notes |
|---|---|---|
| `elementId` | string | |
| `reportedMs` | number | Where the media last said it was. |
| `commandedMs` | number \| null | Where the lesson last told it to be; `null` if never commanded. |
| `durationMs` | number \| null | `null` while unknown — a manifest duration may disagree with the file, and the file wins. |
| `ended` | boolean | |
| `paused` | boolean | |
| `failed` | boolean | |
| `following` | boolean | False while a commanded seek has not yet landed within tolerance. |

`following` is the honesty flag. While it is false, the lesson displays `reportedMs` rather than
`commandedMs`, which is FR-035: never claim a position the media is not at.

## Entity: TransitionState

| Field | Type | Notes |
|---|---|---|
| `from` | slide index | |
| `to` | slide index | |
| `type` | `none \| fade \| slide \| zoom` | Authored on the **incoming** slide. |
| `durationMs` | integer | |
| `startedAtMs` | number | Lesson time the transition began. |

Both slides are resolved at their own slide times for the duration (research R-06). `type: 'none'`
and `durationMs: 0` both mean an immediate change, and both must be handled: the format permits
either.

## Entity: PlaybackProblem

What a learner is shown when the lesson cannot proceed. Derived from `RenderState.blocked`.

| Field | Type | Notes |
|---|---|---|
| `code` | the kernel's `BlockingProblem['code']` | Never displayed. |
| `message` | string | Names the problem, the affected object in learner terms, and the recommended action (NFR-USA-004). |
| `retryable` | boolean | Whether offering a retry can change anything. A failed asset can; an unsatisfiable advance rule cannot. |

`RenderState.problems` — the authoring diagnostics — are deliberately **not** modelled here. They
are not learner-facing (FR-024, research R-07).

## Entity: LessonProgress

| Field | Type | Notes |
|---|---|---|
| `slideIndex` | integer | Zero-based. |
| `slideCount` | integer | |
| `visited` | ReadonlySet\<integer\> | Slides reached, so seeking backwards does not reduce progress. |

Displayed only when the host enables it (spec Assumptions; FR-020). Slides rather than time,
because a lesson's slides have wildly different durations and a time bar would imply otherwise.

## Entity: MotionPreference

Not a runtime value in the kernel at all, and listed to say so.

The reduced-motion decision is made by CSS at paint time from the platform preference. Nothing in
`@cuestack/core` or `@cuestack/react` reads it, stores it, or branches on it — the kernel emits both
visuals and the stylesheet chooses (research R-03). Modelling it as state would mean something was
reading it in JavaScript, which is the design that breaks FR-028.

## What is deliberately absent

- **No score.** Points and scoring are FR-INT-008, a "Should", and out of scope. Adding a score
  field now would fix a shape before the requirement is understood.
- **No persistence.** Cross-session resume is FR-PLY-015, a "Should". Everything here lives for the
  session, which is why none of it is in the manifest.
- **No interaction state on `ResolvedElement`.** Research R-01. The resolver's output is unchanged
  by this feature.
- **No lesson-level pass mark.** Completion means reaching the end of the final slide (spec
  Assumptions); whether a learner *passed* is a product decision nobody has made.
- **No media state in the transport.** The transport is the clock. `MediaLink` is separate, and the
  link between them is one function (research R-02).

## State transitions

The player's states, extending feature 003's:

```
                     ┌──────── needs gesture ◄── autoPlay + audible media
                     ▼                              (BR-014)
loading ──> ready ──> playing ──pause──> paused
                        │  ▲                │
                        │  └────seek────────┘
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
        transitioning  blocked  completed
              │         │          │
              └──> playing         └──review──> playing
                        ▲
                        └── unblocked (answer given, asset retried)
```

`blocked` is new and is the state US5 exists to make visible. It is reachable from `playing` at any
moment — a required question left unanswered, an asset that fails mid-slide, an advance rule that
cannot be met — and it is escapable in every case except `unsatisfiable`, where the learner is
offered the way forward FR-030 requires rather than being left in it.
