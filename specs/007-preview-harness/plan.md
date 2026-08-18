# Implementation Plan: Preview Harness

**Branch**: `007-preview-harness` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-preview-harness/spec.md`

## Summary

A teacher watches their lesson the way a learner will, and the parity gate stops being a
placeholder. ED-6 of Wave 4.

Four decisions carry the feature, and the first is the reason this one is smaller than it sounds.

**The preview is the player, mounted by the editor.** `LessonPlayerClient` already accepts a
starting slide, real ports, an asset resolver, host chrome as children, and hands back the
transport through `onReady`. A preview is therefore *composition*, not construction: mount the
player over the draft, seek the transport to the moment the editor was at, and put the editor's own
controls beside it. If planning had found itself building a second player, that would have been the
drift signal — the spec named it as one. It did not.

**Composition has one seam, and it is in the player's render rather than its props.** `children` is
rendered inside a ternary — `complete ? <LessonComplete/> : gestureGiven ? children : <GesturePrompt/>`
— so it is absent at the completion state and behind a gesture prompt. The preview's chrome is
therefore split, and the line is **what must survive that ternary** rather than what needs the
transport: the preview holds the transport in a ref anyway, for the start-point seek. Inside go the
controls only meaningful while the lesson plays — play, pause, seek, previous, next. Outside goes
everything that must stay reachable: close, restart, the override switch, its indicator, the
viewport preset. A Close button that vanished at the end of a lesson would leave a teacher who had
just watched their work through with one control, and it replays the lesson.

One prop on the preview itself exists only for tests, and it is load-bearing: **`ports`, passed
straight through to the player**. A player given none builds `browserPorts()` internally, so without
this there is no clock a test can advance and Constitution II — NON-NEGOTIABLE on substitutable
timing — could not be met for any suite that drives playback, which is most of them. `usePlayback`
carries the identical seam and the identical comment.

**The other seam is behind the preview, not inside it.** Modality was planned as free — the preview
covers the editor, touches no session state, and so FR-006's "closing returns the editor to what it
held" is the absence of a restore path rather than a restore path that works. Two things have to
hold for that to be true, and neither holds by itself. Tab does not respect z-index, and every key
handler in the studio is element-scoped, so focus is the whole path into an edit: the preview is a
modal `<dialog>` (FR-030), which hands the top layer, the inertness, the focus containment, and
Escape to the platform — and is the only option, since the studio exports parts a host composes and
has no editor root to mark `inert`. And `usePlayback` ticks for as long as its state is `playing`,
so opening a preview mid-playback would leave a second frame loop running over the same slide and
would move the very authoring time FR-006 promises to restore — opening therefore pauses the
editor's playback first, through the one write path that already commits the moment.

**The override already exists, and this feature gives it its first producer.** `AdvanceController`
takes `allowOverride`, `AdvanceCause` includes `'override'`, and `AdvanceSignals` carries
`overrideAdvance`. All three are described in the code as **test-only**, and all three have never
been passed by anything: `LessonPlayerClient` calls `createAdvanceController(activePorts)` with no
options and builds signals with no override. FR-ADV-011 has been in the product specification the
whole time, so the affordance was always going to acquire a real consumer. This is the fifth
contract member this wave has found declared and unproduced, and the pattern is now worth planning
around rather than noticing again. The seventh analysis pass found the sixth: `Ports.assets` is
declared and read by nobody, assets reaching the player through the `resolveAsset` prop instead.
That one is left alone deliberately — unifying two asset paths is a kernel decision, not a preview
one — but the count is the point.

**What must not change is the bound the option's own comment states**: "a test affordance that leaks
into playback is worse than none, because it will eventually fire by accident." So the player gains
one optional prop, absent by default; a learner's player passes nothing, builds the controller
exactly as it does today, and the signal stays inert.

**The parity gate runs what already exists, plus one narrow addition.** Not preview against player:
the preview mounts the player unmodified, so those two cannot disagree, and a gate that cannot fail
is the thing SC-012 exists to prevent. And not canvas against player either — feature 005 already
built that, byte-identically, and even guarded the tautology this plan's first draft fell into.

What remains is one element. `staticRenderers` and `builtinRenderers` are the same seven objects
except `staticQuestionRenderer` against `questionRenderer`, so the question element is the entire
divergence surface between them — and it is where feature 005's real divergence was. SC-003's 100 ms
stays the *published* claim, which this feature cannot verify.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, unchanged from features 001–006.

**Primary Dependencies**: No new runtime dependencies. `@cuestack/studio` already depends on
`@cuestack/react`, `@cuestack/core`, and `@cuestack/schema`; the preview needs nothing beyond what
those already export — `LessonPlayerClient`, `PlaybackControls`, `LessonComplete`, and the
transport.

**Storage**: N/A. The preview reads the in-memory draft and writes nothing at all.

**Testing**: Vitest 4.1.x, the two studio projects features 005 and 006 established, plus the
existing `@cuestack/react` suites for anything the player itself gains. Playback is driven by an
injected `TimeSource` through `runFrames`, never by waiting — the harness the timeline feature
built is reused verbatim.

**Target Platform**: Browser only. The preview is client-only, like the editor; the player's server
entry is untouched.

**Project Type**: Library — the existing four packages plus the example app.

**Performance Goals**: Opening a preview is a **mount**, and must stay inside the editor's own
interactive budget of 3 s at 50 slides / 300 elements (NFR-PERF-001, SC-009). Nothing here is
per-frame work the editor did not already do.

**Constraints**: One renderer. One transport. No lesson-format change. The preview writes nothing.
The override must remain unreachable from a learner's player.

**Scale/Scope**: The Constitution's fixture, unchanged — 50 slides, 300 elements, and since feature
006 a dense last slide of 55. A preview mounts one lesson, so the dense slide is again the
interesting case.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| **I — Code Quality & Modular Boundaries** | Pass | No registry is bypassed and no type is branched on. The player gains one optional prop; the editor gains a preview surface that composes existing components. `check-studio-isolation` continues to prove the player needs no editor code. |
| **II — Test-First & Deterministic** | Pass | Playback timing is in the named scope and is driven by an injected clock, as it has been since Wave 1. The parity comparison is deterministic by construction: `resolve` is pure. |
| **III — User Experience Consistency** | Pass, **with a gate to extend** | §7's preview affordances, keyboard operability per surface, theme tokens only. FR-019's continuous indicator is Constitution III's "error messages state the problem and the recommended action" applied to a state rather than an error. **CI gate 6 needs widening**: `gates/a11y.mjs` runs only `packages/react/test/a11y`, so the preview's axe assertions — which live in the studio's suite — would not be enforced by the blocking gate. The preview is learner-facing by construction, since it *is* the player, so this is the first time the gap has mattered. T062 closes it, following the precedent of `perf.mjs` and `theme-values.mjs`, both already extended to the studio. |
| **IV — Performance as a Contract** | Pass | The mount budget is inherited, not invented. Nothing in this feature adds per-frame work. |
| **V — Preview-Player Parity** | **Pass, and this is the feature** | The principle has been structural since Wave 1 and unverified since. FR-027 arms QA-5. Worth stating plainly: this feature does not *create* parity, it makes the existing property checkable — and the gate's value is catching the day someone breaks it. |

**Also armed by this feature.** `gate:a11y` reaches the editor package for the first time (T062),
because for the first time the editor package contains a learner-facing surface.

**Armed by this feature.** `gate:parity` stops being a placeholder. It has printed one since Wave 1
with an honest reason each time — first no editor, then no preview. Both halves now exist.

**Not armed by this feature.** The acceptance job stays "A, B, C, F"; scenario D needs persistence,
which is ED-5's.

## Project Structure

### Documentation (this feature)

```text
specs/007-preview-harness/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── preview-contract.md
│   └── parity-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/studio/src/preview/
├── Preview.tsx              # the modal: player, controls, chrome
├── PreviewControls.tsx      # play/pause/seek/prev/next/restart/close + the override switch
├── ViewportPreset.tsx       # desktop / tablet / mobile widths
├── usePreviewSession.ts     # start point, override, preset — session state, never serialized
└── startPoint.ts            # slide + moment, derived from the editor — pure

packages/react/src/player/LessonPlayerClient.tsx   # + overrideAdvance (the option's first producer)
packages/studio/src/canvas/EditorCanvas.tsx        # + resolveAsset, so the preview can inherit it

tools/scripts/gates/parity.mjs                     # placeholder → armed, running the suites that exist
packages/studio/test/parity/renderers.test.tsx     # static vs interactive: the question element
packages/studio/src/canvas/EditorCanvas.tsx        # + effects, finishing feature 006's T029 (iv)
```

**Structure Decision**: A `preview/` directory inside `@cuestack/studio`, not a fifth package and
not a component in `@cuestack/react`. The preview is an *editor* surface — it knows about the
draft, the current slide, and the authoring time, none of which a player may know. Putting it in
the adapter would put editor concepts in the package a learner loads, which `no-studio-in-player`
and `check-studio-isolation` both exist to prevent.

The player gains exactly one prop and no knowledge of previewing.

## Complexity Tracking

> Four declared items. The first is a deliberate widening of an existing affordance; the second is
> a gap this feature must close before it can keep its own promise; the third is the measurement
> that makes the parity gate mean something; the fourth is a story that had to be re-justified
> before it was worth building.

| Item | Why | Simpler alternative rejected because |
|---|---|---|
| **`allowOverride` stops being test-only** | FR-017 requires a teacher to move past any gate, and the controller already models exactly that — `allowOverride`, `signals.overrideAdvance`, and an `'override'` cause. All three have never been passed by anything. | *Build a preview-specific bypass.* Rejected: it would be a second answer to a question the advance controller already answers, and the two would drift the first time a gate kind was added. The bound the option's own comment demands is kept instead: the player's prop is **absent by default**, so a learner's player constructs the controller exactly as it does today and the signal stays inert. What changes is the comment — "test-only" becomes "test and preview" — and that is a documentation change to a contract that anticipated this. |
| **`EditorCanvas` gains `resolveAsset`** | FR-003 requires the preview to resolve assets as the player does, and the preview inherits whatever the *editor* was given. The editor currently passes nothing, so `SlideView` falls back to `defaultAssetResolver` — which means the editor has never been able to show a host's real assets either. | *Have the preview take its own resolver.* Rejected: it would let the canvas and the preview disagree about what an asset id means, which is the parity failure this feature exists to prevent, one layer down. The gap is the editor's and closing it there fixes both. |
| **US5 rests on a legibility floor, not on proportion** | FR-CAN-018's proportional scaling is what makes a preset cheap, and it is also what makes one nearly worthless: `.cs-stage` fixes the aspect ratio from the canvas and every dimension beneath is in `cqw`/`cqh`, so a smaller preview is the same picture at a smaller size. The one real difference is `max(12px, …)` on type, which takes over below 600 px for body text, 960 for captions, 800 for UI text on a 1600-wide canvas. FR-024 states it, and the preset widths are chosen against those numbers. | *Set widths from device marketing numbers and assert the width was set.* Rejected: every such test passes on a preview that shows the teacher nothing, which is how the story survived four analysis passes while being vacuous. *Simulate a device viewport properly — touch, user agent, chrome.* Rejected in R-05 as emulation that invites conclusions it cannot support. |
| **SC-001 adds one narrow comparison to parity coverage that already exists** | `test/parity/` already holds the canvas-versus-player comparison, byte-identical and across all seven types, written by feature 005. The untested surface is the *renderer sets*: `staticRenderers` and `builtinRenderers` differ in exactly one member, `staticQuestionRenderer` against `questionRenderer`. | *Compare preview and playback*, as the requirement's phrasing suggests — rejected: the preview mounts the player unmodified, and written as `resolve(slide,t) === resolve(slide,t)` it compares a pure function with itself and passes forever, including after parity breaks. *Compare canvas and player* — rejected on inspection of `test/parity/overlay.test.tsx`, which already does it and even carries the anti-tautology guard *"changes with time, so the equality above is not vacuous"*. A second file asserting the same thing is a duplicate that drifts. *Measure elapsed time between two mounts* — rejected separately: a timing harness answering a question with an exact answer. SC-003 remains the *published* claim. |

## Phase Outputs

- **Phase 0** — [research.md](./research.md): ten decisions, R-01 through R-10. R-05 and R-06 were both rewritten in the fifth analysis pass, against the stylesheet and against `usePlayback`.
- **Phase 1** — [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md).

**Post-design Constitution re-check: pass.** The design adds no second renderer, no second clock,
no branch on element or effect type, and no lesson-format change. One player prop, one widened
player prop type, one editor prop,
one new directory in the package a learner never loads. The risk the specification named — "if
planning finds itself adding a preview-shaped prop to the player, or forking a second player
component" — was checked against the code rather than reasoned about: `LessonPlayerClient` already
takes a starting slide, ports, an asset resolver, children, and `onReady`. It also already takes ports, and this feature widens that one to `Partial<Ports>` so a caller can
override a single member — the preview needs a discarding analytics adapter *and* the DOM media port
the player builds internally, which the all-or-nothing prop cannot express. The change preserves the
existing rule that a full object wins outright, and closes a trap any host could already have hit.
The one prop it gains
carries the override, which is the only thing a preview needs that a learner must never have.
