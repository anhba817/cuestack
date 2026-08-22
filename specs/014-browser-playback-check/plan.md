# Implementation Plan: A frame rate nobody has ever seen

**Branch**: `014-browser-playback-check` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-browser-playback-check/spec.md`

## Summary

The performance gate has printed the same disclaimer since Wave 3: it measures the player's own work
and **not paint**, because happy-dom has no compositor, and *"a pass here is not that claim."* Nobody
has taken it up. There is no browser anywhere in this repository — no Playwright, no Puppeteer, no
WebDriver — so Constitution IV's row *"Playback: 60 fps target, 30 fps floor on the reference
device"* has never been accepted or rejected by anything.

**Four things are invisible for one reason.** Paint has no compositor to observe it; 9 uses of
container-query units are never evaluated; 13 CSS transitions have no style resolution over time;
and `domMediaPort.ts` — the real media adapter — reports **21.27% of statements and 0% of
branches**, with no test referencing it directly.

**The shape of the answer was decided by five clarifications**, and each one narrowed the work
rather than filling a blank:

- **Two references, never conflated.** Unthrottled on the CI runner playing the heavy fixture, for
  detecting regressions; throttled to ~4x playing the example app's tour lesson, for any claim about
  a teacher. Each carries the subject that fits its job, which costs no runs beyond the two.
- **Two statistics, one per constitutional number.** Median frame time against the 60 fps target;
  count of frames past the 30 fps floor against the floor. A mean would let a lesson that stalls
  once per slide pass while reading as broken.
- **One engine for timing, three for behaviour.** Three frame numbers would be three unrelated
  numbers; a media adapter checked only on Chromium is checked on the most permissive engine.
- **Report first, gate later.** Feature 013 has just finished removing a timing threshold whose
  variance nobody had measured. Frame timing is noisier than anything it removed.

**Two things make this harder than "add Playwright"**, and both are why it has a plan:

- **Where it runs is a decision, not a detail.** `pnpm gates` takes 10.2s today, and feature 013
  spent itself making that signal fast and readable. A browser check belongs beside it, not inside
  it.
- **The exemption and the evidence have to land together.** FR-009 removes `domMediaPort.ts` from
  the coverage report on the promise that FR-011 exercises it. Landing the exemption first would
  leave a module excused from coverage and exercised by nothing — worse than today.

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict, ESM-only; Node 24 in CI

**Primary Dependencies**: **Playwright, and nothing else.** It is the only mainstream runner driving
all three engines, and FR-011a requires WebKit, which Puppeteer does not provide. **No bundler is
added**: a browser cannot load either `dist` directly — both import bare specifiers — so the React
harness is the example app, which already bundles, and the element harness is a static page with a
five-entry import map, which is how a web component is meant to be consumed (research R-08)

**Storage**: none

**Testing**: Playwright for the browser check; Vitest 4.1.10 unchanged for everything else. The
browser check joins none of the three existing configs

**Target Platform**: two references, named and kept apart — the project's CI runner unthrottled, and
a several-year-old school laptop or mid-range Chromebook approximated by ~4x CPU throttling

**Project Type**: monorepo of libraries, plus tooling

**Performance Goals**: Constitution IV's 60 fps target and 30 fps floor. **No budget's value
changes.** If a throttled baseline cannot meet them, that is the finding

**Constraints**: must not join `pnpm test` (FR-006) and must not swell `pnpm gates`; no threshold
enforced before its variance is measured (FR-007); the coverage exemption is not satisfiable without
the browser evidence (FR-009)

**Scale/Scope**: one new runner, one new dependency, two harness pages, three engines for behaviour,
one for timing, one coverage exemption, one gate disclaimer corrected

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — result at the end of this section.*

| Principle | Assessment |
|---|---|
| **I. Code Quality & Modular Boundaries** | **Pass.** No package source changes. Playwright is a root devDependency and enters no package's dependency graph, so `check:isolation`, `check:element-isolation` and `check:packaging` are unaffected — worth confirming rather than assuming, since all three exist because a dependency once leaked. |
| **II. Test-First & Deterministic Verification** | **Pass, with the exemption already written down.** II forbids a test depending on wall-clock time, and this feature is nothing but wall-clock time. Feature 013's contract §6 drew the boundary: II governs *playback timing*, where a real clock produces a suite that gets muted; IV asks how long code actually takes, which a virtual clock cannot answer. This is IV's question. II's rationale is also why FR-012 reports before it gates. |
| **III. User Experience Consistency** | **Engaged, and positively.** III requires reduced-motion to be honored. `packages/element/src/styles.ts` has two `prefers-reduced-motion` blocks and nothing has ever evaluated them — happy-dom resolves no media queries over style. FR-011 puts a real engine under a requirement that has been asserted and never checked. |
| **IV. Performance as a Contract** | **The principle this feature exists for.** IV calls its budgets acceptance criteria rather than aspirations. One of them has never been either, because nothing could measure it. The feature does not change a budget's value; it produces the first evidence about one. |
| **Workflow — "every job here is blocking"** | **A stated invariant this feature has to amend, deliberately.** `.github/workflows/ci.yml` opens with it: *"No `continue-on-error` appears in this file and none should: a gate that tolerates failure is documentation, not a gate."* FR-012 requires precisely a job that reports without blocking, and its reason is equally sound — a threshold set before its variance is measured is the flake feature 013 removed. Both are right and they have not met. The resolution is an explicit exception written into that comment, naming FR-007 as the condition that retires it — **not a silent first `continue-on-error`**, which is how an invariant stops being one. |
| **V. Preview-Player Parity (NON-NEGOTIABLE)** | **Not engaged.** No renderer, timing engine or effect changes. Adjacent but out of scope: element-versus-React agreement is reported rather than gated, deliberately, and this feature does not revisit that. |

**What this feature could quietly give up.** Every convenient version of it weakens the result:

- measuring a mean frame rate, which passes a lesson that stalls once per slide;
- reporting the CI figure as a claim about learners, which is the misreading the two-reference
  decision exists to prevent;
- exempting `domMediaPort.ts` from coverage before anything exercises it, which trades a visible
  zero for an invisible one;
- folding the browser run into `pnpm gates`, which takes a 10.2s signal people read and makes it one
  they skip.

**Post-Phase-1 re-check: passes.** The design adds no violation and closes a gap in III as well as
IV. The item to watch through implementation is FR-009's ordering, above: the exemption and the
evidence are one change, and the half that is easy to land is the half that makes things worse.

## Requirement coverage

One row per functional requirement and the artifact that satisfies it. Kept because feature 011 lost
a MUST between its contract and its task list, and `plan-coverage.test.ts` checks this table
mechanically.

| Requirement | Satisfied by |
|---|---|
| FR-001 | `tools/browser/measure.mjs` drives one engine and collects `requestAnimationFrame` deltas; `tools/browser/statistics.mjs` computes the median and floor-breach count and is the only part the ordinary suite imports |
| FR-001a | Unchanged: `pnpm gates` keeps the 60 fps target via work-per-frame. The browser check owns the floor only — measurement showed median pacing cannot discriminate |
| FR-001b | `tools/browser/measure.mjs` counts DOM mutations alongside frames and refuses to report from a page that changed nothing |
| FR-002 | Every result carries its reference, engine, subject and throttling ([contract](./contracts/browser-measurement.md)) |
| FR-003 | The behaviour suite: media adapter, canvas-relative layout at two viewports, reduced motion |
| FR-004 | The report states measured values and an explicit "what this does not cover" section |
| FR-005 | A missing engine, a missing harness or a lesson that never starts fails loudly; research R-06 |
| FR-006 | A fourth runner, invoked by `pnpm check:browser` and its own CI job — not `pnpm test`, not `pnpm gates` |
| FR-007 | A variance run recorded in the quickstart before any threshold is written down |
| FR-008 | `tools/scripts/gates/perf.mjs` — the disclaimer states what is now covered and what still is not |
| FR-009 | `vitest.config.ts` — `domMediaPort.ts` joins the coverage exclusions, naming the browser check as its evidence, **in the same change that adds that evidence** |
| FR-010 | Two references, each with its subject: CI/unthrottled/heavy fixture, baseline/4x/tour lesson |
| FR-010a | The device class and its throttling multiplier are stated wherever a figure is reported |
| FR-011 | The behaviour suite covers the media adapter, `cqw` layout **on both adapters** — `packages/react/src/player/Stage.tsx` as well as `packages/element/src/styles.ts` — and reduced motion |
| FR-011a | The behaviour suite runs on Chromium, Firefox and WebKit; legitimate divergence is asserted, not smoothed |
| FR-012 | The CI job reports and does not block; arming a threshold is a later, deliberate act |
| FR-012a | `.github/workflows/ci.yml` — the "every job blocks" comment amended in writing, naming FR-007 as what retires the exception |

## Project Structure

### Documentation (this feature)

```text
specs/014-browser-playback-check/
├── spec.md
├── plan.md              # this file
├── research.md          # seven findings
├── data-model.md
├── contracts/
│   └── browser-measurement.md   # what a result must carry, and what it may not claim
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
tools/browser/
├── harness/element.html         # NEW — static page + import map; no bundler (research R-08)
├── serve.mjs                    # NEW — serves the element page and dist; resolves zod, never writes its path
├── statistics.mjs               # NEW — the median and floor-count arithmetic, and nothing else
├── measure.mjs                  # NEW — FR-001; drives the browser, imports statistics.mjs
├── behaviour.spec.ts            # NEW — FR-011/011a, three engines
└── report.mjs                   # NEW — FR-002/FR-004, one result shape
tools/scripts/__tests__/
└── browser-check.test.ts        # NEW — the statistics, and the fixture's freshness (see below)
examples/nextjs/app/perf/page.tsx         # NEW — the React harness; imports the lesson, hands it to a client half
examples/nextjs/app/heavy-lesson.json     # NEW — committed, 86KB, checked against its generator
package.json                     # CHANGED — `check:browser`, Playwright devDependency
.github/workflows/ci.yml         # CHANGED — one new job, and the blocking invariant amended
vitest.config.ts                 # CHANGED — domMediaPort.ts exemption (FR-009)
tools/scripts/gates/perf.mjs     # CHANGED — the disclaimer says what is still missing
README.md                        # CHANGED — where playback is measured, and against what
```

**On where the unit test lives, and what it may import.** `tools/scripts/__tests__/` and not
`tools/browser/__tests__/`, because the `gates` project collects only the former — a statistics test
in the latter would be written, reviewed, and never executed, which is this feature's own subject
applied to itself.

**One file, two subjects, and that is deliberate.** It holds the statistics assertions and the
assertion that `app/heavy-lesson.json` still equals `JSON.stringify(heavyLesson())`. Both are
unit-level facts about the browser check's inputs and arithmetic, and splitting them would add a
second test file — which changes the README's test-file count a second time, for nothing.

**And it imports `statistics.mjs`, never `measure.mjs`.** `measure.mjs` drives Playwright, so a test
importing it would pull a browser driver into `pnpm test` on every run — the suite feature 013 took
from 77s to 10s, and the one FR-006 says this feature must not join. The arithmetic lives in its own
module for that reason alone. The existing tooling tests set the precedent: they import pure helpers
like `check-doc-snippets.mjs` and nothing heavier.

**Structure Decision.** No package source changes. The browser check is tooling, and it is a fourth
runner beside the three feature 013 established — ordinary suite, budgets, gate controls. That is
the same principle applied once more: **one mechanism, one owner, one runner.**

**On the example app, and how often it is built.** `examples/*` is a pnpm workspace member with a
build script, so **`pnpm build` compiles the Next app** — seven packages build and that is one of
them. The perf route is therefore built by every contributor's `pnpm build`, by CI's first gate
before typecheck runs, and by this feature's own sweep — not only by Gate 12, which is how the
earlier drafts framed it. **A broken route breaks every build.** That is precisely why the fixture
is a static import with nothing to be absent (research R-09), and it is the reason T003 deserves
more care than its size suggests.

**On `pnpm gates`.** It runs a11y, parity, perf and theme in 10.2s, and that speed is why it gets
run. Launching three browser engines inside it would put minutes on a signal people currently read
before pushing. The browser check gets its own command and its own job, and `pnpm gates` gains only
a corrected sentence about what it does not measure.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A fourth test runner | A browser is a different execution substrate, and the three existing configs are all Vitest. Folding it into any of them inherits that config's job and its runtime | Adding it to `pnpm gates` takes a 10.2s signal to minutes; adding it to `pnpm test` is what FR-006 forbids on feature 013's evidence |
| The first browser dependency | FR-011a needs WebKit, and nothing but Playwright provides it alongside Chromium and Firefox in one API | Puppeteer covers Chromium and Firefox only, so the engine that most often differs on media policy would be the one not checked |
| Two harnesses, loaded differently | Each adapter is consumed differently and the harness should match: React through a bundler (the example app already is one), the element adapter through an import map (a web component exists to work without one). One harness cannot be both | A single bundled page for both would test the element adapter through a path no host uses, and would need a second build dependency; `vite` is not even resolvable at the workspace root today |
| A `continue-on-error` job in a file that forbids them | FR-012 reports before it gates, because a threshold set before its variance is known is the flake feature 013 removed | Gating immediately arms the noisiest measurement in the repository on no evidence. The invariant is amended in writing rather than quietly broken, and FR-007 names what retires the exception |

## Phases

**Phase 0 — Research.** Complete. Seven findings in [research.md](./research.md). The two that shape
the work: frame timing must come from `requestAnimationFrame` deltas rather than a Chromium-only
trace, because the same collection code has to be readable on all three engines even though only one
is measured; and CPU throttling is a CDP capability, so the throttled baseline is necessarily
Chromium — which is consistent with timing being single-engine and must be *stated*, not discovered.

**Phase 1 — Design.** Complete. [data-model.md](./data-model.md), one contract, and
[quickstart.md](./quickstart.md).

**Phase 2 — Tasks.** `/speckit-tasks`. Expected shape: the harness and the measurement first,
because everything else asserts against them; then the behaviour suite across three engines; then
the variance run, which is a prerequisite for writing any number down; and **FR-009's exemption last
and only alongside its evidence**, because that is the one step that makes things worse if it lands
alone.

**On ordering, and the one place it is not the usual argument.** The coverage exemption is a
one-line change with no dependencies, which makes it the easiest thing in the feature to do first.
Doing it first removes a visible zero and replaces it with nothing — the module stops being reported
and starts being unexamined. It is sequenced last for that reason alone.
