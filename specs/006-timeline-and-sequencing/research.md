# Phase 0 Research: Timeline and Simple Sequence Mode

**Date**: 2026-08-16 · **Feature**: `006-timeline-and-sequencing`

Ten decisions. R-01 and R-02 answer the risk the specification named; R-04 is the one core change;
R-09 is a measurement gap this feature inherits and must not pass on.

---

## R-01 — The editor drives the existing transport, and a rule keeps it that way

**Decision.** Playback uses `createTransport` from `@cuestack/core`, constructed over the draft with
`browserPorts()` — which `@cuestack/react` must first export. The studio package implements no
timing. A new **ESLint** rule, `no-clock-in-studio`, forbids `performance.now`, `Date.now`,
`setInterval`, `setTimeout`, and `requestAnimationFrame` anywhere in `packages/studio/src`, with no
exemption at all.

**Rationale.** The specification called two clocks the failure mode to design against, and intention
is not a mechanism. The transport already does everything FR-010 asks for — `play`, `pause`, `seek`,
`restart`, a monotonic clock over an injected `TimeSource`, and `visibilitychange` handling that
satisfies BR-013 without the editor knowing BR-013 exists.

What reusing it also buys is the *testing* strategy. Constitution II forbids a timing test that
depends on wall-clock sleeps or real `requestAnimationFrame`. Because the transport takes a
`TimeSource`, editor playback is driven the way every kernel timing test since Wave 1 has been
driven: advance a fake clock, assert. Nothing waits.

There is one wrinkle worth recording. `createTransport(lesson, ports)` manages `slideIndex` and
`goToSlide` across a whole lesson, and the editor works on one slide. The editor constructs it over
the draft and never calls `goToSlide` — playing across slides is explicitly out of scope, and that
is the player's behaviour. The transport is therefore used as a *slide* clock, which it already is
internally: `slideTimeMs` resets per slide.

**The rule has no exemption, and one export has to move for that to be true.** Both clock
primitives the editor needs already live in `@cuestack/react`: `requestAnimationFrame` inside
`useFrameLoop`, which is exported, and `performance.now` inside `browserPorts`, which is **not** —
it sits at `player/browserPorts.ts` and never reaches `index.ts`. So the editor as things stand
cannot construct a transport without writing `time: () => performance.now()` itself, which is a
clock in the studio package and the exact thing this decision exists to prevent. Exporting
`browserPorts` is therefore not a convenience; it is what lets the rule be absolute instead of
carrying an exemption for `usePlayback.ts` — an exemption that would punch a hole at precisely the
module most likely to grow a clock.

**How the rule must be written, because the obvious way is wrong twice over.** Feature 005 wrote
its DOM-measurement rule as a dependency-cruiser rule first and had to move it: that tool reasons
about the *module graph*, and a restriction on identifiers is not a restriction on imports. Same
class here. And within ESLint, the studio package already carries a `no-restricted-properties`
block for DOM measurement — flat config *replaces* a rule's configuration rather than merging it,
which is precisely how feature 005's workspace-wide innerHTML ban silently disarmed two narrower
rules. So the clock rule uses different rule names (`no-restricted-globals` for the timer
functions, `no-restricted-syntax` for `Date.now` and `performance.now`) and spreads `NO_INNER_HTML`
back in, rather than adding to the existing `no-restricted-properties` block and taking its
`ignores` for `canvas/pointer.ts` along with it. The gate self-test gets a negative control for
each half: that a clock read is rejected, and that adding the rule did not disarm the measurement
ban.

**Alternatives considered.**

- *A small editor-local clock.* Rejected: it is the second clock by definition, and it would have to
  re-implement the visibility rule, which is a business rule (BR-013) rather than a convenience.
- *Drive the playhead from `requestAnimationFrame` and compute elapsed time directly.* Same
  objection: that is a clock, wearing a loop's clothing, and it would drift from the player's.

---

## R-02 — Playback bypasses React state, and exactly one module holds the divergence

**Decision.** While playing, the playhead and the canvas are updated by `useFrameLoop` writing
through `FrameWriter`. `session.authoringTime` is **not** updated per frame. It is reconciled to the
transport's time on every pause, seek, and stop.

**With three qualifications, and each is load-bearing.**

*React still owns structure.* The writer changes the *appearance* of a mounted node. An element
entering at 5 000 ms has no node to change — it has to mount, which is an ordinary render. So
`usePlayback` keeps a `visibleIds` string in state, set from `onFrame`, which re-renders when the
*set* of visible elements changes and at no other time. `LessonPlayerClient` does exactly this:
"React only re-renders when the visible set changes — not per frame".

*And the re-render must read the frame's state, not the session's time.* This is the half that is
easy to miss, because naming the trigger feels like naming the fix. The player's render line is
`const state = visibleIds === '' ? initial : latest.current` — `visibleIds` is only the trigger;
the value comes from a **ref** holding what `onFrame` last resolved. `EditorCanvas` computes
`resolve(slide, session.authoringTime)` at render time, so a re-render with a stale time recomputes
the same frozen state and mounts the same wrong element set. The writer can only style what React
mounted. **Both halves, or neither works.**

*The loop runs only while playing.* `useFrameLoop` has no state guard — it ticks from mount, for as
long as it holds a transport. That is right for a player, whose whole job is playing. An editor
spends most of its life not playing, and a loop resolving and writing every frame while a teacher
drags an element competes directly with SC-004's 100 ms budget at 300 elements. So the editor passes
`transport` only while `state === 'playing'`, and `null` otherwise.

**The consequence of the third qualification is a rule, and it is worth stating on its own: while
the writer exists, it owns the continuous properties.** `--cs-opacity`, `--cs-tx`, and the rest come
from whatever moment the writer was last given, while structure and geometry come from
`session.authoringTime`. Those are two moments, and they agree only if nothing moves one without the
other. So there is **one write path for time** — every change goes through `seek` — and `seek`
writes once, just as a frame does. `setAuthoringTime` is a public method on the session and feature
005's tests call it directly, so this cannot be left to convention.

One case is not a seek and is worth separating out: **changing slide**. The transport is per-slide,
so a slide change rebuilds it — clear the writer, construct the new one, seek it to that slide's
*restored* authoring time, write once. The session has kept time per slide since feature 005, so
returning to a slide the teacher scrubbed to 3 000 ms restores 3 000 ms; a transport starting at
zero would put the canvas and the clock in different places before anything had even played.

The one-write-per-seek half is not tidiness; it is what makes guarding the loop safe. Most
continuous values would survive an unguarded gap on their own, because reconciling on stop
re-renders the same moment the writer last wrote and React then takes ownership of exactly those
keys. **`will-change` cannot.** It is set imperatively and rendered by nobody — `elementProperties`
is geometry, visual, and reduced, and none of them emits it, deliberately, because it is derived
from whether an effect is active and would go stale on React's schedule. So with the loop unmounted
and no write on seek, a teacher who pauses mid-effect and scrubs away leaves the hint on every
element that was animating: a compositor promotion per element, permanently. Writing once per seek
clears it through the writer's own `activeEffects.length === 0` branch, at the cost of a write
rather than a frame.

**Rationale.** The transport emits when commanded and not on a timer — Wave 3's hard-won finding,
recorded in `useFrameLoop`'s own header: elements never appeared during playback because React had
no reason to re-render, and every test drove `seek()`, which does emit. So a loop is required, and
the loop already exists.

Routing it through React state instead would re-render the canvas, every track, and the inspector
sixty times a second. Feature 005 established that a reconciliation pass per element per frame is
out of reach at scale, which is why `FrameWriter` exists at all; a timeline adds more subscribers to
the same value, not fewer.

The cost is a genuine divergence: during playback the session's idea of the time is behind the
clock's. That is acceptable only because it is *bounded and named* — one module owns it, it
reconciles on every stop, and a test asserts the two agree once playback ends. An unbounded version
of this would be a second source of truth for the authoring time, which is the thing FR-006 exists
to prevent.

**What this decision nearly cost, recorded because it was nearly paid twice.** `EditorCanvas`
computes `resolve(slide, session.authoringTime)` at render time. Left as "playback bypasses React
state" without the structural qualification above, a stale authoring time would have frozen that
call for the whole of playback — the playhead advancing over a canvas showing the time-zero element
set. That is Wave 2's defect exactly, in a second package. It is worth naming how it hid: every
playback test written against the design drove `seek()`, which emits a snapshot and re-renders, so
the tests would all have passed. `useFrameLoop`'s header records the same sentence about the player.
The editor's playback suite therefore carries one test that plays through an element's `startMs`
with **no seek at all**, and the writer must be threaded into `EditorCanvas` for it to pass.

**Two parity lessons this decision inherits, both already recorded in the adapter.** `ElementFrame`
keeps the continuous values out of its render path because "anything timing-derived written here
goes stale between renders — the rendered-parity sweep caught precisely that with `will-change`".
And `FrameWriter` records what the divergence looked like: "seeking to 500 ms produced different
markup from stepping to 500 ms". Both are the same failure this feature can now reproduce inside
the editor, between a canvas rendering at one moment and a writer writing at another. They are why
the parity suite gains an assertion here rather than being taken as satisfied by construction.

**Alternatives considered.**

- *Throttle state updates to, say, 10 Hz.* Rejected: it makes the divergence smaller without making
  it bounded, and it produces a playhead that visibly stutters against a canvas that does not.
- *Make the canvas subscribe to the transport directly and skip the session.* Rejected: it gives the
  canvas a second way to learn the time, which is exactly the two-controls problem FR-006 closed.

---

## R-03 — Tracks are built from the draft, not from `RenderState`

**Decision.** The timeline enumerates `slide.elements` and draws a track per element from its
authored `startMs` and `endMs`. `RenderState` is used for the canvas, as it already is, and for
overrun problems (R-08) — never as the source of tracks.

**Rationale.** `RenderState.elements` is documented as "visible elements only". A hidden element is
absent by design (BR-010), and so is one outside its window. A timeline built from it would drop a
track precisely when the teacher wants to change the timing that made it disappear, and hiding an
element would silently remove its ability to be re-timed.

This is feature 005's ghosts decision arriving in a second place, and the symmetry is the point: the
resolver answers *what is on screen at this moment*, and an editor also needs *what exists*. Both
questions are legitimate; conflating them is what breaks.

FR-003 states the requirement directly, and it is worth noting it costs nothing — the draft is
already in the session.

**Alternatives considered.**

- *Resolve at time zero to enumerate.* Rejected: it is the same bug with a different time. An
  element starting at 5 000 ms is absent from `resolve(slide, 0)`.
- *Add an `includeAll` option to `resolve`.* Rejected in feature 005 and rejected again: a parameter
  that changes which elements come back creates a state the editor can produce and the player
  cannot, in the one function that exists to prevent exactly that.

---

## R-04 — `EffectDescriptor` declares its parameters, reusing `InspectorField`

**Decision.** `EffectDescriptor` gains `parameters?: readonly InspectorField[]` in
`@cuestack/core`, and each built-in effect declares what it reads. The editor renders effect
parameters through the same field components it already renders element properties with.

**Rationale.** FR-025 requires the offered parameters to come from the registry. Today they do not
exist anywhere as data: `pulse` reads `amount` with a default of `0.08` inlined in its `at()`,
`slide` and `zoom` read `from` defaulting to `'bottom'`, and `dim` and `highlight` read `amount`
through a shared helper. An editor cannot offer what nothing declares, so the choice is to extend
the descriptor or to keep a parallel list — and a parallel list is a per-effect branch that rots the
first time a ninth effect registers, which Constitution I calls a defect.

Reusing `InspectorField` rather than inventing a parameter shape is the part worth arguing for. It
already carries a key, a label, a kind, `select` options, and — since feature 005 — a `list` kind.
Effect parameters are the same problem the inspector already solved, and sharing the type means the
editor gets one set of field components for both.

**What reading the eight implementations found.** `slide` takes `from` as a *direction string*
(`'bottom'`) and `distance` as logical units; `zoom` takes `from` as a *number* — the scale it
starts at, defaulting to `0.92`. One key, two types, two meanings, in two effects a teacher picks
between in the same menu. And `amount` carries three different defaults — `0.08` for `pulse`,
`0.4` for `highlight`, `0.5` for `dim`. An editor that inferred a shared parameter vocabulary from
the names would have offered `zoom` a direction dropdown. Declaring per descriptor is not merely
tidier than a central table; a central table would have been wrong.

**Blast radius.** `EffectDescriptor` is registry metadata. It is not serialized into any manifest,
not carried in `RenderState`, and not read on the playback path — `at()` still receives the same
untyped `EffectParams` bag it always has. Additive, so no `schemaVersion` implication.

This is the second feature running to find a declared contract member with no producer or consumer.
Feature 005 found `ElementPlugin.inspector` had never been called; this one finds `EffectDescriptor`
never described itself. Both were discovered by building a consumer, which is the argument for
building consumers.

**Alternatives considered.**

- *Infer parameters from each effect's source.* Not possible, and would be wrong if it were: a
  default inlined in a conditional is not a declaration.
- *Let a plugin supply a React component for its parameters.* Rejected: it puts React in
  `@cuestack/core`'s contract surface, which Constitution I forbids outright.

---

## R-05 — Simple Sequence is a pure function, and stores nothing

**Decision.** `relationships.ts` exposes two pure functions: one classifying a slide's events into
With Previous / After Previous / After Previous with a delay / Custom, and one resolving a list of
relationships back into absolute times. Neither touches React. Both live in the node test project.

**Rationale.** Constitution III forbids mode-specific storage in as many words, so the mode is a
*view* and the classification is derived. That removes the largest question ED-4 could have had —
a stored sequence would have meant a `schemaVersion` bump and a migration.

Constitution II then makes the shape mandatory rather than merely nice: it names "Simple Sequence to
absolute-time conversion" among the four things that MUST be developed test-first. A pure function
over a slide is the only shape that lets that be honoured without a browser.

The classification rule has to be *stated*, because FR-032 requires Custom to be meaningful. An
event is With Previous when it starts at the same millisecond as the previous event; After Previous
when it starts at the previous event's end; After Previous with a delay when it starts at a fixed
offset after that end; and Custom otherwise. Exact equality, deliberately: a tolerance would make
two teachers' identical-looking slides classify differently, and the format stores integer
milliseconds so exactness is achievable.

**Reordering re-classifies rather than re-resolving, and the distinction is the whole safety of the
mode.** Relationships are derived, so a reorder changes what `classify` returns — and nothing else.
Times move when `apply-sequence` runs, because the teacher asked. The alternative reading, which an
earlier draft of the specification carried, was that reordering rewrites `startMs` "accordingly":
a destructive edit produced by a stacking change, with no undo behind it until ED-5.

It is also narrower than it sounds. Events sort by `startMs` first and by paint order only as a
tie-break (R-06), and `reorder` swaps adjacent `zIndex` — so three elements starting at different
moments reorder without changing "previous" at all. Stating the narrow scope is what stops the
destructive reading from sounding reasonable, which is how it survived five reviews.

**Alternatives considered.**

- *Store a `sequence` field on the element.* Forbidden by the constitution, and it would put the
  editor's mode into a learner's manifest.
- *Classify with a tolerance window.* Rejected above. Where a teacher wants "about a second", the
  delay variant already expresses it exactly.

---

## R-06 — An event is an element appearing or an effect running

**Decision.** `events.ts` derives an ordered list from a slide: one event per element (its
appearance, at `startMs`) and one per effect (its run, at the effect's `startMs`). Ordering is by
start time, then by the element's paint order, then by the effect's explicit `order` — the same
tie-breaking the resolver already uses.

**Rationale.** The clarification settled that sequences order events rather than elements, because
UC-02 is *Create a Chronological Effect Sequence* and revealing a list one line at a time is the
canonical case. That makes the event list the central abstraction of ED-4, and deriving it needs a
stated order or "previous" is undefined.

`Effect.startMs` is documented in the format as relative to *slide* time, not element time. That is
what makes a single ordered list possible at all — no conversion, and an effect's position is
directly comparable with an element's.

`Effect.order` exists precisely for the equal-start-time case (FR-TIM-014) and the resolver already
honours it. Reusing it here rather than inventing a tie-break keeps one answer to "which comes
first".

**Alternatives considered.**

- *Events for elements only.* Rejected in clarification: it sends teachers to the timeline for the
  case the mode exists to serve.
- *Include element *ends* as events.* Rejected: "after previous" would then be ambiguous between an
  appearance and a disappearance, and no requirement asks for it.

---

## R-07 — Timing drags reuse the geometry engine's shape, not its code

**Decision.** `timing.ts` implements moving and resizing a *time range* — one dimension, in
milliseconds — with its own snap. It does not reuse `geometry/transform.ts`, and it deliberately
mirrors its structure: pure, integer-clamped, tested with no DOM.

**Rationale.** The temptation is to treat a track bar as a rectangle and reuse `moveBy`/`resizeBy`.
It is the wrong economy. Time is one-dimensional, its unit is integer milliseconds where geometry is
a finite float, its floor is zero where geometry's is a minimum extent, and its snap candidates are
other events' starts and ends rather than edges and centres. Sharing the code would mean a geometry
module that knows about milliseconds, which is how a general helper stops being either.

What *is* shared is the pattern, and that matters more: pure functions taking logical units,
returning new values, clamped so the reducer can never be handed something the schema rejects, in
the node project where there is no DOM. A reviewer who has read `geometry/` can read `timing.ts`.

The pointer-to-logical conversion is the same problem the canvas solved, and the same answer:
`scale.ts` converts a horizontal pixel delta into milliseconds, measured once per gesture, and
`canvas/pointer.ts`'s existing rule that measurement is confined applies here too.

**Alternatives considered.**

- *Generalise `transform.ts` over an axis.* Rejected above.
- *Drag in pixels and convert on commit.* Rejected: preview and commit would be different
  quantities, which is the jump-on-release bug feature 005's R-10 already refused.

---

## R-08 — Overruns are consumed, not detected

**Decision.** US5 reads `RenderState.problems` for `EFFECT_BEYOND_SLIDE` and `ELEMENT_BEYOND_SLIDE`
and presents them on the timeline. The editor implements no overrun detection.

**Rationale.** The kernel has emitted both codes since Wave 1 and **nothing has ever read them** —
`collectProblems` runs on every resolve and its output has been carried, unexamined, through three
features. FR-TIM-016 asks for exactly what it already produces.

This is the third instance of the same pattern in two features: `ElementPlugin.inspector` had no
consumer, `EffectDescriptor` had no parameter declaration, and now a problem stream nobody reads.
Worth stating as a finding rather than a coincidence — the kernel has been built ahead of its
consumers, which is why consuming it keeps revealing things.

The extend-slide action (FR-TIM-017) is then arithmetic over the same data: the new duration is the
maximum end across elements and effects.

**Alternatives considered.**

- *Detect overruns in the editor.* Rejected: two implementations of one rule, and the kernel's is
  the one the player already uses.
- *Wait for PB-1.* Rejected: PB-1 blocks a publish, which is a different job from showing a teacher
  where the problem is while they are looking at it. Both are wanted; the spec keeps them separate.

---

## R-09 — The perf fixture gains a dense slide, because the timeline is per-slide

**Decision.** `heavy-lesson.mjs` gains a single dense slide — one slide carrying a large share of
the elements — and SC-012 is measured against that slide rather than against the lesson.

**Rationale.** Measured, not assumed: the Constitution's fixture is 50 slides, 300 elements, **six
per slide**, and 290 effects. The timeline is per-slide (FR-TIM-001), so as things stand it would be
benchmarked against six tracks. A criterion that passes because the fixture is easy is the
theme-gate mistake in a new place — green while measuring nothing.

The fixture is generated rather than committed, so adding a shape costs a function. Keeping one
fixture with a dense slide inside it is better than a second fixture: the Constitution names *the*
performance fixture, and a second one is the copy that drifts.

Whether the track list needs virtualising then becomes a measurement instead of a guess. At six
tracks it plainly does not; at a hundred it might, and the budget will say.

**Alternatives considered.**

- *Restate SC-012 as "six tracks".* Rejected: it makes the criterion true by lowering it, and a
  teacher can legitimately put fifty elements on one slide.
- *Virtualise pre-emptively.* Rejected: complexity bought against a number nobody has measured.

---

## R-10 — The authoring-time scrub is deleted, not deprecated

**Decision.** `canvas/AuthoringTime.tsx` is removed and the playhead takes over. The session keeps
one `authoringTime`; the timeline is the only control that writes it.

**Rationale.** Feature 005 shipped the scrub with an obligation recorded in its own specification:
two controls writing one value is acceptable for one feature and a parity hazard if it outlives
ED-3. FR-006 discharges it, and discharging means deleting.

Leaving both would give a teacher two widgets that disagree the moment one is dragged during
playback — the exact class of bug the obligation predicted. It would also leave two things to keep
in step with ED-6's preview.

The session's shape does not change: `authoringTime` is still per-slide state with the same
clamping. Only the control that writes it moves, which is why this is a deletion rather than a
migration.

**Alternatives considered.**

- *Keep the scrub as a compact alternative when the timeline is collapsed.* Rejected: a collapsed
  timeline can show a ruler, which is the same affordance without a second implementation.
