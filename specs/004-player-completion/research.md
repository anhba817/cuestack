# Phase 0 Research: Player Completion

**Date**: 2026-08-15 · **Feature**: `004-player-completion`

Nine decisions. R-01 and R-02 are the load-bearing ones: the first keeps this wave cheap, the
second is the only place it amends an earlier design.

---

## R-01 — Interaction state does not enter `resolve()`

**Decision.** A learner's responses are held outside the resolver. They reach exactly two places:
the advance controller, through the `completedInteractions` set it has accepted since Wave 1, and
the question renderer, as a prop. `resolve(slide, timeMs)` is unchanged.

**Rationale.** The tempting design is `resolve(slide, timeMs, interactionState)`, so a
`ResolvedElement` can carry the learner's answer and the renderer can be given one thing. It was
rejected on the evidence rather than on principle: **no authored field makes element visibility,
geometry, opacity, or effects depend on an interaction.** Elements appear and disappear on
`startMs` / `endMs`. Advance rules reference interactions; element timing does not. So an
interaction cannot change anything `resolve` computes, and threading it through would add an
argument that no branch reads.

The cost of adding it anyway would not have been cosmetic. `resolve` is a fold with no memory, and
that single property is what gives correct seeking, server rendering, and parity. An argument
carrying accumulated learner history invites the next change to make the fold depend on how the
learner got here, at which point seeking has to replay.

There is a real seam already cut for this. `AdvanceSignals.completedInteractions` exists in
`packages/core/src/advance/conditions.ts` and `hasIncompleteRequiredInteraction` already implements
BR-005 against it. Wave 1 built the gate and passed it an empty set; this wave supplies the set.
Nothing in the kernel's gating logic needs writing.

**Alternatives considered.**

- *Third argument to `resolve`.* Rejected above. Worth restating that the objection is not
  "purity" in the abstract — `resolve(a, b, c)` is as pure as `resolve(a, b)`. The objection is
  that the third argument would be *history*, and a fold over history is a state machine wearing a
  fold's clothes.
- *Interaction state on the transport.* The transport is the clock. Adding answers to it would mean
  the object that answers "what time is it" also answers "what did the learner say", and the two
  have no reason to change together.
- *React context for responses.* Works for the renderer and not for the advance controller, which
  is framework-agnostic. Two sources for one fact.

**Consequence to hold onto.** `ResolvedElement` gains nothing this wave. If a later wave adds an
authored rule like "show this element once the question is answered", that is the moment to
revisit — and it will be a deliberate change to what a slide's timing *means*, not a plumbing
detail.

---

## R-02 — The media port becomes bidirectional, with one authority rule

**Decision.** `MediaPort` gains `play(elementId)`, `pause(elementId)`, and
`seek(elementId, positionMs)` alongside `query` and `subscribe`. The reconciliation rule is
single and stated:

> **The transport is the only clock. Either side may request a position change; every change is
> applied to the transport, and the transport then commands the media.**

A reported position within **`MEDIA_SYNC_TOLERANCE_MS` (500 ms)** of the last commanded position is
an echo and is discarded. Outside it, the report is treated as the learner having moved the media
directly, and the transport seeks itself to match.

The value is derived rather than chosen: its floor is the ~250 ms cadence a playing media element
reports at — the same figure Wave 1 picked for `CLAMP_CEILING_MS`, for the same reason — and its
ceiling is the 1000 ms step Wave 2 fixed for the seek slider, which is the smallest deliberate move
a learner can make. Both bounds are asserted by tests, so a later change to either fails loudly
rather than silently making the constant wrong (contracts/media-port-contract.md).

**Rationale.** Wave 1 chose a read-only port and recorded the reason (feature 002 research R-04):
the kernel decides what a media position means, the adapter decides how it is learned, and one
direction keeps the division clear. That reasoning is still correct. What changed is that Wave 2
shipped a seek control, so "the lesson cannot move its media" now has a visible consequence: drag
the slider on a slide with a video and the two come apart, permanently, with no way back.

The single-authority rule is the whole substance of the decision. Two clocks now exist by
necessity — a media element owns its own playback position and no amount of design removes that.
What is avoidable is **two policies** for reconciling them, which is what arises if each call site
decides for itself whether to trust the transport or the media. FR-037 exists to forbid that, and
`media/reconcile.ts` is one pure function so there is one place to read.

**On echo suppression by tolerance rather than by a flag.** The naive loop is real: the transport
seeks the media, the media reports its new position, the listener seeks the transport, which
commands the media again. The obvious fix is an `ignoreNextReport` flag. It was rejected because a
flag is state that can be left set — a seek that the platform silently refuses never produces the
report that would clear it, and the next genuine learner scrub is then swallowed. Comparing
positions has no such failure mode: it is a function of two numbers, and a stale comparison is
simply a comparison against an old number, which resolves itself on the next report.

**On a seek the media cannot honour** (FR-035). Browsers do not guarantee a seek lands, and an
unbuffered range may take arbitrarily long or never resolve. The rule: the transport moves
immediately and the media is asked to follow. If the media has not arrived within tolerance by the
time it next reports, the lesson displays the media's actual position rather than the commanded
one. The lesson never waits on the media, and never claims a position the media is not at.

**Alternatives considered.**

- *Read-only, and disable seeking on media slides.* Considered and rejected during specification. A
  control that vanishes per slide is confusing, and Wave 4's timeline needs media seeking anyway,
  so this defers the work rather than avoiding it.
- *Media as authority when present.* Would make lesson time depend on which elements a slide
  happens to contain, so the same authored timing means different things on different slides.
- *Bidirectional with symmetric authority ("last writer wins").* This is the design that produces
  the loop. Symmetry is exactly what has to be broken.

**What degrades.** For elements synchronised to media, parity weakens from "identical" to "within
tolerance" — the tolerance FR-PLY-018 already defines for non-streaming elements does not apply to
a streaming clock. This is stated in the contract rather than left to be found.

---

## R-03 — Reduced motion: the kernel supplies both answers, CSS chooses

**Decision.** `EffectDescriptor` gains an optional `reduced(progress, params)` returning a
`Contribution`. `resolve()` composes a second visual from the reduced contributions, and returns it
alongside the normal one **only when at least one active effect declares motion**. The renderer
emits both as custom properties; the stylesheet selects inside
`@media (prefers-reduced-motion: reduce)`.

**Rationale.** FR-028 is the constraint that decides this: the preference must be honoured on the
first rendered frame, before any script. That frame is produced on a server which cannot read the
preference. Therefore the choice must be made by CSS at paint time, which means **both answers
must already be in the markup**. Nothing else satisfies it.

Feature 002's research R-09 got the shape half right: it put `motion: boolean` on the descriptor
and left substitution to the consumer as a stylesheet concern, which is what Wave 2 implemented as
a blunt floor — neutralise `--cs-tx`, `--cs-ty`, `--cs-sx`, `--cs-sy`, `--cs-rotate`. That
satisfies "no movement" and cannot express BR-015's actual requirement, which is *substitution*: a
slide-in should become a fade, not an instant appearance. Only the effect knows what its reduced
form is, so only the effect can declare it — and a consumer-side list of substitutions would be
the "list that rots the first time a ninth effect is registered" that R-09 itself warned about.

**Why not compute it in the kernel from the preference.** Because the kernel would have to know
the preference, which on the server it cannot. Passing it in as a parameter would make `resolve`
return different answers for the same lesson and time, which is exactly the property SC-009 tests.
Emitting both keeps `resolve` a function of its arguments alone.

**Cost, and its bound.** Every element with an active motion effect carries roughly twice the
custom properties, and the frame writer writes twice as many. Bounded three ways: elements with no
active effect emit nothing extra (the stylesheet's fallbacks already supply identity); effects that
do not move declare no alternative and contribute nothing to the second set; and the writer's
existing per-element signature cache skips unchanged frames for both sets equally.

**Alternatives considered.**

- *A second stylesheet loaded under a media query.* Cannot express per-effect substitution either;
  the substitution depends on which effect is running, which is data and not selector state.
- *Emitting a `data-cs-reduced` attribute per element and styling from it.* The attribute would
  have to be set from the preference, which returns the problem to the server.
- *Substituting in the frame writer.* Client-only by construction, so the first frame is wrong.

---

## R-04 — Slide advancement, and where the slide index lives

**Decision.** `LessonPlayerClient` owns the current slide index in state and drives it from
`createAdvanceController`. The transport keeps `goToSlide`; the controller decides *when*.

**Rationale.** This has to be built, not extended. `slideIndex` is currently a fixed prop, nothing
in `@cuestack/react` imports the advance controller, and no test noticed because every player test
renders a single slide. Feature 003's quickstart states "If you press play and reach the end of a
slide, it advances", which is not true — recorded here because a false claim in a shipped document
is worse than a missing feature, and the correction belongs in this wave's quickstart pass.

The index belongs to the player rather than the transport because the transport already exposes
`slideIndex` and `goToSlide`: the player asks the controller whether the slide is finished, and
tells the transport to move. Keeping the *decision* in the controller is what makes BR-005,
BR-006, and BR-007 testable without React.

**Single-fire (BR-007).** Already solved in Wave 1 and already correct: the guard keys on
`slideId#visitCount`, so a replayed slide can advance again while a duplicated media-end event
within one visit cannot. Scenario C's "a duplicate end event shall not advance two slides" is
therefore a test of existing behaviour through a new path, not new behaviour.

---

## R-05 — Interaction outcome is a lesson rule, so it lives in core

**Decision.** `packages/core/src/interactions/` holds response evaluation and the three completion
policies. The renderer holds none of it.

**Rationale.** `completionPolicy` is `on_first_attempt | on_correct | on_attempts_exhausted`, and
which of those has been reached decides whether a required question releases the slide. That is a
rule about lessons: a Vue adapter must reach the same conclusion from the same answer, and BR-005
is enforced in core already. Putting the policy in the React renderer would mean the gate and the
display disagree the first time a second adapter exists.

The division is the same one the element registry draws: the renderer decides what a radio group
looks like and how it announces itself; it does not decide what counts as complete.

**The three policies, stated once so they are not restated three times.**

| Policy | Complete when |
|---|---|
| `on_first_attempt` | Any answer has been submitted, correct or not |
| `on_correct` | A correct answer has been submitted |
| `on_attempts_exhausted` | A correct answer has been submitted, or `maxAttempts` submissions have been made |

`on_correct` with no retries and a wrong answer is a reachable dead end — a required question that
can never complete, on a slide that will therefore never advance. The kernel already has a name for
this shape (`ADVANCE_UNSATISFIABLE`); US5 presents it, and Wave 5's validation engine is where an
author is warned before a learner meets it.

---

## R-06 — Transitions render two slides; the kernel renders one

**Decision.** `SlideTransition` renders the outgoing and incoming slides simultaneously, each
resolved at its own slide time, for the authored duration. The animation is CSS. `resolve()` is
untouched and knows nothing about transitions.

**Rationale.** A transition is both slides being visible; there is no way to express it with one.
Resolving each at its own time keeps effects running on the outgoing slide while it leaves, which a
frozen snapshot would not. The cost is one extra `resolve()` per frame for the transition's
duration only, against a budget that already absorbs 300 elements in well under a millisecond.

CSS rather than JavaScript for the same reason as everything else here: a transition driven by
React state is a re-render per frame, which is the cost the frame loop was kept out of React to
avoid.

**Interruption** (US3 #8). A seek or a navigation during a transition settles it immediately to the
incoming slide rather than reversing or queueing. Two slides visible after an interruption is the
only outcome that is definitely wrong, and settling is the one resolution with no intermediate
state to get stuck in.

---

## R-07 — Errors are presented from what the kernel already reports

**Decision.** The player presents `RenderState.blocked` — a `BlockingProblem` — as a learner-facing
state, mapping each code to a message and a recovery. `RenderState.problems` are authoring
diagnostics and are **not** shown to a learner (FR-024).

**Rationale.** Wave 1 defined `ADVANCE_UNSATISFIABLE`, `ADVANCE_MEDIA_FAILED`, and
`UNKNOWN_REQUIRED_INTERACTION`, and no consumer has ever displayed one. This wave is presentation,
not detection, which is why US5 is ranked last and is still not optional: an unpresented blocking
condition is a learner staring at a slide that will never move.

The distinction between the two lists is the requirement. A `RenderProblem` like
`EFFECT_BEYOND_SLIDE` is a note to an author; showing it to a learner would violate FR-024 and
NFR-USA-004 both, since a learner can take no action on it. A `BlockingProblem` is the opposite:
the learner is stuck, and only they can be told.

Messages must name the problem, the affected object, and the recommended action (NFR-USA-004) —
with the object named in the learner's terms. "The video on this slide could not be loaded" is the
object; `element_briefing_video` is not.

---

## R-08 — The gesture gate is a lesson-level latch

**Decision.** One latch per lesson, not per media element and not per slide. Audible media is media
with non-zero volume that is not muted. Before the latch is set, the transport does not start and
the player shows a prompt naming the action.

**Rationale.** BR-014 and FR-PLY-007 require an initial user action before playback containing
audible autoplay media; FR-015 forbids asking again. Per-element would ask on every slide with
sound, which is the behaviour learners already resent from the browsers that do it. Per-lesson
matches what the requirement says — "an initial user action" — and browsers grant autoplay
permission at document scope anyway, so a second prompt would be asking for something already
granted.

Pressing play *is* a gesture, so a learner who starts manually never sees the prompt. It appears
only where `autoPlay` is requested and the lesson contains audible media.

---

## R-09 — The performance fixture is generated, and both budgets are measured separately

**Decision.** `tools/scripts/fixtures/heavy-lesson.mjs` generates 50 slides and 300 elements at run
time. `gates/perf.mjs` arms two budgets on it: frame cost during playback (60 fps target, 30 fps
floor) and seek-to-rendered-state (100 ms), each failing on a 10% regression.

**Rationale.** The Constitution requires this fixture in CI and Wave 2 deferred the playback half
with a stated reason — there were no frames to drop. There are now. Generating rather than
committing follows feature 001's finding: a checked-in artefact disagreed with the schema on its
first real run, and a 300-element manifest is exactly the file nobody re-reads.

**Measuring frames without a browser.** happy-dom has no compositor, so "60 fps" cannot be observed
directly. What is measured instead is the work the player does per frame — resolve, compose, and
the frame writer's property writes — against a 16.7 ms budget, with the frame loop driven by the
virtual clock. That is a proxy, and it is the honest one: it measures everything the framework
controls and nothing it does not. Actual paint cost belongs to a browser-based check, which this
wave does not add and which the gate's output should say so it is not mistaken for a full answer.

**Two budgets, not one.** A single "playback is fast" number would let a seek regression hide behind
frame headroom. NFR-PERF-003 and NFR-PERF-004 are different promises to a learner — one about
scrubbing, one about watching — and they fail independently.
