# Quickstart: Validating the React SSR Player

**Date**: 2026-08-14 · **Feature**: `003-react-ssr-player`

How to prove this feature works. Each scenario maps to acceptance criteria in
[`spec.md`](./spec.md). **This is the first wave with something to look at** — Scenario 1 is a
page you open in a browser, not a terminal assertion.

## Prerequisites

Node 22.12+, pnpm 11, `pnpm install && pnpm build`. Nothing new is required at the toolchain
level; this feature adds test-environment dependencies only.

## Scenario 1 — Look at it (US1, US4)

```bash
pnpm --filter @cuestack/example-nextjs dev
```

Open the page. **Expected**: two stages.

The first is **slide 2, server-rendered and never hydrated** — its video element showing a
reserved-space fallback, because the reference lesson's assets are opaque ids with nothing
serving them and the page supplies no resolver. That is the honest behaviour, not a defect.

The second is **slide 1, hydrated and playing**, with controls beneath it. It is empty for its
first 500 ms by design: the title fades in, and the stage holds its shape so nothing shifts when
it arrives.

Resize the window. Both scale with it, keeping their proportions.

Then the part that matters:

```bash
# Disable JavaScript in devtools, reload.
```

**Expected**: the first stage is unchanged — the actual frame, not a spinner and not a blank box.
The second is an empty stage at the right proportions, which is what slide 1 correctly looks like
at time zero. Worth seeing once by hand before trusting the tests.

Slide 2 is the one to look at rather than slide 1 precisely because slide 1 at time zero
demonstrates nothing: a correctly shaped empty rectangle proves the stage works and says nothing
about content. If you want the assertion without a browser:

```bash
pnpm --filter @cuestack/example-nextjs build
python3 - <<'EOF'
import re
h = open('examples/nextjs/.next/server/app/index.html').read()
nojs = re.sub(r'<script[^>]*>.*?</script>', '', h, flags=re.S)
print(nojs.count('class="cs-stage"'), 'stages,',
      len(re.findall(r'data-cs-element-type', nojs)), 'elements, with every script removed')
EOF
```

**Expected**: `2 stages, 1 elements, with every script removed`.

## Scenario 2 — The first slide is in the markup (US1, SC-001)

```bash
pnpm --filter @cuestack/example-nextjs build
grep -c 'Workplace Safety' examples/nextjs/.next/server/app/index.html
```

**Expected**: at least 1. The lesson's text is in the document, discoverable by a search engine
or a link preview without executing anything.

```bash
pnpm exec vitest run --project @cuestack/react ssr
```

**Expected**: the server render contains every element visible at time zero, with authored
geometry; an element entering at 500 ms is **absent**; and the render completes with no DOM
present at all.

## Scenario 3 — The server path reads nothing it cannot (US1 #6, SC-013)

```bash
pnpm exec vitest run --project @cuestack/react no-browser-globals
```

**Expected**: no reference to `window`, `document`, `matchMedia`, `getBoundingClientRect`, or a
clock appears in the server render path.

This is the check most worth having. Measuring a container in order to scale it is the *obvious*
way to solve Scenario 5, and doing so silently destroys Scenarios 1 and 2 — the server would emit
a layout for a viewport it cannot know.

## Scenario 4 — Hydration is seamless (US2, SC-002/003)

```bash
pnpm exec vitest run --project @cuestack/react hydration
```

**Expected**: server markup is byte-identical to the client's first render for every corpus
slide, and **zero** React mismatch warnings. Warnings fail the test rather than scrolling past —
React reports them through `console.error` rather than throwing, so the assertion is on the
console (research R-07).

## Scenario 5 — Scaling without shift (US3, SC-004/005)

```bash
pnpm exec vitest run --project @cuestack/react scaling
```

**Expected**, at container widths from 320 to 2560 px:

| Property | Result |
|---|---|
| Authored aspect ratio | Preserved at every width |
| Relative distances | Two elements 100 logical units apart stay proportionally so |
| Horizontal page scroll | None at any width |
| Layout change after scripts run | None — nothing moves or resizes |

The mechanism is CSS, so these are assertions about emitted style declarations rather than
measured pixels. That is the point: if the test had to measure, the implementation would have had
to measure too.

## Scenario 5b — Playback controls (FR-020)

```bash
pnpm exec vitest run --project @cuestack/react controls
```

**Expected**: a labelled group of real buttons and a real range input, every one with an
accessible name; the seek control stepping in whole seconds so an arrow key moves it visibly; and
rendering the controls does not pause the lesson.

That last one is not hypothetical. `transport.pause()` is the obvious way to obtain an initial
snapshot, and it stops playback — a control that halts the thing it controls by existing.

## Scenario 6 — Every element type renders (US4, SC-007)

```bash
pnpm exec vitest run --project @cuestack/react elements
```

**Expected**: all seven types produce output, each with authored geometry and layer order. The
suite is written so that a renderer producing nothing fails rather than passing quietly.

Spot-check by hand: a `shape` should be `aria-hidden` (a rectangle has nothing to announce),
while a `button` should be a real `<button>` carrying its label as an accessible name.

## Scenario 7 — Accessibility (US4 #5, SC-009/010)

```bash
pnpm exec vitest run --project @cuestack/react a11y
```

**Expected**: axe reports no WCAG 2.2 AA violations on any corpus slide, and every interactive
element is reachable by keyboard with a name, role, and state.

**What this does not prove.** Automated checking catches roughly half of real accessibility
defects. The half it catches is the half that regresses silently — a missing accessible name is
invisible when you can see the screen. Neither this nor the keyboard sweep substitutes for using
the player with a screen reader, which belongs in review.

## Scenario 8 — No theme literals (SC-008)

```bash
pnpm lint
```

Then break it deliberately:

```bash
# add `color: '#333'` to any element renderer
pnpm lint
```

**Expected**: rejected, naming the rule. A hard-coded colour survives review and then survives
every theme, which is why this is a gate rather than a convention. **Revert afterward.**

## Scenario 9 — Rendered parity (SC-011)

```bash
pnpm exec vitest run --project @cuestack/react rendered-parity
```

**Expected**: for every corpus slide and every state-change boundary, the *rendered output* of
seeking to a time equals that of playing to it.

Feature 002 proved this for the computed state. This proves it for the pixels — the same
guarantee, now with the renderer in the path. If it holds, an editor preview and a learner player
cannot diverge, which is the whole argument for one resolver.

## Scenario 10 — A host embeds it (US5, SC-012)

```bash
pnpm exec vitest run --project @cuestack/react embed
```

**Expected**: a minimal host renders a lesson with no dependency beyond the framework and React;
the player applies no styles outside its own stage; and it works with no server rendering at all.

## What this feature still does not do

Questions render, are announced, and cannot be answered. Media renders with native controls and
is not synchronised to lesson time. **Navigation buttons carry their action and do not act** —
advancing needs the transport, which the renderer contract withholds, so the action reaches the
markup as a data attribute for Wave 3 to wire through the player. There are no slide transitions
and no progress display.

Reduced motion *is* honoured, ahead of schedule: neutralising a custom property inside a media
query needs no script, so the floor works on the server-rendered first frame. What remains for
Wave 3 is per-effect reduced alternatives rather than the mechanism.

Assets are addressed by a host-supplied `resolveAsset`. Without one, an id that is already a
locator is used as such and anything else renders a described, space-reserving fallback. A
publishing pipeline that resolves ids properly is BR-018, in Wave 5.

If you click a question, nothing happens, and it says so.

**Correction.** This document previously said "If you press play and reach the end of a slide, it
advances." That was never true. `slideIndex` was a fixed prop, nothing in `@cuestack/react`
imported `createAdvanceController`, and no test caught it because every player test rendered a
single slide. Wave 3 builds slide-to-slide advancement; see
`specs/004-player-completion/` research R-04.

Two further things Wave 2 did not do, found while building it:

- **No element appeared or disappeared during playback.** The frame loop wrote style
  properties every frame, but only the transport's subscription re-rendered React — and the
  transport emits when commanded, not as time passes. An element entering at 500 ms therefore
  had no node for the writer to write to. Every player test drove `seek()`, which does emit, so
  the path a learner takes was the one path never exercised.
- The frame loop itself was never driven by a test, only by the example app.
