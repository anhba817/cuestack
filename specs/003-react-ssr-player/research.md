# Phase 0 Research: React SSR Player

**Date**: 2026-08-14 · **Feature**: `003-react-ssr-player`

Versions verified against npm on 2026-08-14. The substantive decisions here are about *where*
each concern lives — CSS or JavaScript, server or client — because that placement is what makes
server rendering possible at all.

---

## R-01: Scaling uses container query units, not a computed scale factor

**Decision**: The stage declares `container-type: size`, and every dimension inside it is
expressed in container query units — `calc(var(--cs-x) / var(--cs-canvas-w) * 100cqw)` and the
same for the vertical axis. No scale factor is computed anywhere.

**Rationale**: This is the decision the whole feature depends on, and the obvious alternative is
a trap.

The obvious approach is to measure the container and set `transform: scale(k)`. It works, it is
what most tools do, and it **cannot be server-rendered**: `k` requires a viewport the server does
not have. The server would emit an unscaled or guessed layout, the browser would correct it on
first paint, and the result is exactly the layout shift SC-004 forbids — while also defeating
FR-001's entire purpose, since the markup that arrived would be wrong.

Container query units resolve against the container's own size, which the browser knows during
layout and the server never has to. The same stylesheet therefore produces correct geometry in
both places, with no measurement, no script, and no shift. Font size scales too, which a
percentage-based approach cannot do — percentage font size resolves against the parent's font
size, not the container's width.

**Alternatives considered**:
- *`transform: scale()` from a measured width* — rejected above. Worth naming explicitly in the
  contract so a future contributor recognises it as considered and refused, not overlooked.
- *Percentages for position, a separate mechanism for type* — two mechanisms where one suffices,
  and the seam between them is where a mismatch would appear.
- *`vw`/`vh` units* — resolve against the viewport rather than the container, so an embedded
  player inside a host's sidebar would size itself to the window.

**Browser support**: container query units are available across the constitution's matrix
(latest two majors of Chrome, Edge, Safari, Firefox). This is the feature that makes the
approach viable now and would not have three years ago.

---

## R-02: Every visual value reaches the page as a CSS custom property

**Decision**: `RenderState` values become custom properties on the element — `--cs-opacity`,
`--cs-tx`, `--cs-ty`, `--cs-sx`, `--cs-sy`, `--cs-rotate`, `--cs-brightness`, `--cs-blur`. The
stylesheet consumes them; the renderer never writes `transform` or `opacity` directly.

**Rationale**: Three requirements fall out of one mechanism.

1. **The frame loop costs no reconciliation.** Writing a custom property on a ref does not
   involve React. Structure re-renders when an element appears or disappears; the sixty updates
   a second in between are direct style writes.
2. **Reduced motion becomes a stylesheet concern.** A later wave can neutralise motion with
   `@media (prefers-reduced-motion: reduce) { .cs-element { --cs-tx: 0px; --cs-ty: 0px } }` — no
   script, and therefore effective on a server-rendered first frame. This is the spec's
   highest-risk assumption, and this is what discharges it. Applying `transform` directly would
   make the preference unhonourable without JavaScript.
3. **The server and client paths are identical.** Both set the same properties from the same
   `RenderState`, so hydration compares equal by construction rather than by care.

**Alternatives considered**:
- *Inline `style={{ transform, opacity }}`* — simplest, and forfeits all three benefits. Reduced
  motion would need script, and the frame loop would need React.
- *A stylesheet class per effect state* — a combinatorial explosion, and impossible for
  continuous values.
- *Web Animations API* — genuinely better for smoothness once transitions exist, but it cannot
  produce a server-rendered first frame, and seeking a WAAPI animation reintroduces the replay
  problem the kernel's fold was designed to avoid. A candidate for Wave 3 *in addition to*, not
  instead of.

---

## R-03: The client's first render reproduces the server's, then the clock starts

**Decision**: Both server and client render `resolve(slide, 0)`. The clock starts in an effect
after mount, not during render.

**Rationale**: React hydration requires the client's first render to match the server's markup.
Starting playback during render would produce a different time and therefore different markup —
the mismatch FR-006 forbids. Deferring the clock to an effect makes the match structural: the
first client render cannot differ, because it is the same pure call with the same argument.

It also gives the correct behaviour for a learner with scripts disabled: they see the state at
time zero, which is a real frame of the lesson rather than an error state.

**Alternatives considered**:
- *Render the current time on the client* — the mismatch, directly.
- *`suppressHydrationWarning`* — silences the symptom and keeps the divergence. It would also
  silence a genuine future mismatch, which is worse than the noise.

---

## R-04: Element renderers are registered, mirroring the kernel

**Decision**: A React-side registry maps element type to component, with the same
complete-contract-or-refuse discipline as the kernel's. The existing
`no-switch-on-element-type` lint rule extends to `packages/react/src`.

**Rationale**: The kernel's extensibility is worthless if the renderer hard-codes a switch — a
new element type would resolve correctly and then have nowhere to appear. Extending the existing
lint rule rather than trusting convention follows the lesson feature 001 taught: its core/UI
dependency rule was green while enforcing nothing.

**Alternatives considered**:
- *One switch in `SlideView`* — the shape Constitution I forbids, and the reason the rule exists.
- *Renderers supplied by the kernel's `ElementPlugin`* — tempting, since the contract already has
  a slot for an editor component. Rejected: it would put React types in `@cuestack/core` and
  collapse the boundary the whole architecture rests on.

---

## R-05: The accessibility gate runs axe over rendered corpus slides

**Decision**: `axe-core` 4.13.x runs against every corpus slide rendered into happy-dom,
configured to WCAG 2.2 AA, as a blocking gate.

**Rationale**: SC-010 requires no violations at AA, and the gate placeholder from feature 001 is
armed here. Automated checking catches perhaps half of real accessibility defects — but the half
it catches is the half that regresses silently, and it runs on every change rather than when
someone remembers.

**Stated limitation**: passing axe is not the same as being accessible. Keyboard reachability
(FR-017) is asserted separately by driving focus, because axe cannot tell whether a focus order
makes sense. Neither check substitutes for using the thing with a screen reader, which belongs
in review rather than CI.

**Alternatives considered**:
- *Manual review only* — this is the class of defect review misses, since a missing accessible
  name is invisible when you can see the screen.
- *A hosted accessibility service* — network dependency in CI, for a check that runs locally.

---

## R-06: Compositor hints come from the kernel's output, not from renderer state

**Decision**: Whether an element is currently animating is read from
`ResolvedElement.activeEffects` being non-empty. The renderer sets `will-change` from that and
holds no state of its own.

**Rationale**: `will-change` wants to know "is this element about to move", which is timing
information. A renderer that tracked it would be keeping a second, private model of what is
animating — and the moment two models of animation exist, they can disagree. That is precisely
the divergence Principle V forbids, arriving through a performance optimisation rather than a
feature.

The kernel already reports it. Reading it costs nothing and keeps the count of timing
implementations at one.

**Alternatives considered**:
- *Track transitions in the renderer* — the divergence above.
- *Always set `will-change`* — promotes every element to its own compositor layer, which at 300
  elements costs more than it saves.

---

## R-07: happy-dom for the DOM environment; hydration warnings fail the build

**Decision**: happy-dom 20.11.x, with `console.error` patched during hydration tests so a React
mismatch warning fails the test rather than scrolling past.

**Rationale**: SC-002 requires zero mismatch warnings, and React reports them through
`console.error` rather than by throwing. A test that merely renders would pass with warnings
streaming by, so the assertion has to be on the console. happy-dom over jsdom for speed, since
SC-006's sibling requirement is a test suite that stays under five seconds.

**Alternatives considered**:
- *A real browser via Playwright* — higher fidelity, and appropriate for Wave 3's media and
  autoplay behaviour, which happy-dom cannot model. Not needed for markup equality, and the
  slowest possible way to check it.
- *jsdom* — slower, and its container query support is no better.

---

## R-08: React is a peer dependency, and the example app is the only consumer

**Decision**: `react` and `react-dom` are peer dependencies of `@cuestack/react`. Next.js
appears only in `examples/nextjs`.

**Rationale**: Bundling React would give a host two copies, which breaks hooks and context in
ways that surface as bewildering runtime errors rather than install failures. Keeping Next.js out
of the published package is what makes FR-025 true — the player must work in a host that does not
server-render at all, and depending on a framework that does would quietly prevent that.

---

## Resolved unknowns

Every Technical Context item is settled above. Inherited without re-litigation:

- **Toolchain** — TypeScript 6.0.3 and the rest, per feature 001 R-01. The TS 7 re-open trigger
  remains unmet.
- **DOM over canvas** — settled in the framework plan. This is the feature where that choice
  pays: a canvas renderer could not produce FR-001's server-rendered first frame or FR-017's
  keyboard-reachable controls without rebuilding both from scratch.
