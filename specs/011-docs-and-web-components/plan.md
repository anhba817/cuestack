# Implementation Plan: The Authoring Guide and the Second Adapter

**Branch**: `011-docs-and-web-components` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-docs-and-web-components/spec.md`

## Summary

Wave 5's last two items: a guide that takes a developer to a working element type, and a second
adapter that plays a lesson with no UI framework present.

**The most useful thing this plan can report, it can report already.** Phase 0 went looking for what a
non-React adapter would need and found that **ten modules in `@cuestack/react` do not import React**
— the frame writer, the visual property computation, the custom-property names, the theme tokens, the
browser ports, the scheduler, the asset resolver, the problem mapper, and two more. (Phase 0 said
eight; the number was measured again during implementation and was wrong in the direction that
matters — there is more framework-agnostic code in the framework adapter than the first count found.
Three further files have no React import and are re-export barrels, which do not count.) The kernel
survives the test: `resolve`, `createClock`, `createTransport`, `createAdvanceController`, and the
effects are genuinely framework-agnostic. What does not survive is the assumption that everything
DOM-shaped belongs to React.

That finding shapes the approach rather than being appended to it. The adapter writes its own small
DOM layer — about forty lines, bounded by the proof-scoped element set — and the extraction those
ten modules want is **recorded as a recommendation for its own feature**, because the spec's
Assumptions make a kernel change a finding to report rather than a licence to reshape. The duplication
also earns its keep: two independent DOM layers over one kernel is what makes the agreement suite
evidence about the kernel rather than a helper compared against itself.

The guide is written last, because writing it is the mechanism that finds what else is untrue.

**What this plan originally left out, and the correction.** FR-010 requires the adapter to cover
"slide playback, timing, effects, **transitions**, and the element types that need nothing from the
host." The first draft of this plan carried the element types and the effects and silently dropped
slide playback and transitions — the word *transition* appeared nowhere in it, nor in the task list
derived from it, nor in eight `/speckit-analyze` passes whose Coverage Gaps pass exists to find
requirements with no tasks. It was found by reading the spec's FR list back against the finished
adapter, one requirement at a time. The design below now carries both, and the plan carries a
[Requirement coverage](#requirement-coverage) table so the next omission is visible as a blank cell
rather than as an absence.

FR-017's server-rendering statement was missing for the same reason and is covered in the same
place.

**And the sharpest detail: Phase 1 had it right.** `contracts/element-adapter.md` lists "Slide
playback and timing" and "Effects and transitions" in its Covered column, and has since it was
written. The requirement survived the spec, survived the contract, and was lost between the contract
and the task list — which means the failure was not a misunderstanding of what to build but a
decomposition that nothing checked back against its own contract. The coverage table below is
therefore keyed to requirements rather than to tasks: a table of tasks would have looked complete.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict, ESM-only

**Primary Dependencies**: none new. `@cuestack/element` depends on `@cuestack/core` and
`@cuestack/schema` and on no UI framework — which is the claim, asserted structurally

**Storage**: none. This feature adds nothing a host stores: a guide is a file, an adapter instance is
a DOM node's private state, and an agreement report is discarded after it prints

**Testing**: Vitest 4.1.10 with happy-dom, in a project `@cuestack/element` **moves into** — it is
already registered in the node glob, where a stub with no tests needed no DOM. Checked rather than assumed —
happy-dom defines `customElements`, attaches open shadow roots, and provides `requestAnimationFrame`.
No DOM testing library: the platform's own API is sufficient and more honest for a package whose claim
is that it needs no framework

**Target Platform**: browsers. The premise is the platform's component model

**Project Type**: monorepo of libraries — `@cuestack/schema` ← `@cuestack/core` ← adapters

**Performance Goals**: the same frame budget the React player holds, on the covered subset. Nothing
here changes what the kernel computes per frame

**Constraints**: no UI framework in the adapter; no media, no interactions; per instance state only,
with the frame loop cancelled on disconnect; every code block in the guide extracted from checked
source.

**No server rendering — and importable on a server anyway**, which are two different claims and the
second was learned the hard way. A custom element is defined and upgraded by a browser, so there is
no markup to produce without one; FR-017 requires saying so where a host will read it. But `class
extends HTMLElement` is evaluated at *module load*, so a bare declaration makes `import
'@cuestack/element'` throw in any node process — every host doing SSR, in a module shared between
server and client, before a browser is involved. The base class is therefore resolved at load time
with an inert stand-in: the bundle graph builds, and the component does its work in the only place it
can

**Scale/Scope**: one custom element, one guide, one agreement reporter, and the documentation that
joins seven READMEs together

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — result at the end of this section.*

| Principle | Assessment |
|---|---|
| **I. Code Quality & Modular Boundaries** | **Pass.** The adapter is a registry consumer, not a `switch` — an unregistered type takes the unavailable path, which is the same mechanism the React player uses. A new package needs `.dependency-cruiser.cjs` told about it, and this one needs telling twice: nothing may depend on it, **and it must not depend on `@cuestack/react`**, which is the specific mistake R-01 makes tempting. No manifest change, so no `schemaVersion` bump. |
| **II. Test-First & Deterministic Verification** | **Pass.** The clock is injected as everywhere else, so no timing test waits. The guide's example is itself a test, which is unusual and is the point: FR-006's whole content is that documentation drift fails the build. |
| **III. User Experience Consistency** | **Pass, after adding two enforcement mechanisms that did not reach this package.** FR-015 holds the adapter to the same bar as the React player, and the **unavailable** path is the one to watch — the ordinary case here rather than the edge one, and it must read as an honest absence rather than as breakage. Two gates had to be widened for the principle to be enforced rather than merely stated: `theme-values.mjs` targets `packages/react/src/elements` and `packages/studio/src` only, and so does the ESLint no-hardcoded-theme rule — so "all visual styling MUST resolve from theme tokens" reached nothing this feature writes until T003a. The a11y gate has the same shape and the same gap (T021). |
| **IV. Performance as a Contract** | **Pass, and it now has a budget of its own — this row was wrong for a while.** It read "no budget is touched: the adapter computes what the React player computes", which was true when written and stopped being true when transitions arrived: a slide change deep-clones the outgoing stage, and nothing measured it. `packages/element/test/perf/` is now in `gate:perf`. **The measured margin is about ninefold** (≈1.6ms per frame on a 55-element slide against 15ms; a full clone costs ≈0.015ms), so the wall-clock half catches only a gross regression — forty extra clones per slide change do not trip it, tried as a control. What protects the frame is the invariant asserted beside it: structure is built once per element, never per frame. A rebuild-every-frame regression costs the same in a DOM with no layout and is caught by node identity. Its frame loop must still cancel on disconnect — not a budget, but the failure mode that makes a page slower the longer somebody uses it. |
| **V. Preview-Player Parity (NON-NEGOTIABLE)** | **Engaged, and not violated — but this is the row that needs reading.** The principle says one renderer, one timing engine, one implementation of each effect, "shared by editor preview and learner player". A second *adapter* is not a forked code path within that pair: preview and playback still share one renderer inside `@cuestack/react`, and this package shares the timing engine and the effects with it. What differs is only the layer that writes to a screen. **If that turns out not to be true — if the adapter needs its own resolve, its own clock, or its own advance rule — it is the most important finding this feature could produce, and the answer is to stop and report rather than to fork.** The stop condition did not fire, and it was tested rather than assumed: the adapter needed slide advance, took `createAdvanceController` from core, and wrote no rule of its own. *Advance was not in the original wording of this row* — it said "resolve or clock" — and a stop condition that does not name a rule cannot catch that rule being forked. |

**The security constraint this plan originally failed to name.** The constitution requires rich text
and plugin-supplied content to be sanitized against script injection. `@cuestack/react` satisfies it
structurally — children are escaped and `dangerouslySetInnerHTML` is banned — and **neither protection
survives the move to a custom element**: the lint rule's selectors are JSX-only, and a hand-written DOM
is exactly what reaches for `innerHTML`. FR-015a/b now require text-only rendering, enforced by a rule
and asserted by a test. Four analysis passes missed this because the constraint is not an FR in this
spec; it was found by reading what the existing rule bans (research R-11).

**And the second instance of the same thing.** Reduced motion is honoured in `@cuestack/react` by two
halves — the kernel's reduced alternative written under mirrored property names, and a CSS media block
choosing between them at paint time. The adapter's frame layer was scoped to exclude the mirrored set,
which would have left the media block nothing to select. FR-015c now requires both halves. Escaping
and reduced motion are the same discovery twice: **React satisfies constitutional requirements as
properties of how it works, not as rules anybody wrote down**, and a requirements-to-tasks check cannot
see one disappearing with the renderer that provided it (research R-11, R-12).

**A pre-existing Principle III gap, found while extending its enforcement — now measured and cheap
enough to close here.** `gate:theme-values` runs ESLint over `packages/react/src/elements` and
`packages/studio/src` and reports both clean; the colour selectors never reach studio, because that
package's own `no-restricted-syntax` block replaces the rule rather than merging it — the failure the
config's header warns about at line 15. Spreading them in, with a control violation firing, yields
**zero violations across `packages/studio/src`**: the editor code is clean and only the enforcement was
absent. T003a1 closes it in two lines.

**On how that gap was diagnosed**, since the first two attempts were wrong: widening the colour
rule's `files` glob had no effect, and a count of violations from that state would have been
meaningless. The cause is that the rule is *replaced, not merged*, by the narrower studio block — the
config's own header says so — so the fix is a spread, not a glob. Both wrong turns came from counting
output instead of reading it.

**Post-Phase-1 re-check: passes, with two mechanisms added.** The design added no violation, but analysis found that three separate gates carry explicit package lists — theme values, ESLint's theme rule, and a11y — none of which reached a package that did not exist when they were written. That is the second feature running to hit this (feature 010 hit it with dependency-cruiser), and it is worth recording as a repository observation rather than only fixing twice. The item that needed watching —
whether a second DOM layer is a second renderer — is argued above and in [research.md R-01](./research.md):
what is duplicated is style *application*, not resolution, timing, or any effect.

## Slide playback and transitions

Added to this plan after implementation, from reading FR-010 back against what was built. Both were
missing; neither failed a test, because **every fixture in the adapter's harness was a single slide**.
A fixture set that never crosses a boundary reports a player that cannot cross it as working.

**Advance is a kernel rule, and this is what FR-009 actually asks.** The obvious implementation is
`slideTimeMs >= slide.durationMs` — three lines, and wrong about `after_media_ends`,
`after_interaction`, the per-*instance* decision that lets a learner replay a slide, and the
reachability check. The adapter takes `createAdvanceController` from `@cuestack/core` instead, applies
its decision through `transport.goToSlide`, and holds on the last slide rather than running off the
end. `evaluate` is a query rather than a command by design, so the consumer applies it; here the
consumer is the element.

**No media port is passed to it, and that is the correct answer rather than a stub.** This adapter
renders no media, so the null port's honest report is that media never ends — which makes a slide
gated on `after_media_ends` unsatisfiable here and reported as such, instead of silently skipped.
`completedInteractions` is empty for the same reason and always will be.

**Transitions reuse the React player's DOM contract exactly**, not an equivalent one: `.cs-transition`
around the two halves, `data-cs-transition` naming each half's role, `data-cs-transition-type` naming
the effect, and the duration as `--cs-transition-ms`. A host with one stylesheet for both players is
the point; two adapters animating the same authored transition through differently-named hooks would
each need their own CSS. The animation is declarative for the reason `Stage.tsx` records — a
transition must not become a re-render per frame — which is also what keeps a slide change inside the
frame budget without touching Principle IV.

Three details are carried over from `LessonPlayerClient` rather than rediscovered:

- **The leaving half is a clone.** The live stage keeps its identity and its node map so the incoming
  slide draws into it as usual; the clone is frozen at the last frame of the slide that is going,
  which is exactly what it should show — nothing on it is still animating.
- **The transition ends on lesson time, not wall-clock.** A timer would outlive a seek and survive a
  paused tab, stranding two stages on screen.
- **`toIndex` is carried with the deadline**, because `untilMs` is on the incoming slide's clock and
  navigating elsewhere resets that clock to zero — leaving the comparison permanently unsatisfied and
  two slides on screen forever.

**Reduced motion is replaced, not shortened** (BR-015), matching the player: slide and zoom become a
fade, and fade is left alone because cross-fading is not movement.

**The structural check that should have caught the absence has been widened.** `one-kernel.test.ts`
asserted that the adapter imports `resolve` and `createTransport` and defines neither — both true of
an adapter that never advanced a slide at all, so a missing feature passed a claim about sharing the
kernel *truthfully*. It now names `createAdvanceController` and rejects the hand-rolled duration
comparison. A structural check only covers the rules it names.

## Requirement coverage

The mechanism whose absence let FR-010 and FR-017 through. One row per functional requirement, and
the artifact that satisfies it — a blank cell is visible in a way an omission is not.

| Requirement | Satisfied by |
|---|---|
| FR-001, FR-002, FR-002a, FR-002b, FR-003, FR-005 | `docs/authoring-elements.md` |
| FR-004 (effects) | `docs/authoring-elements.md` § *Effects, briefly* |
| FR-006, FR-006a | `tools/scripts/check-doc-snippets.mjs` + its suite; every block extracted |
| FR-006b (whole contract) | `packages/core/test/fixtures/guide-example/` — plugin, renderer, editor, schema variant |
| FR-007 | `packages/studio/src/registry/editors.ts` header; six claims listed in the framework plan |
| FR-008 | `packages/element/` — a suite that plays a lesson with no framework |
| FR-009 (same kernel) | `test/one-kernel.test.ts` — `resolve`, `createTransport`, `createAdvanceController` |
| **FR-010 — slide playback, timing, effects, transitions, element types** | `test/transitions.test.ts`, `test/plays.test.ts`, `test/reduced-motion.test.ts`, `src/covered.ts` |
| FR-010a, FR-017 | `packages/element/README.md` table; `package.json` description; the unavailable path itself |
| SC-004 (the reference lesson) | `test/reference-lesson.test.ts` — `examples/nextjs/app/tour.ts` played end to end |
| FR-011, FR-011a | `test/agreement.test.ts` — geometry, opacity, rotation, transform and filter, across a slide boundary, through live effects, and **as evaluated layout rather than CSS inputs**; `tools/scripts/check-agreement.mjs`; README § *reported, not enforced* |
| FR-012 | T039 — the suite passes with the package absent; no `package.json` outside it names it |
| FR-013 | `.dependency-cruiser.cjs` + `tools/scripts/check-element-isolation.mjs` |
| FR-014 | `src/unavailable.ts` — the React player's wording, not a second vocabulary |
| FR-015 | `test/a11y.test.ts` — axe at WCAG 2.2 AA over four lessons |
| FR-015a, FR-015b | `test/escaping.test.ts` + the `NO_RAW_HTML` rule over `packages/element/src` |
| FR-015c (reduced motion) | `test/reduced-motion.test.ts`; mirrored `--cs-r-*` set incl. filters; the transition media block |
| FR-016 | `test/instances.test.ts` |
| FR-018, FR-019, FR-020 | `docs/packages.md` |
| FR-021 | root `README.md`; `tools/scripts/__tests__/doc-links.test.ts` |

**FR-010's row is the one to read.** It was blank until after implementation, and nothing in the
process made that visible — which is the argument for the table existing.

**The table is checked, not trusted** — `tools/scripts/__tests__/plan-coverage.test.ts`. A
hand-maintained table of claims is exactly what this feature spent its time correcting elsewhere, and
one that rots reintroduces the problem it was added to solve. Adding an FR to a spec now fails that
test until the plan says where it is satisfied. It is opt-in per feature: only plans declaring a
`## Requirement coverage` section are checked, because a test that failed until nine shipped features
were retrofitted would be switched off rather than satisfied.

**It took three attempts to make that test fail when it should.** `table.includes('FR-010')` is
satisfied by a row mentioning only `FR-010a`; matching on a boundary instead still passed, because
the paragraph you are reading says "FR-010's row is the one to read" and the search covered the whole
section. It now reads table rows alone — commentary about a requirement is not a claim that it is
satisfied. Each failure was found by running the negative control rather than by inspecting the
test, which is the same lesson T042 exists to teach and the second time this feature has learned it.

## Project Structure

### Documentation (this feature)

```text
specs/011-docs-and-web-components/
├── plan.md                        # This file
├── research.md                    # Phase 0 — ten decisions, one headline finding
├── data-model.md                  # Phase 1 — the contribution, the element, the report
├── quickstart.md                  # Phase 1 — how to prove it works
├── contracts/
│   ├── element-adapter.md         # `<cuestack-lesson>`, and what it will not do
│   └── authoring-guide.md         # What the guide promises, and what it does not cover
├── checklists/requirements.md     # 16/16
└── tasks.md                       # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
packages/element/                  # THE STUB FILLED — @cuestack/element
├── package.json                   # CHANGED — description stops saying "arrives in a later wave"
├── README.md                      # NEW — what it is, and the four things it does not do
├── src/
│   ├── index.ts                   # CHANGED — the element, replacing ELEMENT_WAVE
│   ├── LessonElement.ts           # NEW — the element, its lifecycle, slide advance, transitions
│   ├── covered.ts                 # NEW — the covered set, read by the renderer and the gate check
│   ├── frame.ts                   # NEW — ~40 lines: RenderState -> style, applied to a node
│   ├── renderers.ts               # NEW — text and shape; image given a resolver
│   ├── unavailable.ts             # NEW — the ordinary path, not the edge one
│   └── styles.ts                  # NEW — the stylesheet, inside the shadow root
└── test/                          # every suite in happy-dom, no framework
    ├── transitions.test.ts        # NEW — slide advance and transitions (FR-010)
    ├── one-kernel.test.ts         # NEW — structural: no second resolve, clock, or advance rule
    ├── agreement.test.ts          # NEW — both adapters, matched instants, across a slide boundary
    ├── a11y.test.ts               # NEW — axe over four lessons
    ├── tokens.test.ts             # NEW — the emitted stylesheet, read as a string
    └── harness/lessons.ts         # NEW — fixtures, including the two-slide ones FR-010 needs

docs/
├── authoring-elements.md          # NEW — the guide (DX-1)
└── packages.md                    # NEW — what each package is and which you need

packages/core/test/fixtures/
└── guide-example/                 # NEW — the guide's element type, registered and exercised

tools/scripts/
├── check-doc-snippets.mjs         # NEW — every fenced block matches its source
├── check-agreement.mjs            # NEW — spawns the suite, prints, exits zero (FR-011)
├── check-element-isolation.mjs    # NEW — packs and imports it with no framework and no DOM
├── __tests__/doc-snippets.test.ts # NEW — .ts: the gates project collects no .mjs
├── __tests__/doc-links.test.ts    # NEW
├── gates/a11y.mjs                 # CHANGED — its package list gains @cuestack/element
└── gates/theme-values.mjs         # CHANGED — its targets gain packages/element/src

packages/studio/src/registry/editors.ts   # CHANGED — a header feature 009 falsified
README.md                                  # CHANGED — points at the new documentation
.github/workflows/ci.yml                   # CHANGED — element isolation gates; agreement reports
vitest.config.ts                           # CHANGED — @cuestack/element MOVES to a DOM project
tools/eslint-config/index.js               # CHANGED — the theme rule reaches packages/element/src
.dependency-cruiser.cjs                    # CHANGED — two rules, see the Constitution Check
```

**Structure Decision.** `@cuestack/element` is filled rather than created — it has been in the
workspace since Wave 0 with a comment saying this wave fills it. Its DOM layer is its own rather than
shared, for the reason [research.md R-01](./research.md) sets out at length: the alternative routes
are depending on the React package (absurd, and structurally detectable), moving ten modules into
core (right, and a change to two shipped surfaces that belongs in its own feature), or a sixth package
decided in passing inside a feature about documentation.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A second DOM-writing layer, ~40 lines | The ten React-free modules a second adapter needs live in `@cuestack/react`, and reaching them means depending on the React adapter | Depending on `@cuestack/react` fails FR-013 structurally; moving them to core changes two shipped packages' surfaces inside a feature whose spec forbids exactly that. Duplicating a bounded subset also makes the agreement suite evidence rather than a tautology |
| A package that does not play four of seven element types | FR-010: the item proves framework-agnosticism, and a second media pipeline is the most expensive possible way to learn whether `resolve` is React-shaped. Note what is **not** in this row: slide playback and transitions are *required* by the same FR and are implemented, not traded away | Full parity roughly doubles the feature and lands its hardest code in the adapter least likely to be used |
| Agreement reported, not gated | FR-011: two adapters are two renderers by design over one kernel; divergence is a finding rather than a bug | Gating makes every future change to the primary adapter cost twice. The decision is explicitly conditional on the covered surface staying small |
| A guide whose examples are tests | FR-006: prose has already failed here — `ElementEditor`'s header has described a framework that stopped existing two features ago | Review catches drift only when somebody happens to look at both files in one sitting, which is what did not happen |

## Phases

**Phase 0 — Research.** Complete. Ten decisions in [research.md](./research.md), including the
headline finding that reshaped the approach and the per-type reasoning behind the covered set. The
per-type reasoning is worth re-reading in light of the omission above: it settled which *element
types* the adapter draws and was silently taken as settling the whole of FR-010, which also names
slide playback and transitions. A decision about one clause of a requirement can read like a decision
about the requirement.

**Phase 1 — Design.** Complete. [data-model.md](./data-model.md), two contracts, and
[quickstart.md](./quickstart.md).

**Phase 2 — Tasks.** Complete, then repeatedly reopened. Eight analysis passes before
implementation; a further four afterwards, each of which found something the previous twelve had
not. Tasks were added after the fact in four rounds — T044–T046 for requirements this plan had
dropped, then T047–T049, T054–T060, and T061–T066 as later audits found more.

**The pass count is kept because it is part of an argument** — see Phase 4 below on where analysis
yield comes from. Task and test counts are deliberately *not* recorded here: they were, they went
stale within the same session, and they are one command away for anyone who wants them.

**Phase 3 — Implementation.** Complete. Every gate and check green. `pnpm test:coverage` remains red
at 89.03% branches against a 90% floor — pre-existing, unchanged by this feature, recorded in the
framework plan. That one number stays because it is a *threshold*, not a measurement: it means
something specific when it moves.

**Phase 4 — Reading things back against reality.** Not a phase anybody planned, and where every
later finding came from.

Eight analysis passes over spec, plan, and tasks missed a MUST with zero tasks, because each asked
*what is wrong with what was written* — and this was a requirement absent from everything downstream
of the spec, so there was nothing wrong-looking to find. What found it was enumerating the spec's own
FR list and asking, one at a time, where each is satisfied.

Four further passes each asked a question the previous ones had not, and each found something:
the contract clause by clause against the source; the success criteria against the suites; the
layout rules against the player's; and the documents against the code they describe. **Yield tracked
distinct questions, not passes** — which is why the count above is kept and the others are not.

The lesson generalises twice over: analysis over the artifacts is no substitute for checking the
artifacts against reality, and it has to run in *both* directions — a document ahead of the code
looks identical to one behind it until somebody compares them.

Outstanding: T043, the outside-reader pass on both documents, which needs a person.
