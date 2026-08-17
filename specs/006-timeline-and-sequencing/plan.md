# Implementation Plan: Timeline and Simple Sequence Mode

**Branch**: `006-timeline-and-sequencing` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-timeline-and-sequencing/spec.md`

## Summary

Time becomes visible, editable, and sequenceable. ED-3 and ED-4 of Wave 4.

Four decisions carry the feature, and the first is the one the specification named as the risk.

**There is one clock, and it already exists.** `createTransport` has been in `@cuestack/core` since
Wave 1 with play, pause, seek, restart, and `visibilitychange` handling. The editor becomes its
second consumer; ED-6 will be its third. Nothing here implements timing. The bound that keeps that
honest is a lint rule with **no exemption**: no module in the studio package may read
`performance.now`, `Date.now`, `setInterval`, `setTimeout`, or `requestAnimationFrame` — if the
editor needs to know what time it is, it asks the transport. **A lint rule and not a
dependency-cruiser one**, for the reason feature 005 learned the hard way when its DOM-measurement
rule was written as a graph rule: this restricts *identifiers*, and a module-graph tool can only
forbid an import the design requires.

That the rule can be absolute rests on one export that does not exist yet. `useFrameLoop` owns
`requestAnimationFrame` and `browserPorts` owns `performance.now`, both in `@cuestack/react` — and
`browserPorts` is not exported from that package. Exporting it is the difference between a rule
with no holes and a rule exempting the one module most likely to grow a clock.

**Playback does not go through React state — except for structure.** The transport emits when
*commanded*, never on a timer, so something has to drive frames — and `useFrameLoop` already does,
writing CSS custom properties directly through `FrameWriter` rather than re-rendering. The editor
reuses that path verbatim. The consequence is deliberate and declared: **while playing,
`session.authoringTime` is stale**, because syncing it per frame would re-render the canvas sixty
times a second and put SC-004's 100 ms budget out of reach. It is reconciled the moment playback
stops.

The qualification is the part that makes the rest safe, and it has two halves that must arrive
together. A writer changes a mounted node's appearance; an element entering mid-slide has no node
yet, and mounting it is an ordinary render — so the set of visible element ids stays in React state
and re-renders when it changes. **And the render must then read the frame's resolved state, from a
ref, rather than re-deriving it from the stale authoring time.** The player carries both, on one
line: `const state = visibleIds === '' ? initial : latest.current`. Naming only the trigger reads
like naming the fix and leaves the canvas exactly as frozen.

The loop is also mounted only while playing. `useFrameLoop` ticks from mount and has no state guard
of its own; an editor that is not playing has no reason to resolve and write every frame, and every
reason not to at 300 elements. That guard is also what keeps the remaining rule small: while the
loop is mounted, continuous properties come from the transport's time and structure from the
session's, so **every authoring-time change goes through `seek`** — otherwise the canvas is split
between two moments.

**Tracks are drawn from the draft, not from `RenderState`.** Timing is authored data. `RenderState`
deliberately omits hidden elements and elements outside their window, so a timeline built from it
would lose a track exactly when the teacher needs it to change the timing that made it disappear.
This is the ghosts lesson from feature 005, arriving in a second place: the resolver answers "what
is on screen now", and the editor also needs "what exists".

**A sequence relationship is derived, never stored.** Constitution III forbids mode-specific
storage outright, so Simple Sequence reads absolute times and classifies them. That makes the whole
of ED-4 a pure function over a slide — which is also what Constitution II demands, since it names
"Simple Sequence to absolute-time conversion" among the things that must be developed test-first.

**One core change, and it is the same shape as last feature's.** `EffectDescriptor` declares a
type, phases, a motion flag, `at`, `reduced`, and a default easing — and says nothing about its
*parameters*. `pulse` reads `amount`, `slide` and `zoom` read `from`, `dim` and `highlight` read
`amount`, each with a default inlined in its own `at()`. FR-025 requires the editor to source
parameters from the registry rather than from a list it maintains, so `EffectDescriptor` gains a
`parameters` declaration — reusing `InspectorField`, the type feature 005 extended for exactly this
class of problem.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, unchanged from features 001–005.

**Primary Dependencies**: No new runtime dependencies. `@cuestack/studio` already depends on
`@cuestack/react`, `@cuestack/core`, and `@cuestack/schema`. This feature adds a dependency on
`@cuestack/core`'s transport and clock, which the package's dependency edge already permits.

**Storage**: N/A. Edits change the in-memory draft; ED-5 owns persistence.

**Testing**: Vitest 4.1.x with the two studio projects feature 005 established — `@cuestack/studio`
with happy-dom, and `@cuestack/studio-pure` in `node` for `test/{geometry,draft}` plus any
`*.pure.test.ts`. The sequence resolver, the event model, and the timing arithmetic all belong in
the pure project. **happy-dom has no `requestAnimationFrame` timing guarantees and no compositor**,
so playback is tested by driving a fake `TimeSource` through the transport, exactly as every kernel
timing test since Wave 1 does — never by waiting.

**Target Platform**: Browser only. No server entry; the studio package has no `react-server`
condition and this feature adds none.

**Project Type**: Library — the existing four packages plus the example app.

**Performance Goals**: Playhead move to rendered state ≤ 100 ms (NFR-PERF-003 — it is a seek). Drag
feedback ≤ 100 ms (NFR-PERF-002). Editor playback holds the player's own frame budget, measured as
the editor's work and not paint.

**Constraints**: One clock. One renderer. No new lesson-format fields. Simple Sequence stores
nothing.

**Scale/Scope**: **The timeline is per-slide, and the Constitution's fixture gives every slide six
elements.** Measured: 50 slides, 300 elements, 6 per slide, 290 effects. So the timeline faces
roughly six tracks, not three hundred — see the Complexity note on SC-012.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| **I — Code Quality & Modular Boundaries** | Pass | Effects come from the registry and their parameters from the registration; no branch on effect type anywhere. The single core change is additive to a descriptor no manifest serializes. A new lint rule forbids clock primitives in the studio package. |
| **II — Test-First & Deterministic** | Pass, and this feature is squarely inside its named scope | The constitution names "playback timing" and "Simple Sequence to absolute-time conversion" among the things that MUST be developed test-first, and forbids tests that depend on wall-clock sleeps or real `requestAnimationFrame`. Both are satisfied by the same means: the sequence resolver is pure, and playback is driven through an injected `TimeSource`. BR-016 and BR-017 get tests named for their rule IDs. |
| **III — User Experience Consistency** | Pass | §7.1's "simple first, precision on demand" is the feature. Mode-specific storage is forbidden and not introduced. Keyboard operability ships per surface. Theme tokens only. |
| **IV — Performance as a Contract** | Pass, with one measurement gap named | Seek and interaction budgets are inherited. The gap is that the perf fixture has no dense *single* slide, so SC-012 cannot currently stress a timeline — Complexity Tracking records the fix. |
| **V — Preview-Player Parity** | Pass | The timeline renders through `resolve()`; playback runs the player's transport and the player's frame loop. Two consumers of one engine, which is the principle rather than a risk to it. |

**Not armed by this feature.** Gate 5 (parity fixtures) stays a placeholder: it compares *preview*
to playback, and preview is ED-6. The acceptance job stays "A, B, C, F" — scenario D needs
persistence.

**Worth stating plainly.** This feature makes the editor a second consumer of the transport and ED-6
will make it a third. That is the intended shape — one engine, many consumers, which is what
Constitution V is *for* — but it is also the first time the transport has been driven by something
other than the player, and R-01 records what that exposed.

## Project Structure

### Documentation (this feature)

```text
specs/006-timeline-and-sequencing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── timeline-contract.md
│   ├── sequence-contract.md
│   └── effect-authoring-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/studio/src/
├── timeline/
│   ├── Timeline.tsx          # ruler, tracks, playhead — the surface
│   ├── Track.tsx             # one element's bar, its handles, its effects
│   ├── Ruler.tsx             # the time axis and the seek target
│   ├── Playhead.tsx          # driven by the frame loop, not by React state
│   ├── TransportControls.tsx # play, pause, restart, current time
│   ├── scale.ts              # time ↔ track-space, pure
│   └── timing.ts             # move/resize a time range, snap, clamp — pure
├── sequence/
│   ├── events.ts             # the ordered event list, derived from a slide — pure
│   ├── relationships.ts      # classify and resolve With/After/Custom — pure
│   ├── SequenceView.tsx
│   └── SequenceRow.tsx
├── effects/
│   ├── EffectControls.tsx    # add, configure, remove — fields from the registry
│   └── defaults.ts           # a new effect, born valid
├── draft/
│   └── edit.ts               # + set-timing, add-effect, set-effect, remove-effect,
│                             #   apply-sequence, extend-slide
├── session/
│   └── usePlayback.ts        # the transport, the frame loop, and one authoring time
└── canvas/
    └── AuthoringTime.tsx     # DELETED — the playhead replaces it (FR-006)

packages/react/src/index.ts             # + browserPorts, Ports (so studio needs no clock)
packages/core/src/effects/registry.ts   # + EffectDescriptor.parameters (the one core change)
packages/core/src/effects/builtin/*.ts  # + each effect declares what it reads

tools/scripts/fixtures/heavy-lesson.mjs # + a dense single slide, for SC-012
tools/eslint-config/index.js            # + no-clock-in-studio
```

**Structure Decision**: Three new directories inside the existing `@cuestack/studio` package rather
than a fifth package. The timeline is not independently useful, it shares the session, the reducer,
and the registries, and `check-studio-isolation` already proves none of it reaches a learner. The
split *within* the package follows what feature 005 established: pure modules (`scale.ts`,
`timing.ts`, `events.ts`, `relationships.ts`) carry the logic and run with no DOM; components are
thin.

## Complexity Tracking

> Three declared items. Two are bounded deviations; the third is a measurement gap this feature
> must fix rather than inherit.

| Item | Why | Simpler alternative rejected because |
|---|---|---|
| **While playing, `session.authoringTime` is deliberately stale** | The transport is the clock and the frame loop reads it directly. Pushing the time into React state per frame would re-render the canvas and every track sixty times a second. | *Sync state each frame.* Rejected on SC-004's budget: feature 005 already established that a reconciliation pass per element per frame is out of reach at scale, which is why `FrameWriter` exists. The bound: exactly one module (`usePlayback.ts`) may hold this divergence, it reconciles on every pause, seek, and stop, and a test asserts that after playback stops the session's time equals the transport's. Anything reading `authoringTime` during playback is reading a value that is *by contract* only accurate when stopped. **Structure is excluded from the divergence**, in two parts that must arrive together: the visible element set stays in React state *and* the render reads the frame's resolved state from a ref rather than re-deriving it from the stale time — the player's `visibleIds === '' ? initial : latest.current`. The loop is mounted only while playing, and while it is, every authoring-time change goes through `seek` so the canvas is never split between the transport's moment and the session's. That set of bounds is what makes this row a bounded deviation rather than a defect. |
| **`EffectDescriptor` gains `parameters`** | FR-025 requires the editor to source an effect's parameters from its registration. Today each effect reads an untyped bag with a default inlined in `at()` — `pulse` reads `amount`, `slide` and `zoom` read `from`. Nothing declares them. | *Keep a parameter list in the editor.* Rejected: it is a per-effect branch by another name, it rots the first time a ninth effect registers, and Constitution I calls that a defect. Reusing `InspectorField` rather than inventing a shape means the editor renders effect parameters through the same field components it already renders element properties with. Additive to a descriptor no manifest serializes. |
| **SC-012 cannot currently be measured** | The criterion asks the timeline to stay responsive "at 50 slides and 300 elements". The timeline is per-slide, and the Constitution's fixture gives every slide exactly six elements — measured, not assumed. Six tracks is not a load. | *Leave it.* Rejected: a criterion that passes because the fixture is easy is the theme-gate mistake in a new place — green while measuring nothing. The fixture gains a dense single slide (one slide carrying a large share of the elements) and SC-012 is measured against *that*. Whether virtualisation is needed becomes a measurement rather than a guess; at six tracks it plainly is not. |

## Phase Outputs

- **Phase 0** — [research.md](./research.md): ten decisions, R-01 through R-10.
- **Phase 1** — [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md).

**Post-design Constitution re-check: pass.** The design added no branch on element or effect type,
no second renderer, no second clock, and no lesson-format change. One core change, declared above
and in R-04. The deviation the specification predicted — "two clocks is the failure mode to design
against" — is answered by a lint rule rather than by intention, which is the difference
between a decision and a hope.
