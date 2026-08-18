# Phase 0 Research: Preview Harness

**Date**: 2026-08-18 · **Feature**: `007-preview-harness`

Ten decisions. R-01 answers the risk the specification named; R-03 is the one member this feature
gives a producer; R-07 is what turns a placeholder into a gate; R-09 is about a way out of the
preview that is not the manifest; R-10 is about what a restart restarts.

---

## R-01 — The preview mounts the player; it does not build one

**Decision.** `Preview` renders `<LessonPlayerClient>` over the draft, with the editor's own chrome
passed as `children`. It seeks to the start point through the transport handed back by `onReady`.
No player component is forked, wrapped, or reimplemented.

**Rationale.** The specification named the drift signal in advance: "if planning finds itself adding
a preview-shaped prop to the player, or forking a second player component, that is the drift
signal." So the first thing to check was the player's props rather than to reason about them.

`LessonPlayerClientProps` already carries everything a preview needs:

| Prop | What a preview does with it |
|---|---|
| `lesson` | the draft, as it currently stands (FR-002) |
| `slideIndex` | where the preview starts (FR-009) |
| `ports` | the real browser ports, or a hand-advanced clock in a test |
| `resolveAsset` | the host's resolver, inherited from the editor (FR-003) |
| `children` | the preview's own controls, rendered inside so they share one transport |
| `onReady(transport)` | the seek that turns a starting *slide* into a starting *moment* (FR-010) |
| `ports` | a **partial** in production, carrying only a discarding `analytics` (R-09); a test's full object with a hand-advanced clock otherwise (Constitution II) |

`Ports.assets` is worth one line of warning: it is declared (`core/src/adapters/index.ts:43`) and read by nobody. Assets reach the player through the `resolveAsset` prop (`SlideView.tsx:48`), which is what R-04 builds on; wiring the port would do nothing. The sixth contract member this wave has found declared without a producer.

That last row is the whole of FR-010 and it needs no new mechanism. `onReady` was added so a host
could drive playback; a preview is a host.

The `children` prop's own comment settles a question that would otherwise have been a design
decision here: controls go *inside* the player "because controls need the transport and the
transport must stay singular: a host holding its own would be a second idea of the current time."
Feature 006 learned the same lesson from the other direction.

**Alternatives considered.**

- *A `PreviewPlayer` component in `@cuestack/react`.* Rejected twice over: it would duplicate the
  player, and it would put an editor concept in the package a learner loads —
  `check-studio-isolation` exists to prove that never happens.
- *Rendering the player and controlling it from outside via a ref.* Rejected: `usePlayer` and the
  context already exist for exactly this, and reaching around them is how a second transport gets
  created by accident.

---

## R-02 — The start point is captured once, at the moment the preview opens

**Decision.** `startPoint.ts` reads the session's `slideId` and `authoringTime` and returns a slide
index and a moment. It is called once, when the preview opens, and never again while it runs.

**Rationale.** FR-012 requires restart to return to where the *preview* began, not to the lesson's
beginning and not to wherever the editor's playhead has since been left. Capturing once makes that
true by construction: a value that cannot change cannot drift.

It also keeps the coupling one-directional. The editor tells the preview where to start; the
preview tells the editor nothing. That is what makes FR-006's "closing returns the editor to what it
held before" a matter of *not doing anything* rather than of restoring a snapshot — the editor was
never modified.

The conversion from `slideId` to `slideIndex` is a lookup, and it is the only translation between
the editor's vocabulary (a slide id, because the session holds per-slide state by id) and the
player's (an index, because a lesson is an ordered array). Keeping it in one pure function means
the mismatch is stated once rather than assumed everywhere.

**Alternatives considered.**

- *Follow the editor live.* Rejected: the preview is modal, so nothing can change behind it — and a
  live link would make "restart" ambiguous between two meanings.
- *Pass the authoring time straight to the player.* Not possible, and the reason is worth recording:
  the player has no "start at time" prop, and adding one would duplicate `transport.seek`.

---

## R-03 — The override is the advance controller's, and this is its first producer

**Decision.** The preview enables the controller's existing `allowOverride` option and raises
`signals.overrideAdvance` while the switch is on. `LessonPlayerClient` gains one optional prop to
carry it. Nothing new decides whether a slide may advance.

**Rationale.** The specification called this "the one item most likely to need a clarification
round", and clarification settled its *shape* — one switch for the preview's lifetime — but not its
home. Reading the code answered that: the home already exists.

```text
AdvanceControllerOptions { allowOverride?: boolean }   // "Test-only." Never passed.
AdvanceSignals           { overrideAdvance?: boolean }  // "Test-only; inert unless…" Never passed.
AdvanceCause             = … | 'override'               // Never produced.
```

`LessonPlayerClient` calls `createAdvanceController(activePorts)` with no options and builds signals
with `learnerAdvanced` and `completedInteractions` only. So all three members are declared,
correctly designed, and have no producer anywhere in the repository — the **fifth** instance of this
pattern in Wave 4, after `ElementPlugin.inspector`, `EffectDescriptor.parameters`,
`RenderState.problems`, and `ResolveContext.effects`.

The controller's short-circuit is exactly the semantics FR-017 asks for: it outranks every
condition including BR-005's required-interaction gate, which is what lets a teacher past a question
they have not answered.

**What must not change, and it is written in the option's own comment**: "a test affordance that
leaks into playback is worse than none, because it will eventually fire by accident (FR-025)." The
bound is therefore the prop's *absence*. A learner's player passes nothing, `allowOverride` stays
false, and the signal is inert even if something set it. Two conditions must both hold for an
override to fire, and a learner's player satisfies neither.

What changes is a comment: "test-only" becomes "test and preview". That is a documentation change to
a contract that anticipated this consumer — FR-ADV-011 has been in the product specification since
before Wave 1.

**Alternatives considered.**

- *A preview-specific bypass in the studio package.* Rejected: a second answer to a question the
  controller already answers, and the two would drift the first time a gate kind was added.
- *Always constructing the controller with `allowOverride: true` and relying on the signal alone.*
  Rejected: it removes one of the two conditions protecting a learner's player, for no gain. Two
  independent falsehoods are better than one.

---

## R-04 — The editor gains an asset resolver, because it never had one

**Decision.** `EditorCanvasProps` gains `resolveAsset?: AssetResolver` and passes it to `SlideView`.
The preview inherits the same value.

**Rationale.** FR-003 requires the preview to fetch real assets the way the player will. The preview
takes its resolver from the editor — but the editor passes none, so `SlideView` falls back to
`defaultAssetResolver`.

That is a gap in the *editor*, discovered by asking a question about the preview: a host that
supplies a resolver to `<LessonPlayer>` has had no way to supply one to `<EditorCanvas>`, so the
canvas has never been able to show a host's real images. It has looked correct because the reference
lesson's assets are opaque ids that nothing serves, which is exactly the condition under which a
missing resolver is invisible.

Closing it in the editor fixes both surfaces and keeps one answer to "what does this asset id mean".
A preview with its own resolver could disagree with the canvas beside it — the parity failure this
feature exists to prevent, one layer down.

**Alternatives considered.**

- *Give the preview its own resolver prop.* Rejected above.
- *Leave the editor alone and let the preview default too.* Rejected: it makes FR-003 unsatisfiable
  for any real host, and the preview would show placeholders while claiming to show what a learner
  receives.

---

## R-05 — A viewport preset changes the room the stage has, not the lesson

**Decision.** A preset sets the width — not a maximum — of the preview's own **viewport wrapper**
around the player. Nothing else changes: not the aspect ratio, not the manifest, not any stored
geometry.

**Rationale.** Wave 2's scaling decision does the work already. Element geometry is stored in
logical canvas coordinates (FR-CAN-017) and the stage scales proportionally to the room it is given
(FR-CAN-018), through container query units — "nothing measures anything". So a preset is a CSS
width and the lesson rescales itself.

The wrapper, not the stage: `LessonPlayerClient` returns its provider with no wrapping element of
its own, and `.cs-stage` **is** the container (`container-type: size; container-name: cs-stage`), so
a control in the frame both cannot and must not style it.

A width rather than a maximum, because R-06 makes the preview a `<dialog>` and the HTML spec's
suggested rendering gives dialog `width: fit-content`. A `max-width` on the wrapper would then cap
something that has no width of its own, and the stage's `width: 100%` would resolve against a
fit-content ancestor — the preview would end up as wide as its control row and the presets would
appear to work, roughly, and be wrong. The dialog takes the viewport with `max-width: none`; the
wrapper takes `width: <preset>; max-width: 100%`. Two decisions made one section apart, and the
second broke the first.

FR-023's "no stored geometry changes" is therefore true by construction rather than by care, and the
test that asserts it is comparing a manifest before and after rather than inspecting a layout.

**What a preset can actually show, which took five passes to state.** It is not the proportion.
`.cs-stage` declares `aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h)`, so the lesson's shape
is fixed by its canvas and a preset makes it smaller, never different. And because every dimension
beneath is in `cqw`/`cqh` against that same canvas, a smaller preview is otherwise the *same
picture* — nothing reflows, nothing repositions, no relative type size changes. On that reading the
story is worth nothing, and the first four passes did not notice.

The exception is the legibility floor, and it is the whole of US5's value. Type is
`max(12px, var(--cs-theme-font-size, 32) / var(--cs-canvas-w) * 100cqw)` (`stage.css:113`), and a
16:9 canvas is 1600 × 900, so the floor takes over below **600 px** for body text, **960 px** for
captions (`:154`), **800 px** for UI text (`:174`, `:212`); outlines and radii have their own
(`:189`, `:200`). Below those widths type stops shrinking with the canvas and grows relative to the
box it was authored in — which is exactly "does the slide still hold together on a phone".

Two consequences. The preset widths must be chosen against those floors rather than against device
marketing numbers, and derived from the canvas, since a 9:16 lesson is 900 wide and its floors sit
elsewhere. And the story's requirement is FR-024, which says what the preview must *show*, not
merely what the control must set.

Worth stating what this deliberately is *not*: no touch simulation, no user-agent spoofing, no
device chrome. The presets answer "does this hold together in less room", which is the question
FR-CAN-018 makes meaningful — and the floors are what give it an answer that can be no. Anything more would be emulation, and emulation that is not faithful is
worse than none because it invites conclusions it cannot support.

**Alternatives considered.**

- *Render into an iframe sized to the device.* Rejected: a second document, a second stylesheet
  load, and a hydration boundary — for a property a max-width already delivers.
- *Change the lesson's aspect ratio per preset.* Rejected outright: that is authored data, and a
  preview that changed it would be editing.

---

## R-06 — The preview is modal, and that is what makes closing free

**Decision.** The preview is a modal `<dialog>`, so nothing in the editor can be operated while it
is open; opening it stops the editor's own clock; and closing restores nothing because nothing was
changed.

**Rationale.** FR-PLY-005 lists a *close* control, which only a modal preview needs. §17.3 frames
preview as a moment of checking rather than a continuous second view.

The structural benefit is FR-006. "Closing returns the editor to the slide, selection, and authoring
time it held before" sounds like a save-and-restore, and would be one for a side-by-side preview
that let editing continue. For a modal, it is the absence of a code path: the session is not
touched, so there is nothing to restore and nothing that can restore it wrongly.

**Two things have to be true for that absence to hold, and neither was true by accident.**

*Covering is not the same as unreachable.* The specification has said from its first draft that
editing while previewing must be "impossible rather than undefined", and a full-screen overlay does
not achieve it — Tab does not respect z-index. Every key handler in the studio is element-scoped
(`onKeyDown` on the elements themselves; there are no document- or window-level listeners), so focus
is the entire path into an edit: one Tab out of the preview and one arrow key nudges an element by
`NUDGE_MS`. The edit would also be invisible, since the preview holds the draft as it stood at open.
The obvious fix — mark the editor `inert` — is not available here: the studio exports parts a host
composes (`EditorCanvas`, `usePlayback`, the timeline, the inspector) and has no editor root the
preview could mark without reaching into a tree it does not own. A modal `<dialog>` needs no such
reach. `showModal()` puts it in the top layer and makes everything outside inert by the platform's
own rule, contains focus, and closes on Escape — which is FR-007's "dismissible by keyboard" as
well. The modal promise becomes the platform's rather than a convention the studio maintains. This
is FR-030.

happy-dom 20.11.2 implements `showModal()` but not the top layer's focus semantics, so the automated
test asserts the mechanism is in place and the manual pass confirms Tab cannot leave.

*The editor's clock does not stop by itself.* `usePlayback` runs `useFrameLoop` for as long as its
state is `playing` and writes custom properties every frame; mounting a preview does not touch it.
A preview opened mid-playback would therefore run two clocks and two frame loops over one slide, and
the authoring time FR-006 promises to restore would move while the teacher was watching — so the
absence-of-restore-code argument above would quietly become false. Opening calls the session
playback's existing `pause()`, which commits the moment through the one write path, and "the time it
held before" resolves to the moment of opening. The specification had covered the closing direction
of this and not the opening one.

**The chrome is split, and the player's own render is why.** `children` is rendered inside a
ternary — `complete ? <LessonComplete/> : gestureGiven ? children : <GesturePrompt/>` — so it is
absent at the completion state and behind a gesture prompt. A Close button that disappeared at the
end of a lesson would leave a teacher with one control: Review, which replays it.

**The line is what must survive that ternary, not what needs the transport.** That distinction took
two attempts to state. The preview holds the transport in a ref anyway — `onReady` gives it one for
the start-point seek — so "needs the transport" does not divide anything. Inside go the controls
that are only meaningful while the lesson plays: play, pause, seek, previous, next. Outside goes
everything that must stay reachable: close, **restart**, the override switch, its indicator, the
viewport preset.

Restart is why the wording matters. It needs the transport *and* US3 §7 requires it at the completion
state, so a transport-based rule puts it in the half that disappears — reproducing the Close defect
one control later.

Focus management is the part that needs real care, and it has a precedent: feature 005's delete
confirmation takes focus when it opens and returns it to the control that opened it when it closes,
with a test for each half. The preview follows it, plus one rule that confirmation did not need —
with two focusable regions, closing returns focus to the Preview button *wherever focus was inside*.

**Alternatives considered.**

- *Side-by-side, updating live as the teacher edits.* A larger and genuinely different feature — it
  would need to decide what happens to playback when the slide under it changes. Recorded as out of
  scope rather than left open.
- *A separate browser tab or window.* Rejected: the draft is in memory, so a second document would
  need serialization the feature has explicitly deferred to ED-5.

---

## R-07 — Parity is asserted as an equality, and the gate must be seen to fail

**Decision.** `packages/studio/test/parity/registered.test.tsx` mounts the **editor canvas** and the
**learner player** over one manifest and compares what each produced, for every registered element
type and every registered effect, at a moment inside each effect's window.
`tools/scripts/gates/parity.mjs` runs it. A negative control makes one renderer disagree with its
counterpart and requires the gate to go red.

**Not preview against player.** That was this decision's first form and it was wrong twice: the
preview mounts `LessonPlayerClient` unmodified, so the two are the same component; and stating the
assertion as `resolve(slide,t) === resolve(slide,t)` compares a pure function with itself, which
holds for any input forever — including after somebody breaks parity. It would have armed the gate
against nothing, which is precisely the failure the rest of this decision is about.

The surface that can diverge is the one where the two sides genuinely differ: `EditorCanvas` renders
with `staticRenderers` and the player with `builtinRenderers`. That split is deliberate — a teacher
composing a slide is authoring a question, not answering one — and feature 005 already found a real
divergence across it, the question element's submit control.

**And feature 005 already built most of the comparison.** `test/parity/overlay.test.tsx` asserts the
editor's render layer is byte-identical to the player's with the overlay subtracted, across all
seven types, with a selection active and with a ghost present; `geometry.test.tsx` covers geometry,
rotation, and paint order; and `state.test.tsx` carries a guard named *"changes with time, so the
equality above is not vacuous"* — the same tautology this decision's first draft fell into,
anticipated a whole feature earlier.

So the remaining surface is narrower and sharper than "canvas versus player". The two renderer sets
are the same seven objects except one: `staticQuestionRenderer` against `questionRenderer`. The
question element **is** the divergence surface, and it is exactly where the known divergence was.

**Rationale.** SC-001 could have been read as SC-003's 100 ms tolerance measured between two mounts.
It should not be. Preview and playback are the same `resolve` over the same manifest in the same
process; there is an exact answer, and a tolerance would pass while genuinely diverging — two
renderers can be equally fast and disagree about what they draw.

§9's 100 ms is a *published-playback* budget, written for a learner's device across a network. It
stays as SC-003 and is not what this feature can verify.

The negative control is not optional. This project has now been bitten twice by a gate that was
green while enforcing nothing — the theme-values gate, and feature 006's near-miss where a new lint
rule would have silently disarmed the one beside it. A parity gate that has never been observed
failing is not known to be a gate, which is why SC-012 exists as a criterion rather than a habit.

**Alternatives considered.**

- *Compare rendered markup wholesale.* Rejected: it would fail on incidental differences — a wrapper
  class, an attribute order — and would need an allowlist that grows until it excludes the
  divergences it was built to catch. What is compared instead is the kernel's `RenderState`, where
  equality is exact, plus what each element *says*: its text, its geometry, its visual contribution.
  The interactive set may legitimately add controls a learner needs and an author does not.
- *Compare the preview with the player.* Rejected above, and worth keeping as a separate and much
  cheaper claim: that the preview mounts the player unmodified is a **composition** assertion, and
  it is what makes the parity comparison uninteresting between those two.
- *Wait for QA-5.* Rejected: QA-5 *is* this, and the plan's own item list has it depending on ED-6.
  Arming the gate here is what makes QA-5 a task rather than a project.

---

## R-08 — A dead end is reported to the teacher by asking the controller

**Decision.** The preview calls `controller.reachability(slide)` and surfaces the returned
`BlockingProblem`. It implements no detection.

**Rationale.** `checkReachability` has existed since Wave 1 and its own comment states the case:
"without this, a learner staring at a stalled slide and a learner on a deliberately-manual slide
look identical." Wave 3 wired it to the *learner*. The author has never seen it.

`AdvanceController.reachability` is already a public method taking a slide and returning a problem
or null, so this is a call, not a mechanism — the same shape as feature 006's overrun panel reading
`RenderState.problems`, and for the same reason: two implementations of one rule would let the
editor and the validator disagree about whether a lesson is broken.

**The preview has to build the controller it asks.** `LessonPlayerClient` constructs one internally
and never exposes it: `PlayerContextValue` carries `transport` and `slideDurationMs` and nothing
else. So the preview calls `createAdvanceController(ports).reachability(slide)` itself.

That is safe for this query and only for this query. `reachability` is a pure inspection of the
slide and the media port — no state, no memory of what has been decided. `evaluate` is the
opposite: it keys decisions by `instanceId` in a private `Set`, so a second controller calling it
would decide a slide the player's controller had already decided, and the two would disagree about
whether an advance had happened. The second controller therefore exists for one method, and the task
says so.

FR-021 asks for the slide and the reason; the `BlockingProblem` already carries both, with wording
written for a human. PB-1 still owns blocking a *publish*, which is a different job from telling a
teacher where the problem is while they are looking at it.

**Alternatives considered.**

- *Detect it in the editor.* Rejected for the reason above.
- *Report it on the timeline instead.* Rejected: reachability is about a slide's advance rule, not
  its timing, and feature 006's overrun panel is about time. Putting it there would conflate two
  unrelated problems under one heading.

---

## R-09 — A preview emits no analytics, and the reason is the override

**Decision.** The preview passes a **partial** `ports` carrying one member: a discarding
`analytics` adapter. Every other port stays whatever the player builds for itself.

**Rationale.** `LessonPlayerClient` records four event kinds — `lesson_started` on mount (`:326`),
`slide_started` (`:376`), `slide_completed` (`:470`), `lesson_completed` (`:477`). The preview
mounts the player unmodified, which is the whole design, and inherits all four. So without a
decision, a teacher opening a preview to check slide three reports a lesson started; skimming
reports slides completed; reaching the end reports a lesson completed.

**The override is what makes this more than untidy.** US4 exists so a teacher can move past a
required question or a media gate. Every gate skipped that way still emits `slide_completed` — a
completion no learner earned, indistinguishable in the host's data from one that was. The feature
that lets a teacher bypass the lesson's rules would be the feature that fabricates evidence they
were met.

Two facts make this a design decision rather than a bug report. It is **inert today**: `browserPorts`
uses the in-memory adapters, and its comment says why — "the honest default for this wave: nothing
persists yet, and a host that wants persistence supplies its own ports". And the event shape is
**deliberate**: `LessonEvent` carries no field a learner identifier could occupy (FR-033,
NFR-PRV-002), a structural privacy decision made in Wave 1. A stream designed that carefully should
not be the one thing a preview quietly pollutes.

The spec's existing invariants all stopped at the manifest — FR-005, FR-018, SC-005 — which is why
seven analysis passes went by without anyone asking what else leaves a preview. FR-031 states it and
contract §9 was renamed from "what never reaches a manifest" to "what never leaves the preview".

**Alternatives considered.**

- *Tag the events as preview rather than discard them.* Rejected: it puts the decision in the host's
  hands, and every host that forgets the filter gets the polluted data. It also requires a manifest
  change to the event shape, which FR-025 forbids.
- *Let the host pass whatever ports it likes and document the risk.* Rejected: "undefined rather
  than impossible", which the spec has refused once already for editing during a preview (FR-030).
- *Discard storage and assets too.* Unnecessary. `StorageAdapter` has no consumer on this path —
  interaction state is in-memory by design (`core/src/interactions/state.ts:9`) — and `Ports.assets`
  has no consumer at all.

**A partial, and the word is load-bearing.** The player's fallback is
`ports ?? { ...browserPorts(), media: createDomMediaPort({ nodeFor }) }` — all-or-nothing, and its
comment says why: "a caller-supplied `ports` wins outright: a test handing in a scripted media fake
must not have it replaced by one reading a DOM that has no decoder behind it". Right for a test,
and fatal here. A preview replacing the whole object loses `createDomMediaPort`, which it cannot
rebuild — the port closes over the frame writer created inside `LessonPlayerClient` and exposed to
nobody. `media.query()` would return null for every element, so nothing plays, slides gated on
`after_media_ends` never satisfy, and `hasAudibleMedia` still shows the gesture prompt because it
reads the lesson rather than the ports: the teacher presses start and hears silence, on a preview
that otherwise looks correct.

So T005 makes the fallback a per-member merge —
`{ ...browserPorts(), media: createDomMediaPort({ nodeFor }), ...ports }` over `Partial<Ports>` —
which preserves the comment's intent (a full object with a scripted fake still wins) while making
"override one member" expressible. It also closes a trap nobody has reached: any host supplying
ports today to set analytics already loses DOM media, silently. The decision to discard analytics
is what made the trap reachable, so it is recorded here rather than filed elsewhere.

---

## R-10 — Restart is a fresh run, and the mechanism is a remount

**Decision.** Restart keys `<LessonPlayerClient>` on a counter. The remount discards the interaction
state, the advance controller, and the transport together; `onReady` re-seeks to the captured start
point. Previous and next do **not** do this: they are movement within the run in progress.

**Rationale.** FR-012 decided *where* restart goes and left *what state it goes there in* undefined,
which sounds like a detail and is not. Two mechanisms would have carried the finished run forward.

The learner's answers live in `useInteractions`' component state, and the `Interactions` interface
exposes `state`, `completedIds`, and `submit` — **no reset**. `hasIncompleteRequiredInteraction`
reads `signals.completedInteractions`, so an answered question stops gating permanently.

The advance controller keys decisions by `instanceId` in a private `Set`, and `instanceId` is
`` `${slide.id}#${visitCount}` `` where the count is bumped by `goToSlide`. `restart()` calls
`clock.reset(0)` and emits — nothing else — so the count does not move and the slide is never
re-decided.

So a restart implemented as a seek replays a lesson in which every gate is already satisfied. Half
the reason a teacher restarts is "does that question actually stop it?", and the answer they would
get is no, because they answered it a minute ago. FR-020 already settled the principle for the
neighbouring control — turning the override off restores every gate immediately — and FR-032 applies
it here.

**Why a remount rather than a reset.** The controller has `reset(instanceId)`, but the preview does
not own the player's controller: `LessonPlayerClient` builds one internally and `PlayerContextValue`
exposes `transport` and `slideDurationMs` only (R-01, and the reason T042 builds its own for
`reachability`). `useInteractions` has no reset at any level. Adding one to each would be two new
player APIs in service of an editor concern. A remount uses the teardown that already exists — and
R-01's own warning describes it exactly, as the thing an unmemoised `onReady` causes *by accident*:
"a fresh transport, a fresh controller, `writer.clear()`, and `play()` again". The two must not be
allowed to merge in the implementation, but the second is the first done deliberately.

**Why navigation is different.** `goToSlide` bumps the visit count, so previous and next re-decide
the slide while the answers persist. That is not a half-measure, it is correct: a learner who moves
back to a question they answered is not asked again. Restart means a fresh run; previous and next
mean movement within one.

**Alternatives considered.**

- *Add `reset()` to `Interactions` and call the controller's.* Rejected above — two player APIs for
  an editor's benefit, and the preview would have to reach a controller it deliberately does not
  hold.
- *Leave restart as a seek and document that state persists.* Rejected: it is the "undefined rather
  than impossible" shape this spec has refused twice already (FR-030, FR-031), and here it would
  quietly give a teacher the wrong answer to the question they asked.
- *Close and reopen the preview instead of offering restart.* Rejected: FR-013 lists restart, and
  reopening would also re-capture the start point, which FR-012 says must not move.
