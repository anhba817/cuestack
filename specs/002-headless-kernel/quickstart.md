# Quickstart: Validating the Headless Kernel

**Date**: 2026-08-14 · **Feature**: `002-headless-kernel`

How to prove this feature works. Each scenario maps to acceptance criteria in
[`spec.md`](./spec.md). Run after implementation; the automated counterpart is the test suite
plus the CI gates from feature 001, with the perf gate now armed.

## Prerequisites

Same as feature 001 — Node 22.12+, pnpm 11, `pnpm install && pnpm build`. Nothing new: this
feature adds no dependencies.

```bash
pnpm test          # the whole suite, including the kernel
pnpm typecheck
pnpm lint          # now also forbids switching on element.type outside a registry
```

## Scenario 1 — A slide's state is computable with nothing running (US1, FR-001–003)

Write `probe.mjs` in `packages/core/`:

```js
import { resolve } from '@cuestack/core'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }

const slide = reference.slides[0]
for (const t of [0, 499, 500, 1250, 2000, 8000, 99999, -100]) {
  const state = resolve(slide, t)
  console.log(t, '→', state.elements.map((e) => `${e.id}@${e.opacity.toFixed(2)}`).join(' '))
}
```

```bash
pnpm build && node packages/core/probe.mjs
```

**Expected**: the title is absent at 499 ms and present at 500 ms; at 1250 ms it is mid-fade with
an opacity strictly between 0 and 1. Times outside the slide return a state, not an error. No
`window`, no clock, no prior call — this runs in bare Node.

## Scenario 2 — Playing to a time equals seeking to it (US1 #4, SC-002)

```bash
pnpm exec vitest run play-vs-seek
```

**Expected**: for every slide in the corpus and every millisecond boundary where something
changes, the state reached by stepping a transport forward is deep-equal to the state returned by
asking directly. This is the sweep that makes Constitution V's parity guarantee mechanical rather
than aspirational — if it passes, an editor preview and a learner player *cannot* diverge,
because there is only one function and it has no memory.

## Scenario 3 — Determinism (SC-003)

```bash
pnpm exec vitest run resolve-determinism
```

**Expected**: two consecutive resolutions are byte-identical across the corpus. Watch for the
same leak feature 001 guarded against — an id or a timestamp generated during resolution.

## Scenario 4 — A slide advances exactly once (US2, SC-005)

```bash
pnpm exec vitest run advance-combinations
```

**Expected**: every combination of simultaneously-satisfied conditions yields exactly one
decision. Three conditions firing in the same tick is not a case anyone writes by hand, which is
why this is swept exhaustively rather than sampled.

Also asserted: a required question suppresses duration advance; a paused video postpones rather
than cancels; a late signal for an advanced instance is ignored; and a *replayed* slide can
advance again — the instance key distinguishes "already advanced" from "visited afresh" (R-05).

## Scenario 5 — The clock tracks the learner, not the wall (US3, SC-010)

```bash
pnpm exec vitest run transport
```

**Expected**, all driven by a hand-advanced synthetic source with no real waiting:

| Situation | Result |
|---|---|
| Paused, outside time passes | Lesson time unchanged |
| Document hidden, then visible | Resumes from stored position |
| Time source jumps by an hour | Treated as a pause; lesson time barely moves |
| Sampled repeatedly while playing | Never decreases |
| Restart mid-slide | Time is zero, state matches `resolve(slide, 0)` |

The hour-long jump case covers machine sleep, a blocked main thread, and a paused debugger
identically — none of them happened to the learner, so all three clamp the same way (R-03).

## Scenario 6 — A new type needs no kernel change (US4, SC-007)

```bash
pnpm exec vitest run registry
```

**Expected**: a synthetic element type and a synthetic effect register and participate exactly as
built-ins do. The test is written so that it would fail if the resolver had to know about them —
that is the actual claim, not merely that registration succeeds.

Then break it deliberately:

```bash
# add `switch (element.type)` to packages/core/src/resolve/element.ts
pnpm lint
```

**Expected**: rejected, naming the rule. Feature 001 taught us the cost of a boundary rule that
is stated but not enforced — the core/UI rule was green while enforcing nothing. **Revert
afterward.**

## Scenario 7 — Unknown types degrade by criticality (US4 #3–4, FR-027/028)

```bash
pnpm exec vitest run unknown-types
```

**Expected**: an unregistered decorative type leaves the rest of the slide resolvable and appears
as `available: false`; an unregistered *required interaction* type sets `blocked`. The asymmetry
is the requirement — losing a decoration and stranding a learner on an unanswerable question are
not comparable failures.

## Scenario 8 — Conflicting saves are refused (US5 #2, SC-008)

```bash
pnpm exec vitest run storage
```

**Expected**: a save carrying a stale token returns `{ ok: false, reason: 'conflict' }` with the
current token, and the stored manifest is unchanged. Verified against the in-memory reference,
which issues real incrementing tokens rather than accepting anything.

## Scenario 9 — The kernel is genuinely headless (SC-009)

```bash
pnpm check:isolation
pnpm exec vitest run headless
```

**Expected**: `@cuestack/core` installs alone into a bare directory and imports with no UI
framework present — the check that already existed in feature 001, now meaningful because there
is code behind it. The `headless` suite additionally asserts no reference to `window`,
`document`, `performance`, or `requestAnimationFrame` appears anywhere in the package's source.

## Scenario 10 — Resolution stays inside its budget (SC-001)

```bash
pnpm exec vitest run resolve-perf
```

**Expected**: a 300-element slide resolves in under 10 ms on the reference CI runner, leaving the
rest of NFR-PERF-003's 100 ms seek budget to whatever draws it. Also checked: cost grows roughly
linearly with element count, guarding against an accidentally quadratic composition step.

## Scenario 11 — Business rule traceability (SC-004)

```bash
ls packages/core/test/rules/
pnpm exec vitest run rules
```

**Expected**: one file per business rule with subject matter in this wave — **nine** of
eighteen: BR-002, 003, 004, 005, 006, 007, 010, 011, 013. The nine absent ones are listed in
plan.md Complexity Tracking, including BR-001, which is a storage rule already covered by
feature 001's schema tests rather than a gap here. A rule file that exists but asserts nothing would be worse than an absent one, because it
would make the traceability grep report compliance it has not verified.

## What this feature still does *not* demonstrate

Nothing renders. `resolve` returns data structures, and reading them in a terminal is the whole
experience. The first slide anyone can look at arrives in Wave 2, when the React adapter turns a
`RenderState` into DOM and Next.js serves it from the server.

If you want to see the shape of what Wave 2 will render, Scenario 1's output is it.
