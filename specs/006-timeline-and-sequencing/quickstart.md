# Quickstart: Validating the Timeline and Simple Sequence Mode

**Date**: 2026-08-16 · **Feature**: `006-timeline-and-sequencing`

How to prove this feature works.

**Every command below has now been run exactly as written (T105).** Twenty commands and five
negative controls; the counts each section reports are real.

What the pass found: **one ordering hazard, and it is not in this feature.** `pnpm test` runs the
`gates` project, whose "permits it inside a registry" control rewrites
`packages/core/src/elements/registry.ts` and restores it — which leaves the file's mtime newer than
`packages/core/dist`, and the React suite's core-freshness check then reports a stale kernel. Which
way a run goes depends on which project finishes first, so `pnpm test` can be green and then red
with no change in between. The workaround below is the fix; the underlying flake belongs to the
gate self-test and is recorded here so the next person does not spend an hour on it.

Feature 004's equivalent pass found three commands matching no test files at all; feature 005's
found a lint failure no individual suite could surface. Neither class occurred here — every filter
below matches real suites, because the commands were written against a layout that already existed
in tasks.md and then checked against it.

## Prerequisites

Node 22.12+, pnpm 11, `pnpm install && pnpm build`. No new workspace packages and no new
toolchain dependencies. Two changes outside the studio package: `EffectDescriptor.parameters` in
`@cuestack/core`, and `browserPorts`/`Ports` newly exported from `@cuestack/react` — without the
second the editor cannot construct a transport without writing a clock of its own, which §4's rule
forbids.

**Every DOM suite below mounts through `packages/studio/test/harness/editor.tsx`**, extended by
T020 to render the timeline and `usePlayback` *inside* the tree. If a suite reports a stale
selection or a playhead that "did nothing", check the harness before the code — feature 005's
equivalent symptom came from rendering the hook outside the tree and passing one snapshot as a prop.

**Rebuild the kernel before a full run, and again after one.** `pnpm gates` and the `gates` test
project both write temporary fixtures into `packages/core/src`, which leaves the freshness check
seeing a stale `dist`:

```bash
pnpm exec turbo run build --filter @cuestack/core --force
```

---

## 1 — The sequence model, with no browser at all

```bash
pnpm exec vitest run --project @cuestack/studio-pure sequence
```

**Expected**: `eventsOf`, `classify`, and `resolveSequence` all pass in the `node` environment.
**Ran**: 57 passed.

This is the first thing to check, and it is a design assertion rather than a coverage one.
Constitution II names "Simple Sequence to absolute-time conversion" among the things that MUST be
developed test-first, and Constitution III forbids the mode storing anything. If these tests need a
DOM, the mode has grown a component when it should have grown a function.

Three assertions worth naming:

- **The round trip.** `classify(resolveSequence(events, relationships))` returns the relationships
  it was given. That single property is the mode's correctness.
- **Exactness.** An event starting 1 ms after its predecessor's end is `after-previous-delay` with
  `delayMs: 1`, not `after-previous`. No tolerance (R-05).
- **Overlap is Custom.** An event beginning while its predecessor is still running classifies as
  `custom`, not as With Previous (FR-031).
- **Adjacency is the only input.** All four shapes — element→element, effect→effect, element→effect,
  effect→element — classify and resolve identically (FR-036). An implementation that special-cases
  "same element?" passes everything else in this section and fails only this.
- **Reordering re-classifies, it does not re-resolve.** After a reorder the view may show different
  relationships and every stored `startMs` is byte-identical. And it is narrower than it sounds:
  three elements at 0, 1000, and 2000 reorder without changing "previous" at all, because events
  sort by start time first and by stacking order only as a tie-break (FR-034).

## 2 — Timing arithmetic, also with no browser

```bash
pnpm exec vitest run --project @cuestack/studio-pure timing
pnpm exec vitest run --project @cuestack/studio-pure scale
```

**Expected**: move, resize-start, resize-end, snap, and the scale round trip.
**Ran**: 26 and 16 passed.

| Assertion | Source |
|---|---|
| A move dragged before zero stops at zero and keeps its duration | edge case, FR-014 |
| `endMs - startMs` never falls below `MIN_ELEMENT_DURATION_MS` | FR-014 |
| Every returned value is a non-negative **integer** | BR-001, BR-002 |
| A target 70 ms away snaps; one 90 ms away does not (`SNAP_THRESHOLD_MS` is 80) | FR-015 |
| `toMs(toPx(ms)) === ms` for every millisecond in a slide | FR-007 |

**Negative control**: set `SNAP_THRESHOLD_MS` to 0. The snap assertions must go red and nothing
else may. A threshold that cannot be turned off is a threshold no test is exercising.
**Ran**: 3 failed, 23 passed — exactly the three snap assertions, and nothing else moved.

## 3 — Tracks come from the draft, not from `RenderState`

```bash
pnpm exec vitest run --project @cuestack/studio-pure tracks
```

**Expected**: an element with `hidden: true` has a track; an element whose window excludes the
current moment has a track; a slide with zero elements yields zero tracks and does not throw; a
slide of zero **duration** still yields a track per element.

That last one is legal and easy to miss: `Slide.durationMs` is `msInt`, integer ≥ 0 — not the
positive `msDuration` an earlier draft of the data model assumed — and a slide that advances
`on_click` has no reason to carry a duration.

This is feature 005's ghosts lesson in a second place. `RenderState.elements` is visible elements
only (BR-010), so a timeline built from it would drop a track exactly when the teacher wants to
change the timing that made it disappear (FR-003, R-03).

## 4 — There is one clock, and a rule says so

```bash
pnpm exec eslint packages/studio
```

**Expected**: `no-clock-in-studio` passes — no module under `packages/studio/src` reads
`performance.now`, `Date.now`, `setInterval`, `setTimeout`, or `requestAnimationFrame`. **No
exemption, including for `usePlayback.ts`**: it imports `useFrameLoop` and `browserPorts` from
`@cuestack/react` rather than reimplementing either, which is what lets the rule be absolute.

**Two negative controls, and the second is the one that matters.** Add `const t = Date.now()` to
any studio module — the command must go red. Then check that adding this rule did not disarm
`dom-measurement-confined`: a `getBoundingClientRect` outside `canvas/pointer.ts` must still be
rejected. Feature 005's workspace-wide innerHTML ban silently disarmed two narrower rules and only
a self-test found it; a rule that cannot fail is the theme-gate mistake in a new place — green
while measuring nothing.
**Ran**: both fire. `Date.now()` produces two `no-clock-in-studio` reports, and a
`getBoundingClientRect` outside `pointer.ts` still produces `dom-measurement-confined`.

## 5 — Playback runs the player's transport

```bash
pnpm exec vitest run --project @cuestack/studio playback
```

**Expected**: play advances the playhead, pause holds it, restart returns to zero, seek during
playback continues from the new moment, and hiding the document pauses (BR-013).
**Ran**: 15 passed.

**Driven by an injected `TimeSource`, never by waiting.** Constitution II forbids wall-clock sleeps
and real `requestAnimationFrame` in tests, and the transport takes its clock as a port precisely so
this is possible. A test in here containing `await sleep(...)` is a test to delete.

**The assertion to check first is the one with no seek in it.** Play from before an element's
`startMs` to past it, issuing no command, and confirm the element appears. Every other test in this
suite drives a seek — which emits a snapshot and re-renders — so all of them would pass over a
canvas that never updates during real playback. That is precisely how the same defect shipped in
Wave 2, and `useFrameLoop`'s header records it. If this one assertion is green, three things are
working at once: the writer reached real nodes, the visible-set trigger fired, and the render read
the *frame's* state rather than re-deriving it from a stale authoring time.

**Then check the seam in the other direction.** With nothing playing, advancing the clock must
produce **zero** writes — an editor resolving and writing every frame while a teacher drags is
spending SC-004's budget on nothing. A seek while idle must produce **exactly one**, because the
writer owns the continuous properties whenever it exists. And calling `session.setAuthoringTime`
directly during playback must visibly split the canvas: continuous properties from the writer's
moment, structure from the session's. That split is the reason no surface calls it, and seeing it
once is worth more than reading the rule.

**One thing to look at by eye, because no assertion here will catch it.** Pause mid-effect, then
scrub away, then inspect an element that was animating: `will-change` must be gone. It is set
imperatively by the writer and rendered by nobody, so it is the one continuous property that cannot
correct itself — and a stranded compositor promotion per element is invisible until it is measured.

One assertion is the whole of R-02: after playback stops, `session.authoringTime` equals
`transport.slideTimeMs`. While playing it is permitted to lag — that divergence is declared, bounded
to one module, and reconciled on every pause, seek, and stop.

## 6 — All eight effects are reachable

```bash
pnpm exec vitest run --project @cuestack/studio effects
pnpm exec vitest run --project @cuestack/core effects
```

**Expected**: every type in the registry can be added to an element from the editor, and each one
visibly changes what the canvas renders at a moment inside its window (SC-006). Eight effects,
eight assertions — the shape of the `ELEMENT_TYPES` sweep feature 005 used to catch defaults that
had been guessed rather than read.

The core command covers the descriptor change: each built-in declares its parameters, and
`zoom.from` is a **number** while `slide.from` is a **direction string**. That collision is why the
declaration lives per descriptor (R-04).

**Negative control**: register a synthetic ninth effect in a test registry. It must appear in the
menu with its declared phases and parameter fields, with no editor change. If it does not, a
per-effect branch has crept in — the switch statement Constitution I calls a defect.

## 7 — Nothing here can write an invalid lesson

```bash
pnpm exec vitest run --project @cuestack/studio-pure draft
```

**Expected**: the six new edit kinds each have a success case and a refusal case; read-only refuses
all six; a locked element refuses a re-time, an effect add, and a sequence application; an effect
duration of zero is refused **with a reason** rather than a schema path (FR-023, BR-004).

`EDIT_KINDS` is a closed union and the read-only suite enumerates it, so the six additions are
refused-by-default and fail a test until someone says so deliberately. That is feature 005's
SC-017 doing its job on this feature's additions.

## 8 — Overruns, consumed rather than detected

```bash
pnpm exec vitest run --project @cuestack/studio overrun
```

**Expected**: an element ending past the slide's duration is identified and attributed; the offered
action extends the slide to contain the latest element or effect **exactly**; reducing a slide's
duration leaves authored values intact and reports the overrun (BR-017); with no overrun the
timeline says nothing about durations.

The editor detects nothing here. `ELEMENT_BEYOND_SLIDE` and `EFFECT_BEYOND_SLIDE` have been emitted
by the kernel since Wave 1 and nothing has ever read them (R-08).

## 9 — Simple Sequence stores nothing

```bash
pnpm exec vitest run --project @cuestack/studio BR-016
```

**Expected**: apply a sequence, serialize, read back, and the only differences are `startMs`,
`endMs`, and `durationMs`. Anything else means the mode grew storage, which Constitution III
forbids outright (FR-029, SC-008).

BR-016 and BR-017 each need at least one test named for the rule ID (SC-013), and `pnpm check:rules`
verifies the naming — its `EXPECTED` map currently lists both as "Wave 4", so this feature is what
moves them into scope.

**The filename is constrained.** `check-rule-coverage.mjs` matches `^BR-\d+\.test\.tsx?$` exactly,
so these cannot be `*.pure.test.ts` — they run in the DOM project regardless of how little DOM they
need. Naming one `BR-016.pure.test.ts` would leave the gate reporting an uncovered rule while the
test passes, which is the confidently-wrong answer that gate exists to prevent.

## 10 — One authoring time

```bash
pnpm exec vitest run --project @cuestack/studio session
```

**Expected**: `canvas/AuthoringTime.tsx` no longer exists, and nothing imports it. The timeline
replaces the scrub rather than sitting beside it (FR-006) — the obligation feature 005 recorded in
its own specification, discharged by deletion rather than by deprecation.

## 11 — Keyboard, from end to end

```bash
pnpm exec vitest run --project @cuestack/studio keyboard
```

**Expected**: every action in User Stories 1–5 is performable with no pointer events (SC-009) —
move the playhead, move between tracks, read the current time, move and resize a bar by `NUDGE_MS`
and `NUDGE_MS_COARSE`, play, pause, restart, add and configure and remove an effect, set every
relationship, confirm a Custom-to-simple change, and take the extend-slide action.

Feature 004's manual sweep found a progress bar announcing a position with no subject. FR-008 is
that defect anticipated: the current time is conveyed **with a subject**, not as a bare number.

## 12 — Accessibility

```bash
pnpm exec vitest run --project @cuestack/studio a11y
```

**Expected**: axe reports zero violations on the timeline, the sequence view, and the effect
controls, with a selection active and with the FR-032 confirmation open (SC-010).

Automated checking is a floor. The manual pass in §15 is where the rest lives.

## 13 — Performance, against a fixture that can actually stress it

```bash
pnpm exec vitest run --project @cuestack/studio perf
node tools/scripts/gates/perf.mjs
```

| Budget | Source |
|---|---|
| Playhead move to rendered state ≤ 100 ms | NFR-PERF-003, SC-003 |
| Drag feedback ≤ 100 ms | NFR-PERF-002, SC-004 |
| The timeline stays responsive, tracks scrollable | SC-012 |

**Re-baseline record (T005).** The dense slide T004 adds changes the per-slide distribution that
`packages/react/test/perf/playback.test.ts` and `packages/studio/test/perf/editor.test.tsx` were
baselined against. Their numbers before and after the change are recorded here, so a budget that
moved for a reason unrelated to this feature is not read later as a regression:

**Run on 2026-08-17. No budget moved.** Both suites pass before and after; wall-clock is within
run-to-run noise.

| Suite | Before (6/slide) | After (dense 55) | Verdict |
|---|---|---|---|
| `react` — does less than one frame of work per frame | 28 ms | 27 ms | unchanged |
| `react` — seeks to a rendered state within the budget | 28 ms | 31 ms | noise |
| `studio` — becomes interactive (SC-002) | 18 ms | 17 ms | unchanged |
| `studio` — selection feedback (SC-001) | 12 ms | 11 ms | unchanged |
| `studio` — renders a moved element (SC-001) | 14 ms | 14 ms | unchanged |
| `studio` — authoring-time change (SC-018) | 9 ms | 8 ms | unchanged |
| `studio` — scales linearly across the slide set | 19 ms | 18 ms | unchanged |

**Why nothing moved is the interesting part.** Both suites work against the early slides, which went
from six elements to five; the dense slide is the *last* one, and nothing existing seeks to it. So
the redistribution is invisible to every budget that already existed — which is precisely R-09's
point restated as a measurement: the fixture as it stood could not have stressed a per-slide
timeline, and no existing number was ever going to notice.

**Read this before trusting a green line.** The Constitution's fixture is 50 slides and 300
elements at **six elements per slide** — measured, not assumed. The timeline is per-slide, so as
things stood SC-012 would have been benchmarked against six tracks, which is not a load. The
fixture gains a dense single slide and SC-012 is measured against *that* (R-09).

**Negative control**: insert a 200 ms synchronous delay into the playhead seek path. The gate must
go red. **Ran**: 1 failed, 5 passed — the seek budget, and only it.

As with Wave 3's playback budgets, the gate must say out loud that it measures the editor's own
work and not paint. happy-dom has no compositor; a green line here is not a frame-rate claim.

## 14 — The whole suite, and the gates

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm gates && pnpm check:rules && pnpm check:studio-isolation
```

**Expected**: all green. `check:studio-isolation` proves the player still renders with the studio
package absent from disk — the timeline, the sequence view, and the effect controls must not have
reached a learner's bundle.

`pnpm lint` catches what no individual suite can: feature 005's pass went red here on an unused
variable in a perf test, because vitest does not lint.

## 15 — The manual pass

Automated checks cannot do these, and they are the ones that find the defects the others miss.

```bash
pnpm --filter @cuestack/example-nextjs dev
```

Open the editor route and, with a keyboard and a screen reader only:

1. Move the playhead and confirm the announced time has a **subject** — "authoring time, 2.4
   seconds" rather than "2.4".
2. Press play. Confirm the playhead advances, the canvas keeps step, and the announcement does not
   fire on every frame.
3. Drag the playhead while playing. Confirm playback continues from where it was left rather than
   snapping back — the drag commands the clock rather than fighting it.
4. Switch to another browser tab and return. Playback must have paused and resumed (BR-013).
5. Add a `slide` effect and a `zoom` effect to the same element. Confirm the `from` control is a
   **direction** for one and a **number** for the other, and that neither is mislabelled.
6. Turn on the operating system's reduce-motion setting and play the slide. The slide-in must
   become a fade, not a blink.
7. Author a three-line reveal **entirely in the sequence view**, without opening the timeline. This
   is UC-02 and SC-016, and it is the case that decides whether the mode serves the teacher §7.1
   describes.
8. Take a Custom event back to a simple relationship. Confirm the message states the current time
   and the one the change would produce, and that it must be confirmed.
9. Shorten the slide below an element's end. Confirm nothing is silently clamped, the overrun names
   the element, and the offered action extends the slide to exactly the latest end.
10. Enter read-only mode. Confirm seeking and playing still work and every mutating control says
    why it is unavailable.

Feature 005 left its equivalent manual pass (T116) open, because it needs a human with assistive
technology. This one will too, and saying so is better than marking it done.
