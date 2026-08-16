# Quickstart: Validating the Studio Canvas and Inspector

**Date**: 2026-08-16 · **Feature**: `005-studio-canvas-inspector`

How to prove this feature works.

**Every command below has now been run exactly as written (T115).** Sixteen commands and four
negative controls; the counts each scenario reports are real.

What the pass found: **one failure, and not in this document.** `pnpm lint` in §13 went red on an
unused variable in `test/perf/editor.test.tsx` — a defect the individual test commands could not
surface, because vitest does not lint. Fixed.

Worth recording that the class of error feature 004's equivalent pass found — three commands
matching no test files at all, one of them claiming to run an acceptance scenario it did not — did
**not** occur here. Every filter matches real suites. The difference is that these commands were
written against a layout that already existed in tasks.md and were then checked against it, rather
than written from memory.

## Prerequisites

Node 22.12+, pnpm 11, `pnpm install && pnpm build`. One new workspace package, `@cuestack/studio`, and
no new toolchain dependencies.

---

## 1 — The geometry engine, with no browser at all

```bash
pnpm exec vitest run --project @cuestack/studio-pure geometry
```

**Expected**: move, resize, rotate, snap, align, and distribute all pass with no DOM in the test
environment.

This is the point of research R-04 and the first thing to check. **happy-dom computes no layout** —
a `<div>` with `width: 800px` reports a bounding rect of zero — so if these tests need a browser, the
design has already gone wrong and every later drag test will be asserting against a mock of our own
authorship. The suite should run in the `node` environment and pass.

Two specific assertions worth naming:

- An edge 7 units from a candidate snaps; an edge 9 units away does not. `SNAP_THRESHOLD_UNITS` is 8.
- The same drag delta produces the same stored geometry regardless of any display size, because the
  engine is never told one (SC-009).

## 2 — The reducer refuses what it must

```bash
pnpm exec vitest run --project @cuestack/studio-pure draft
```

**Expected**: every variant of `Edit` has a success case and a refusal case; read-only refuses the
entire union; a locked element is skipped in a mixed selection but refuses a lone transform; and
unlocking a locked element succeeds.

That last one is the trap. The locked guard must not apply to a `set-flag` that unlocks, or a teacher
who locks an element can never get it back — see [contracts/edit-contract.md](./contracts/edit-contract.md).

## 3 — No edit can produce an invalid lesson

```bash
pnpm exec vitest run --project @cuestack/studio-pure draft/validity
```

**Expected**: a generated sequence of edits, with `validate()` asserted after each one, never produces
a manifest the player would refuse (SC-012, FR-045).

**Negative control**: temporarily remove the extent clamp in `geometry/transform.ts` and resize an
element below zero width. This suite must go red. A validity gate that cannot fail is the theme-gate
mistake from feature 003 repeated — green for three tasks while enforcing nothing.

## 4 — The same edits, twice, byte for byte

```bash
pnpm exec vitest run --project @cuestack/studio-pure draft/determinism
```

**Expected**: an edit sequence replayed against the same starting manifest with the same injected
`IdSource` produces byte-identical output (SC-016).

Then the experiment that proves the injection is load-bearing: swap the injected source for
`crypto.randomUUID()` and re-run. It must fail. If it passes, ids are not reaching the manifest from
where you think they are.

## 5 — §34 acceptance scenarios are unchanged

```bash
pnpm exec vitest run --project @cuestack/react test/acceptance
```

**Expected**: A, B, C, and F still pass, unchanged.

**Scenario D is still not automated, and this feature does not change that.** D is save recovery; it
needs persistence; persistence is ED-5. The CI job's name stays "Acceptance · MVP scenarios A, B, C, F".
Renaming it here would be the third time in this project a gate claimed more than it enforced.

## 6 — The canvas and the player agree

```bash
pnpm exec vitest run --project @cuestack/studio parity
```

**Expected**, for every one of the seven MVP element types and for several times within each slide:

| Check | Requirement |
|---|---|
| Element geometry, size, rotation identical in player and editing canvas | SC-003 |
| Full resolved state identical at the same authoring time | SC-004 |
| Paint order identical | FR-027, FR-028 |
| Elements' DOM inside `.cs-stage` identical with the overlay mounted and unmounted | FR-043 |
| No ghost markup in a player render | R-02 |

Note what SC-004 buys over SC-003. Comparing positions proves the editor can place an element;
comparing the *resolved state at time t* proves the scrub shows the lesson rather than an approximation
of it. The second is only checkable because the canvas renders at an authoring time (clarification Q1).

## 7 — Text edited on canvas renders identically once committed

```bash
pnpm exec vitest run --project @cuestack/studio canvas/text
```

**Expected**: the text-edit surface and the committed element resolve to the same computed typography
and the same box; committing changes no visible metric.

This is the bound on the one deliberate deviation from Constitution V (plan.md Complexity Tracking).
While editing, two DOM nodes carry the text. The claim is that there is one *styling* authority — the
`.cs-element-text` rule in `stage.css` — and this test is what keeps that claim true. If it ever fails,
the surface has grown its own typography and the deviation is no longer bounded.

## 8 — Text carrying markup stays text

```bash
pnpm exec vitest run --project @cuestack/studio canvas/sanitization
pnpm lint
```

**Expected**: text containing markup — entered through the canvas text surface and through the
inspector — renders as characters and never as elements, on the editor path and on the player path
(FR-046, NFR-SEC-007). `pnpm lint` additionally fails on any `dangerouslySetInnerHTML` anywhere under
`packages/`.

This is a lock rather than a sanitizer, and the distinction matters. research R-11 verified the prop
appears nowhere in the repository today and every renderer passes text as an escaped React child, so
the requirement already holds by construction. What this feature adds is a new *source* of
author-supplied strings, not a new rendering of them. The risk being guarded is the next renderer,
written under deadline, reaching for `innerHTML` to satisfy a formatting request — which a lint rule
fails at review and an unused sanitizer somewhere in the tree would not.

**Negative control**: add `dangerouslySetInnerHTML` to any component under `packages/studio/src/` and
re-run `pnpm lint`. It must fail.

The spec's framing sharpens this: server-rendered markup ships inside the HTML document, so it
executes before any client-side guard could run. There is no second chance on this path.

## 9 — The player does not ship the editor

```bash
pnpm build && pnpm check:studio-isolation
```

**Expected**: `@cuestack/react`, `@cuestack/core`, and `@cuestack/schema` are packed, installed into an
empty directory with `@cuestack/studio` nowhere on disk, and a lesson renders (FR-049, SC-015).

**Negative control**: add `@cuestack/studio` to `@cuestack/react`'s dependencies and re-run. It must
fail, and `pnpm lint:boundaries` must fail too on `no-studio-in-player`. Two independent mechanisms,
because this is the guarantee the clarification asked to have machine-checked rather than trusted.

## 10 — Keyboard, from end to end

```bash
pnpm exec vitest run --project @cuestack/studio keyboard
pnpm exec vitest run --project @cuestack/studio-pure selection-model
pnpm exec vitest run --project @cuestack/studio session/clipboard
```

**Expected**: every action in User Stories 1–3 is performable with no pointer events at all (SC-005) —
traverse, select, **select several and clear the selection**, nudge by 1 and by 10, resize, reorder,
lock, hide, duplicate, **copy and paste**, delete through the confirmation, enter and leave text-edit
mode, operate the authoring-time scrub, and reach every inspector field.

One case deserves its own test: typing `d` while editing text must insert `d`, not duplicate the
element (FR-016).

Two properties are checked by the second and third commands rather than by the keyboard suite.
Multi-selection is pure algebra and runs in the **node** project — a suite named `*.pure.test.ts` gets
no `document`, so a selection model that starts reaching for the DOM fails to run rather than quietly
becoming untestable. And the clipboard is where read-only splits: **copying is permitted in read-only,
pasting is refused** (FR-051). The reducer cannot assert that pair, because copy never reaches it.

## 11 — Accessibility

```bash
pnpm exec vitest run --project @cuestack/studio a11y
```

**Expected**: axe reports zero violations with a selection active, with a ghost present, with the text
surface open, and with the delete confirmation open (SC-006).

Automated checking is a floor, not a ceiling. Feature 004's sweep found a progress bar announcing a
position with no subject, and no automated check had flagged it. The manual pass below is where that
class of defect surfaces.

## 12 — Performance

```bash
pnpm exec vitest run --project @cuestack/studio perf
node tools/scripts/gates/perf.mjs
```

**Expected**, against the Constitution's 50-slide / 300-element fixture
(`tools/scripts/fixtures/heavy-lesson.mjs`, already present):

| Budget | Source |
|---|---|
| Input to visual feedback ≤ 100 ms | NFR-PERF-002, SC-001 |
| Authoring-time change to rendered state ≤ 100 ms | NFR-PERF-003, SC-018 |
| Editor interactive ≤ 3 s | NFR-PERF-001, SC-002 |

**Negative control**: insert a 200 ms synchronous delay into the drag commit path. The gate must go
red. As with the playback budgets in Wave 3, the gate must say out loud that it measures the editor's
own work and not paint — happy-dom has no compositor, and a green line here would otherwise be read as
a frame-rate claim.

## 13 — The whole suite, and the gates

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm gates && pnpm check:packaging
```

**Expected**: green. `pnpm gates` includes the theme-values gate, which must be **extended to scan
`packages/studio`** as part of this feature — an armed gate that does not look at the new package
passes for the wrong reason.

---

## The manual pass

Automated checks cannot answer these. One sitting, keyboard and screen reader, roughly fifteen minutes.

1. Tab into the canvas. Is it clear which element has focus, and does the announcement say *what* it
   is rather than only that something is selected?
2. Nudge an element with the arrow keys. Is the movement announced usefully, or does the screen reader
   say nothing while the element moves?
3. Select a ghost — an element outside its time window. Does the announcement say *why* it is not
   rendered, or only that it exists?
4. Enter text-edit mode with the keyboard, type, and leave. Does focus return somewhere predictable?
5. Delete an element. Does the confirmation take focus, state what will be removed, and return focus
   sensibly on both confirm and cancel?
6. Operate the authoring-time scrub by keyboard. Is its current value announced with a subject, or is
   it a bare number? This is the exact defect feature 004 found in the progress bar.
7. Tab through the inspector for each element type. Does the order match the visible order, and is
   every field labelled?
8. With `mode: 'read-only'`, attempt every action. Is it clear *why* nothing happens, or does the
   editor appear broken?
9. Zoom the browser to 200%. Do handles, guides, and chrome stay usable? Overlay chrome is sized in
   absolute units for this reason (overlay-contract.md, rule 5).

## Final task

Run every command in this document, as written, and fix what is wrong — in the document or in the
code. Feature 004's equivalent pass found three commands that matched no tests at all, including one
claiming to run an acceptance scenario that did not. That class of error surfaces only by running the
thing.
