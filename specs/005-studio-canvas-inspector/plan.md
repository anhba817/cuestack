# Implementation Plan: Studio Canvas and Properties Inspector

**Branch**: `005-studio-canvas-inspector` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-studio-canvas-inspector/spec.md`

## Summary

The first surface a teacher touches: a slide they can add to, arrange, describe, and scrub through.
ED-1 and ED-2 of Wave 4.

The wave turns on four decisions, and the first is the one that keeps the rest cheap.

**The kernel does not change.** `resolve(slide, timeMs)` already returns exactly what the canvas
needs and nothing it does not. `ResolvedElement.geometry` is documented as *authored* position —
"effects do NOT mutate this" — with a comment from Wave 1 saying, in as many words, that the editor
needs the authored value while the player needs the effective one. Wave 1 cut this seam before
anything needed it. Transforms read and write authored geometry in the manifest; the canvas renders
`resolve(slide, authoringTime)` through the player's own renderer. No new resolver argument, no
editor flag, no second render path.

**Elements the resolver omits are drawn by the overlay, not by the renderer.** `RenderState.elements`
is "visible elements only" — hidden elements and elements outside their time window are absent by
design, and that design is BR-010. FR-011 and FR-031 still require both to be visible and selectable
while authoring. Rather than teach the resolver an editor mode, the canvas diffs the slide's element
list against the RenderState and the overlay draws a *ghost* — an outlined, selectable, labelled box
at the authored geometry — for every element the resolver left out. The ghost is an affordance, not
a render, which is precisely where FR-043 says it belongs. The player cannot grow a ghost because the
player has no overlay.

**Dragging is a pure function of logical deltas, with measurement quarantined at the input edge.**
This is not a stylistic preference. `getBoundingClientRect()` and `offsetWidth` both return **zero**
in happy-dom, verified against this repo's own test environment — so any drag logic that computes
geometry from a measured rect is not merely impure, it is *untestable here*. The transform engine
therefore takes logical-unit deltas and is tested directly with no DOM at all; a thin pointer adapter
reads the stage's scale once per gesture and converts. Keyboard nudges skip the adapter entirely,
because 1 logical unit is already a logical unit.

**The editor is its own package.** `@cuestack/studio`, depending on `@cuestack/react`, never depended
on by it. The gate that proves it is the one this repo already wrote for a different boundary:
`check-core-isolation.mjs` packs tarballs, installs them alone, and imports. The studio version packs
the player and its dependencies *without studio present on disk at all* and renders a lesson. A
player that works when the editor does not exist is a player that provably does not ship it.

**One thing this feature does not do that it might look like it does.** It does not arm the parity
gate. QA-5 has been inert since Wave 0 waiting for an editor to diverge from a player, and this
feature builds the editor — but the gate compares *preview* to playback, and preview is ED-6. What
this feature does is make the comparison possible for the first time. Marking gate 6 armed here
would be the third time in this project a placeholder gate was reported as enforcing something.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, unchanged from features 001–004.

**Primary Dependencies**: No new runtime dependencies. `@cuestack/studio` depends on
`@cuestack/react`, `@cuestack/core`, and `@cuestack/schema` — including `@cuestack/schema/validate`,
which is new for a consumer and deliberate: the editor validates after every edit (FR-045), and it
can afford Zod precisely because it is not the player. React 19.2.x stays a peer dependency.

**Storage**: N/A. The draft lives in memory for the session. `StorageAdapter` exists from Wave 1 and
is not wired here; persistence is ED-5.

**Testing**: Vitest 4.1.x, happy-dom 20.11.x, `@testing-library/react` 16.3.x, axe-core 4.13.x — all
present. **Two** new vitest projects for the studio package, not one: `@cuestack/studio` with a DOM,
mirroring the react project, and `@cuestack/studio-pure` in the `node` environment. **happy-dom
computes no layout** (measured: `getBoundingClientRect()` → all zeros), which shapes the testing
strategy rather than being worked around — and the second project makes that mechanical, since a
suite with no `document` available cannot quietly grow a dependency on a layout engine that reports
zeros.

The node project claims `test/geometry` and `test/draft` wholesale, **plus any file named
`*.pure.test.ts` anywhere under `test/`**. The filename marker exists because purity is a property of
a module, not of a directory: `session/` holds both a React hook that needs a DOM and the selection
algebra that must not, and a per-directory split would either separate two things that belong
together or quietly hand the pure module a `document`. Opting in by filename lets any module make the
claim and be held to it.

**Target Platform**: Browser only. The editor has no server entry and no `react-server` condition —
authoring is not server-rendered, and giving it an RSC path would invite a host to try.

**Project Type**: Library — a fourth published package plus the existing example app.

**Performance Goals**: Input to visual feedback ≤ 100 ms (NFR-PERF-002); authoring-time change to
rendered state ≤ 100 ms, the seek budget, because that is what it is (NFR-PERF-003); editor
interactive ≤ 3 s at 50 slides / 300 elements (NFR-PERF-001).

**Constraints**: The canvas renders through `@cuestack/react`'s renderer registry unmodified. No
schema change (FR-047). No editor code reachable from the player's payload (FR-049). Nothing measured
at render time.

**Scale/Scope**: The Constitution's fixture — 50 slides, 300 elements — is the ceiling, and
`tools/scripts/fixtures/heavy-lesson.mjs` already generates it.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Verdict | Notes |
|---|---|---|
| **I — Code Quality & Modular Boundaries** | Pass, with one contract observation | Registry-driven throughout: the editable-text surface comes from an editor registry, never a branch on type (FR-015). Dependency direction holds — studio is a new leaf, and the dependency-cruiser rules gain `no-studio-in-player`. See the observation below on FR-FWK-002. |
| **II — Test-First & Deterministic** | Pass | The transform engine, snap, align, and the draft reducer are pure and get tests before implementations. No clock is involved — an authoring time is an input, not a running clock. BR-010 and BR-011 get tests named for their rule IDs. Determinism is stronger than usual here: SC-016 replays an edit sequence and demands a byte-identical manifest, which the injected id source (FR-050) makes achievable. |
| **III — UX Consistency** | Pass | Keyboard operability is built per surface, not deferred (US4). Destructive action is confirmed (FR-033), which is the lower of the two bars the principle accepts and is recorded as temporary. Theme tokens only — the armed theme-values gate must be extended to scan `packages/studio`, or it would pass by not looking. |
| **IV — Performance as a Contract** | Pass | Three budgets, all with existing precedent for how to measure. The drag path avoids per-pointermove React reconciliation by reusing the FrameWriter pattern already in the repo. |
| **V — Preview-Player Parity** | Pass, and this is the feature's load-bearing constraint | One renderer (FR-042); affordances in an overlay (FR-043); manifest is truth (FR-044). Three declared deviations, all bounded, in Complexity Tracking. |

**Observation on FR-FWK-002.** The constitution requires a plugin to supply "data schema, editor
component, player renderer, inspector configuration, and validator" before merge. Core's
`ElementPlugin` carries three of the five (schema, inspector, validate); Wave 2 added the player
renderer as a separate adapter-side registry; the editor component has had nowhere to live. This
feature adds the fifth member, in the studio package, following the split Wave 2 established. Worth
saying plainly: the contract has been partially satisfied since Wave 1 and nothing said so.

Two things that completes and one it does not. All five members are now **supplied**, and four of
them are **consumed** — this feature gives `inspector` its first consumer after three waves as a
required member nobody called. `validate` is still in that position: declared, mandatory, and
unreached. PB-1 owes it a consumer, and the spec's Out of scope section now says so rather than
leaving the gap to be rediscovered. A contract whose members are all present but not all exercised
is the state this project has twice mistaken for completeness.

**Known gate limitation, recorded deliberately.** The theme-values gate delegates to ESLint, and its
rule is a `no-restricted-syntax` selector over style properties in TS and TSX. **ESLint does not
parse CSS**, so colour literals in stylesheets have never been gated — not in studio, and not in the
player either. This is a project-wide gap that predates this feature, not one it opens.

The convention holds today without enforcement: measured across `packages/react/src/styles/` and the
controls stylesheet, **all 46 colour literals already sit inside a `var(--cs-theme-*, …)` fallback**,
which is exactly what Constitution III requires. So the gap is currently theoretical, and a gate
enforcing the convention would go green on the first run.

Closing it is deliberately not this feature's job — it would retrofit a check onto the player's CSS
in a feature about the editor. T008 extends the existing gate to studio's TSX and says plainly what
it does not reach. Recorded here so the next feature that touches the gate inherits the measurement
rather than rediscovering it.

**Not armed by this feature.** Gate 5 (parity fixtures) stays a placeholder — see the Summary.
MVP acceptance scenario D (save recovery) still cannot be automated, because it needs persistence and
persistence is ED-5. The CI acceptance job's name stays "A, B, C, F".

## Project Structure

### Documentation (this feature)

```text
specs/005-studio-canvas-inspector/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── studio-package-api.md
│   ├── element-editor-contract.md
│   ├── edit-contract.md
│   └── overlay-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/studio/                     # new package: @cuestack/studio
├── package.json                     # no react-server condition; browser only
├── tsconfig.json
├── tsdown.config.ts
└── src/
    ├── index.ts                     # the single public entry
    ├── draft/
    │   ├── edit.ts                  # the Edit union — every mutation is one of these
    │   ├── reducer.ts               # applyEdit(draft, edit) -> draft, pure
    │   ├── ids.ts                   # IdSource, injectable (FR-050)
    │   └── guard.ts                 # post-edit validation (FR-045), read-only refusal (FR-051)
    ├── geometry/
    │   ├── constants.ts             # SNAP_THRESHOLD_UNITS, NUDGE_UNITS, NUDGE_UNITS_COARSE
    │   ├── transform.ts             # move / resize / rotate, logical units in and out
    │   ├── snap.ts                  # candidates and resolution
    │   └── align.ts                 # align, distribute
    ├── canvas/
    │   ├── EditorCanvas.tsx         # Stage + SlideView (from @cuestack/react) + Overlay
    │   ├── Overlay.tsx              # the editor-only layer, in full
    │   ├── Ghost.tsx                # out-of-window and hidden affordance (FR-011, FR-031)
    │   ├── TextEditSurface.tsx      # the overlaid editing surface (FR-015..FR-017)
    │   ├── DeleteConfirmation.tsx   # the only route to a delete edit (FR-033, FR-039)
    │   ├── Announcer.tsx            # live region for keyboard-driven change (FR-040)
    │   ├── shortcuts.ts             # copy/paste/duplicate/delete map (FR-036)
    │   └── pointer.ts               # the ONLY module that measures anything
    ├── inspector/
    │   ├── Inspector.tsx
    │   ├── fields/                  # one component per InspectorField kind
    │   ├── common.ts                # fields every element type has (FR-022)
    │   └── slide.ts                 # slide settings (FR-024)
    ├── registry/
    │   └── editors.ts               # ElementEditorRegistry — the fifth plugin member
    ├── session/
    │   ├── useEditorSession.ts      # draft + selection + authoring time + mode + clipboard
    │   └── selection.ts             # pure selection algebra: add, toggle, replace, clear
    └── styles/
        └── editor.css               # overlay chrome, theme tokens only

packages/studio/test/                # mirrors src/, plus cross-cutting suites —
                                     # rules/ parity/ keyboard/ a11y/ perf/ harness/ session/.
                                     # geometry/ and draft/ run in the node project, no DOM

tools/scripts/
├── check-studio-isolation.mjs       # new — FR-049's gate
└── gates/
    ├── theme-values.mjs             # extended to scan packages/studio
    └── perf.mjs                     # extended with the editor budgets

.dependency-cruiser.cjs              # + no-studio-in-player; studio added to existing rules
eslint.config.js                     # + the workspace ban on dangerouslySetInnerHTML (FR-046)
vitest.config.ts                     # + two studio projects: DOM, and node for the pure modules
.github/workflows/ci.yml             # + check:studio-isolation in the packaging job
```

**Structure Decision**: A fourth workspace package, `packages/studio`, rather than a subpath of
`@cuestack/react`. Three reasons, in order of weight: FR-049 asks for a machine-checked guarantee and
a package boundary is the only kind this repo can already prove (the isolation gate exists and works
by *absence*, which a subpath cannot demonstrate); the editor wants `@cuestack/schema/validate` and
therefore Zod, which the player must never carry; and the dependency-cruiser rules are written in
terms of packages, so the boundary becomes a graph rule rather than a convention. The cost is a
fourth package to version and publish, which is real and is why it is the structure decision rather
than an aside.

## Complexity Tracking

> Three declared deviations. Each is bounded, each has a simpler alternative that was tried on paper
> and rejected for a stated reason, and each has a test that fails if the bound is breached.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **The text-edit surface is a second DOM node displaying an element's text** (Constitution V, FR-017) | FR-CAN-005 and the Q2 answer require editing text in place. Something focusable and caret-bearing must sit where the text is. | *Make the text renderer contentEditable behind a prop.* Rejected: it puts an editor concern inside the one component Constitution V forbids forking, and ships editor code in the player package, breaking FR-049 in the same stroke. The surface instead reuses the **same stylesheet rule** (`.cs-element-text`) rather than the same component — this repo puts all typography in CSS and none in the component, so identical rendering comes for free. The bound: one styling authority, the surface exists only while editing, and a test asserts the committed text renders identically to what the surface showed. |
| **`canvas/pointer.ts` measures the rendered stage** (FR-009, and NX-2's "nothing measures anything") | A pointer event arrives in screen pixels. Converting to logical units needs the stage's scale, and there is no way to obtain it without reading the DOM. | *Derive scale from CSS custom properties alone.* Rejected: the properties give the logical canvas size, never the rendered size, which is the whole point of container query units. The bound is what matters — measurement happens **once per gesture, at the input edge, never at render time**, so the server-rendering and hydration properties NX-2 bought are untouched. A dependency-cruiser rule keeps the read confined to this one module, and every geometry test runs with no DOM to prove the engine never needed it. |
| **Draft state uses a plain reducer, not Zustand + Immer** | The framework plan lists "Zustand + Immer patches" as the settled default for editor state, with patches doubling as the undo journal. Q3 removed the journal from this feature's scope. | *Adopt Zustand now anyway.* Rejected: its stated justification is the patch stream, and there are no patches to keep. A pure `applyEdit(draft, edit) -> draft` adds no runtime dependency, is testable with no React at all, and makes SC-016's replay-determinism check a fold over a list. This does not foreclose ED-5 — a reducer is what a patch producer wraps. Recorded here because it contradicts a written default, and a silent contradiction is drift. |

## Phase Outputs

- **Phase 0** — [research.md](./research.md): eleven decisions, R-01 through R-11.
- **Phase 1** — [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).

**Post-design Constitution re-check: pass.** The design added no branch on element type, no second
render path, and no schema change. The three deviations above were all identified *during* design
rather than discovered afterwards, which is the outcome the gate is for. One thing the design changed
about the plan: research R-06 found that the inspector's field kinds cannot describe a question's
options list, so `InspectorField` gains a `list` kind in `@cuestack/core` — a contract extension, not
an inspector special-case, exactly as FR-019 requires.
