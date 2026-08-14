# Implementation Plan: React SSR Player

**Branch**: `003-react-ssr-player` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-react-ssr-player/spec.md`

## Summary

`@cuestack/react` renders what the kernel computes, and Next.js serves the first slide from the
server.

The approach turns on one decision that resolves three requirements at once: **every visual
value reaches the page as a CSS custom property, and every dimension is expressed in container
query units.** Scaling then needs no measurement (FR-009), so the server can render correct
geometry without knowing a viewport (FR-004); the per-frame animation loop writes custom
properties on element refs instead of re-rendering React, so playback costs no reconciliation;
and reduced motion becomes overridable by a stylesheet in a later wave, because neutralising a
custom property inside a media query needs no script.

The renderer computes nothing. It reads `RenderState` and writes style properties. Any timing
logic here would give the parity guarantee a second, divergent implementation — which is the
one thing this wave must not do, since it is also the wave that gives parity its second
consumer.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, per features 001 and 002. Unchanged.

**Primary Dependencies**: React 19.2.x and React DOM 19.2.x as **peer** dependencies —
`@cuestack/react` must not bundle the host's React. `@cuestack/core` and `@cuestack/schema` as
workspace dependencies (types plus the resolver). Next.js 16.3.x in the example app only, never
in the published package.

**Testing**: Vitest 4.1.x with happy-dom 20.11.x for a DOM environment,
`@testing-library/react` 16.3.x for hydration, and axe-core 4.13.x for the accessibility gate.
SSR is exercised through `react-dom/server`; hydration through `hydrateRoot` with console
warnings promoted to failures.

**Storage**: N/A.

**Target Platform**: The server (Node 24, no DOM) and the browser matrix — latest two major
versions of Chrome, Edge, Safari, Firefox. Container query units are the load-bearing browser
feature and are available across all four.

**Project Type**: Library (published adapter) plus one example application.

**Performance Goals**: First slide visible within 2 seconds of lesson data being available
(NFR-PERF-006, SC-006). Zero layout shift attributable to the player (SC-004). Playback must
not re-render React per frame — the frame loop writes custom properties directly, so
reconciliation cost is per visibility change rather than per frame.

**Constraints**: No `window`, `document`, `matchMedia`, or clock read on the server path.
Geometry expressed only in container query units, so no measurement is ever required. No colour,
font, or spacing literal in any element renderer — all resolve from theme custom properties. No
global styles: everything scoped beneath the stage.

**Scale/Scope**: ~14 modules in `@cuestack/react`, seven element renderers, one stylesheet, and
the example app promoted from resolution probe to real player. 27 functional requirements, 13
success criteria.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| **I. Code Quality & Modular Boundaries** | Yes | PASS. Element renderers are registered, not switched on — the existing `no-switch-on-element-type` rule extends to `packages/react/src`. React stays a peer dependency so the host's copy is the only copy. `@cuestack/core` remains untouched by this feature, which is the boundary working. |
| **II. Test-First & Deterministic Verification** | Yes | PASS. SSR output, hydration equality, and scaling are all assertable without a browser, so they are written first. No new business rules gain subject matter here — the nine covered in feature 002 stay nine, and the count is now derived from the filesystem rather than asserted (see Complexity Tracking). |
| **III. User Experience Consistency** | **Yes — this is the wave** | PASS. Every clause becomes live: theme tokens only (FR-014, enforced by lint), keyboard operability and accessible name/role/state (FR-017), WCAG 2.2 AA as a merge gate (SC-010). The accessibility and theme-value gates left inert since feature 001 are **armed here**. |
| **IV. Performance as a Contract** | Yes | PASS. Two more budgets become live: first slide within 2 s (NFR-PERF-006) and zero layout shift. The 60 fps playback budget stays deferred to Wave 3, when there are transitions and media to drop frames on — but the architecture that makes it reachable is decided here, by keeping the frame loop out of React. |
| **V. Preview-Player Parity** | **Yes — the guarantee gains its second consumer** | PASS. Until now one resolver had one consumer, so parity was proven but unexercised. FR-027 forbids the renderer from computing timing, which is what keeps it true. SC-011 asserts the *rendered* result of seeking matches playing — the visible counterpart of what feature 002 proved internally. |

**Post-Phase-1 re-check**: PASS. The design strengthens Principle V rather than straining it:
because the renderer's only input is `RenderState` and its only output is style properties,
there is no place for a second timing implementation to hide. One consequence worth recording —
`will-change` and compositor hints are the sort of optimisation that tempts a renderer into
tracking "is this element animating", which is timing state. Research R-06 places that
information in the kernel's existing output instead.

## Project Structure

### Documentation (this feature)

```text
specs/003-react-ssr-player/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── react-package-api.md
│   ├── stage-css-contract.md
│   └── element-renderer-contract.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/react/
├── src/
│   ├── index.ts                    # client entry
│   ├── server.ts                   # server entry (react-server condition)
│   ├── player/
│   │   ├── LessonPlayer.tsx        # the component a host renders
│   │   ├── Stage.tsx               # scaled surface; owns the container context
│   │   ├── SlideView.tsx           # one slide's elements from a RenderState
│   │   ├── ElementFrame.tsx        # applies every --cs-* property; renderers never position
│   │   ├── usePlayer.ts            # exposes the kernel's transport, unwrapped
│   │   └── controls/
│   │       ├── PlaybackControls.tsx
│   │       └── controls.css
│   ├── frame/
│   │   ├── properties.ts           # the one place every --cs-* name is declared
│   │   ├── applyVisual.ts          # RenderState element -> style properties
│   │   ├── FrameWriter.ts          # the only imperative DOM writer in the package
│   │   └── useFrameLoop.ts         # rAF loop driving the writer
│   ├── elements/
│   │   ├── registry.tsx            # renderer registration, mirroring the kernel's
│   │   ├── Placeholder.tsx         # unregistered type: reserves space, announces itself
│   │   ├── AssetFallback.tsx       # failed asset: keeps space and a description
│   │   └── builtin/                # text, image, shape, video, audio, button, question
│   ├── theme/
│   │   └── tokens.ts               # lesson theme -> CSS custom properties
│   └── styles/
│       ├── stage.css               # container query units; the scaling mechanism
│       └── reset.css               # scoped beneath the stage only
└── test/
    ├── ssr/                        # renderToString, no-DOM assertions
    ├── hydration/                  # hydrateRoot, warnings promoted to failures
    ├── scaling/                    # geometry at multiple container widths
    ├── elements/                   # per-renderer output and accessibility
    ├── a11y/                       # axe over every corpus slide
    ├── embed/                      # consuming the package as a host would
    └── harness/

examples/nextjs/                    # promoted from resolution probe to real player
```

**Structure Decision**: `frame/` is deliberately separate from `player/`. The frame loop is the
one place that mutates the DOM outside React's control, and isolating it makes that reviewable —
a reader can see the entire set of imperative writes in two small files rather than hunting for
`ref.current.style` across the tree.

`styles/stage.css` is where scaling lives, in CSS rather than TypeScript. That placement is the
requirement: a scale factor computed in JavaScript cannot exist on the server, and putting the
mechanism in a stylesheet makes it structurally impossible to reintroduce one.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| The frame loop writes to the DOM directly, bypassing React's rendering | Playback updates opacity and transform up to 60 times a second. Routing that through React means a reconciliation pass per frame per element, which would put the 60 fps budget out of reach before Wave 3 even adds transitions. | Rendering per frame via state is the idiomatic approach and would be correct for a handful of elements. At the spec's stated ceiling — 300 elements — it is not, and discovering that in Wave 3 would mean rewriting the player rather than extending it. The mitigation is containment: all imperative writes live in `frame/`, and React still owns structure, so an element appearing or disappearing is a normal render. |
| Constitution II's business-rule tally is now derived rather than asserted | Four analysis passes across features 001 and 002 found errors in hand-maintained counts of in-scope rules, and two of those errors were introduced while correcting the previous one. | Continuing to assert the number in prose has a demonstrated failure rate. A `check-rule-coverage.mjs` reading `packages/*/test/rules/` and comparing against a declared scope removes the class instead of correcting instances — the recommendation the analysis passes kept making. It lands in this feature's Setup phase. |
