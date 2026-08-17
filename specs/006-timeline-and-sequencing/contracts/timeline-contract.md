# Contract: The timeline surface

**Feature**: `006-timeline-and-sequencing` · Covers US1, US2, US5 · FR-001–FR-017, FR-037–FR-040

What the timeline promises, in the order a reviewer would check it.

---

## 1. Tracks

```text
buildTracks(slide: Slide): readonly Track[]
```

**Pure. Node project. No DOM.**

| Promise | Requirement |
|---|---|
| One track per element in `slide.elements`, in paint order | FR-002 |
| A track's `startMs`/`endMs` are the element's authored values, unmodified | FR-002, SC-001 |
| A hidden element gets a track | FR-003 |
| An element outside the current authoring window gets a track | FR-003 |
| A locked element gets a track, marked locked | FR-016 |
| An effect produces one bar at `[startMs, startMs + durationMs)` | FR-019 |
| Two overlapping effects produce two bars | edge case |
| A slide of zero elements produces zero tracks and does not throw | edge case |
| A slide of zero **duration** still produces a track per element | edge case |

**The negative promise, and the one worth a named test.** `buildTracks` must not call `resolve`.
`RenderState.elements` is visible elements only (BR-010), so a timeline built from it loses a track
exactly when the teacher needs it. A test asserts that an element with `hidden: true` and an
element whose window excludes time 0 both appear.

## 2. Scale

```text
createScale(pxPerSecond: number): {
  toPx(ms: number): number
  toMs(px: number): number
  clampPxPerSecond(value: number): number
}
```

**Pure.** `toMs(toPx(ms))` returns `ms` for every integer millisecond within a slide's duration —
a round-trip property test, because a lossy conversion is a drag that lands somewhere other than
where it was released.

`clampPxPerSecond` bounds to `[MIN_PX_PER_SECOND, MAX_PX_PER_SECOND]`.

`Slide.durationMs` is `msInt` — integer **≥ 0** (`lesson.ts:32`), not the positive `msDuration` an
earlier draft assumed. So zero is legal and reachable for any slide that advances `on_click`: the
ruler has no width to draw, and the round-trip property over "every millisecond in the slide" is
vacuously true. Both are fine; both must be *visibly* fine rather than silently skipped — the ruler
draws at zero width without dividing by zero or looping, and the round-trip test says out loud that
it asserted nothing.

**Changing the scale preserves the moment, not the pixel** (FR-007). The playhead's time is the
stored value; its position is computed from it. A test changes the scale and asserts the authoring
time is byte-identical.

## 3. Timing gestures

```text
moveRange(range, deltaMs, snapTargets, options): TimeRange
resizeRangeStart(range, deltaMs, snapTargets, options): TimeRange
resizeRangeEnd(range, deltaMs, snapTargets, options): TimeRange
```

**Pure. Milliseconds in, milliseconds out. Never pixels.**

| Promise | Requirement |
|---|---|
| Move changes start and end together; duration is unchanged | FR-012 |
| Resizing the start changes `startMs` alone | FR-013 |
| Resizing the end changes `endMs` alone | FR-013 |
| Every returned value is a non-negative integer | FR-014, BR-001, BR-002 |
| `endMs - startMs >= MIN_ELEMENT_DURATION_MS` | FR-014 |
| A move dragged before zero stops at zero, keeping its duration | edge case |
| Within `SNAP_THRESHOLD_MS` of a target, the result lands on it exactly | FR-015 |
| `SNAP_THRESHOLD_MS === 0` disables snapping entirely | negative control |

Snap targets are every *other* event's start and end on the slide, plus 0 and `slide.durationMs`.
An event never snaps to itself.

**Why not `geometry/transform.ts`.** Time is one-dimensional, integer, floored at zero, and snaps
to event boundaries rather than to edges and centres. Sharing the code would give the geometry
module knowledge of milliseconds (R-07). What is shared is the shape: pure, clamped so the reducer
can never be handed something the schema rejects, tested with no DOM.

## 4. The playhead and the clock

**There is exactly one authoring time** (FR-006, FR-011). `canvas/AuthoringTime.tsx` is deleted,
not deprecated — leaving both would give a teacher two widgets that disagree the moment one is
dragged during playback.

```text
usePlayback(session, options): {
  state: 'idle' | 'playing' | 'paused'
  play(): void
  pause(): void
  restart(): void
  seek(ms: number): void
}
```

| Promise | Requirement |
|---|---|
| Playback runs `createTransport` from `@cuestack/core` | FR-010, SC-015 |
| Its ports come from `browserPorts()` in `@cuestack/react` | R-01 |
| The studio package contains **no** clock primitive, with no exemption | R-01, enforced by `no-clock-in-studio` |
| Hiding the document pauses playback and returning resumes it | FR-010, BR-013 |
| A playhead drag during playback issues `seek()`; playback continues from there | US1 §11 |
| On pause, seek, and stop, `session.authoringTime === transport.slideTimeMs` | R-02 |
| While playing, `session.authoringTime` is permitted to lag | R-02, declared divergence |
| An element entering mid-slide **mounts during playback**, with no seek issued | FR-010, R-02 |
| While playing, the canvas renders the **frame's** resolved state, not `resolve(slide, session.authoringTime)` | R-02 |
| The canvas is handed the `FrameWriter`, so per-frame writes reach real nodes | R-02 |
| The frame loop is mounted **only while playing**; idle costs zero writes | R-02, SC-004 |
| The writer is created once and passed from first render | R-02 |
| Every authoring-time change goes through `seek`, and `seek` writes once | FR-011, R-02 |
| `will-change` is never left on an element after playback stops | R-02 |
| Ghost labels read the same moment the canvas does | FR-003, R-02 |
| The transport is built once per slide, not per draft revision | R-02 |
| `writer.clear()` runs on slide change and unmount | R-02 |
| A slide change seeks the new transport to that slide's restored authoring time | FR-012, R-02 |
| `goToSlide` is never called — playback runs the selected slide | out of scope |

**The lint rule.** `no-clock-in-studio` forbids `performance.now`, `Date.now`,
`setInterval`, `setTimeout`, and `requestAnimationFrame` in `packages/studio/src`, **with no
exemption**. Intention is not a mechanism; the specification named two clocks as the failure mode,
so the bound is a rule that fails a gate.

The absence of an exemption is load-bearing and costs one export. `useFrameLoop` owns
`requestAnimationFrame` and `browserPorts` owns `performance.now`, both in `@cuestack/react` — but
`browserPorts` is not exported from that package's entry point today. Exporting it is what lets
`usePlayback.ts` import both rather than reimplement either, and an exemption for `usePlayback.ts`
would be a hole in the rule at the one module most likely to grow a clock.

Written as `no-restricted-globals` (the timer functions and `Date`, which covers `new Date()` since
that is a reference to the global) plus `no-restricted-syntax` (`Date.now`, `performance.now`),
**not** as an addition to the studio package's existing
`no-restricted-properties` block. Flat config replaces a rule's configuration rather than merging
it, so a second block using the same rule name would disarm the DOM-measurement ban for every file
both blocks match — feature 005's innerHTML defect exactly. `NO_INNER_HTML` is spread back into the
syntax block for the same reason, and the gate self-test gets a negative control for both halves.

**Three mechanisms, not one.** The writer changes a mounted node's appearance. An element entering
mid-slide has no node — mounting it is an ordinary React render, and `EditorCanvas` computes
`resolve(slide, session.authoringTime)` at render time from a value R-02 leaves stale while playing.

1. **A trigger.** `usePlayback` keeps the *set of visible element ids* in state, re-rendering when
   that set changes and at no other time.
2. **A value.** The render then reads the frame's resolved state from a ref — `LessonPlayerClient`
   does both on one line: `const state = visibleIds === '' ? initial : latest.current`. A trigger
   without a value recomputes the same frozen state from the same stale time. This is the half that
   looks like the whole fix and is not.
3. **Registration.** `SlideView` and `ElementFrame` already accept a `writer` and call
   `writer.refFor(element.id)`, but `EditorCanvas` must pass one down or the node map stays empty
   and `write()` does nothing.

**And one rule, because the writer is a second reader of time: while it exists, it owns the
continuous properties.** `--cs-opacity`, `--cs-tx`, and `will-change` come from whatever moment the
writer was last given; structure and geometry come from `session.authoringTime`. So every
authoring-time change goes through `seek` — the ruler, the playhead drag, its keyboard nudge, a
slide change — and **`seek` writes once**, exactly as a frame does. `setAuthoringTime` is public and
feature 005's tests call it directly, so this is a stated rule rather than a convention.

Mounting the loop **only while playing** spares the editor a resolve-and-write per frame while a
teacher is merely dragging, which SC-004's budget at 300 elements would notice. Writing once per
seek is what makes that guard safe. Most continuous values would survive the gap unaided —
reconciling on stop re-renders the moment the writer last wrote, and React takes ownership of those
keys. `will-change` would not: it is set imperatively and rendered by nobody, on purpose, so
nothing else can ever remove it. Pause mid-effect, scrub away with no write, and it is stranded on
every animating element.

The writer is therefore created once and handed to the canvas from the first render, not at
`play()`. Registration runs through a ref on mount; a writer that arrives later leaves mounted
elements unregistered and loses the first frame.

**A slide change is not a seek.** It rebuilds the transport, so it needs its own sequence: clear the
writer, construct the new slide's transport, seek it to that slide's **restored** authoring time,
and write once. The session keeps time per slide — `times[slideId] ?? 0`, "so returning to a slide
returns to where the teacher left it" (FR-012, feature 005) — so a fresh transport starting at zero
would leave the canvas rendering 3 000 ms against a clock saying 0, and the first `play()` would
jump the canvas backwards.

**How this is tested.** By advancing an injected `TimeSource`, never by waiting. Constitution II
forbids wall-clock sleeps and real `requestAnimationFrame` in tests, and the transport takes its
clock as a port precisely so this is possible.

One test in the playback suite must **not** issue a seek: play from before an element's `startMs`
past it and assert the element mounted. Every other test here drives a seek, which emits a snapshot
and re-renders — the blind spot that hid this class of defect in Wave 2, recorded in
`useFrameLoop`'s own header.

## 5. Rendering

The canvas renders through `resolve()` — the same call, the same registries, the same static
renderers `LessonPlayerStatic` uses (FR-043, Constitution V). This feature adds no second
computation of what is on screen at a moment. A resolver change appearing in implementation is the
drift signal the specification named.

**Asserted, not merely arranged.** `useFrameLoop` calls the same `resolveAt` a seek does, so the
two paths agree by construction — but this feature gives the editor a *second* path to visual
state, and Constitution V is NON-NEGOTIABLE precisely because "true by construction" describes
every parity bug before it shipped. The parity suite gains one assertion: the render state produced
by the frame loop at time *t* equals the one a seek to *t* produces.

## 6. Overruns

```text
overrunsOf(state: RenderState): readonly RenderProblem[]
requiredDurationMs(slide: Slide): number
```

`overrunsOf` filters `state.problems` to `ELEMENT_BEYOND_SLIDE` and `EFFECT_BEYOND_SLIDE`. The
editor detects nothing: the kernel has emitted both since Wave 1 (R-08), and each problem already
carries `elementId`, optional `effectId`, and a message stating the problem, the element, and the
action — FR-040 satisfied by the kernel's own wording rather than by a second message.

| Promise | Requirement |
|---|---|
| Every overrunning element or effect is identified and attributed | FR-037, SC-011 |
| The offered action extends the slide to contain the latest one **exactly** | FR-038, SC-011 |
| Reducing a slide's duration leaves authored values intact and reports the overrun | FR-039, BR-017 |
| With no overrun, the timeline says nothing about durations | US5 §5 |
| A zero-duration slide is reported once, about the slide — not once per element | edge case |

## 7. Refusals, keyboard, and accessibility

| Promise | Requirement |
|---|---|
| Every change goes through `applyEdit` | FR-042 |
| A locked element's bar refuses a drag and the editor says why | FR-016, BR-011 |
| In read-only mode every mutating control is unavailable and says why; seeking and reading remain | FR-047 |
| Playhead, tracks, and current time are keyboard-operable | FR-009, SC-009 |
| The current time is conveyed with a subject, not as a bare number | FR-008 |
| Every interactive control has an accessible name; axe reports zero violations | FR-046, SC-010 |
| Every interactive control shows a **visible focus indicator** — axe does not check this, so it needs its own assertion | FR-046 |
| A 1 ms bar renders at least `MIN_BAR_PX` wide and stays grabbable | edge case |

## 8. What never reaches a manifest

Time scale, scroll position, which view is open, the authoring time, and transport state. SC-014
verifies by saving and comparing. Feature 005 established the invariant; this feature adds four
values to it and must not be the one that breaks it.
