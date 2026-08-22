# Implementation Plan: A red board means something is broken

**Branch**: `013-trustworthy-test-signal` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-trustworthy-test-signal/spec.md`

## Summary

`pnpm test` fails at random. Three runs of the same commit gave two failures on different tests and
one pass, and CI fails too — its test job runs `pnpm test:coverage`, which collects the same files
under instrumentation and aborts before coverage is ever evaluated.

**The diagnosis is settled and measured, not assumed.** Nineteen isolated runs across all five
packages with performance suites: nineteen passes. No package has a regression. The failures are
contention — every performance budget is measured while a dozen other suites compete for the same
cores ([research R-01](./research.md)).

**Each budget is already measured twice**, and only one of the two runs is designed for it. The
workspace test projects glob `test/**`, which swallows `test/perf/**`; `gates/perf.mjs` then spawns
vitest again per package to run the same files on their own. The gate passes. The duplicate does
not. So the fix is to stop measuring performance in the room where it cannot be measured.

**The one-line diff does not work.** Excluding the performance files from the workspace projects is
the obvious fix and it breaks the mechanism this feature makes the sole owner: `gates/perf.mjs`
reaches those files through `vitest run --project <name>`, and `--project` selects a project whose
own include/exclude decides its file set. Exclude them and the gate collects nothing, exits 1, and
prints *"the editor exceeded an interaction, seek, or startup budget"* — for a file it never
opened. So there are two configs: `vitest.perf.config.ts` collects the performance files for the
gate, `vitest.config.ts` excludes them for everyone else ([research R-04](./research.md)). Both
entry points of the ordinary suite read the second, so `pnpm test:coverage` — the one CI fails on —
is covered without a separate change.

**Three more things make that less trivial than it sounds**, and they are the reason this has a plan
rather than a one-line diff:

- **`@cuestack/schema` is not in the gate.** It runs core, react, element and studio — and schema's
  scaling check is one of the two failing tests. Excluding it from the ordinary suite without adding
  it to the gate deletes a budget, leaves `pnpm gates` green, and looks like tidying up.
- **A budget that stops running must fail, not pass.** This repository has found three gates
  carrying package lists that reached nothing, and a public-surface check that ran one way for five
  waves. The change relies on a promise that another mechanism runs these files, and that promise
  needs a check of its own.
- **The inventory was wrong, and wrong in the way that matters.** Ten files carry these budgets,
  not nine — `packages/core/test/resolve/perf.test.ts` holds a 10ms budget and a growth ratio from
  outside any `perf` directory, so no pattern written for one reaches it. The count of nine was
  exactly what the two candidate patterns catch: an inventory derived from the pattern meant to
  move it cannot report what the pattern misses. Two further files assert durations from outside
  any `perf` path and are not performance tests by name at all
  ([research R-09](./research.md)).

## Technical Context

**Language/Version**: TypeScript 6.0.3, strict, ESM-only

**Primary Dependencies**: none new. The repository has a test runner, a gate script and a CI
workflow; the work is in how they are arranged

**Storage**: none

**Testing**: Vitest 4.1.10. Ten performance files across five packages, 2.6% of 388 test files;
two further files assert durations from outside any `perf` path

**Target Platform**: developer machines and the project's CI runner. Budgets are stated against the
runner, and a contributor's laptop is explicitly not authoritative — this feature should make that
clearer rather than change it

**Project Type**: monorepo of libraries

**Performance Goals**: unchanged. **No budget changes value.** Loosening one to stop it failing
would trade a noisy signal for no signal, which is what US2 exists to prevent

**Constraints**: no budget may stop being enforced; `pnpm test` must not get slower; the coverage
floor's *value* is out of scope, while the set of packages it is asserted over is a constitution
defect this feature surfaces and must not leave miscoped (FR-012)

**Scale/Scope**: ten files relocated into a second config, one package added to the gate, two
project globs expanded into explicit projects, one consistency check, two stale numbers corrected

## Constitution Check

*GATE: passed before Phase 0. Re-checked after Phase 1 — result at the end of this section.*

| Principle | Assessment |
|---|---|
| **I. Code Quality & Modular Boundaries** | **Pass.** No source changes. The work is in `vitest.config.ts`, `gates/perf.mjs`, a new consistency check, and the CI workflow. No package gains or loses a dependency. |
| **II. Test-First & Deterministic Verification** | **Pass, and this is the principle the feature serves.** Constitution II asks for deterministic verification, and the suite is not currently deterministic: the same commit gives different answers. The one thing to be careful of is that determinism must not be bought by deleting the assertions — which is why R-07's consistency check is part of the work rather than an extra. **One thing needs saying out loud**: II also forbids a test depending on wall-clock time, and every file this feature moves calls `performance.now()`. II governs *playback* timing, where a real clock makes a suite that gets muted; IV asks how long code actually takes, which a virtual clock cannot answer. They govern different questions and have never been written down as doing so — [the contract](./contracts/performance-ownership.md) §6 now does. II's rationale is also right about the consequence, and this feature is the evidence: a real clock is precisely what made these files flake, which is why they get a runner with nothing else on it. |
| **II, again — coverage floors** | **A live violation this feature is about to surface, in two dimensions rather than one.** II sets a 90% **line and branch** floor on `@cuestack/core` and `@cuestack/schema` and states that UI packages carry none, *"behavioral tests are required instead of coverage theater"*. `vitest.config.ts` sets one `thresholds` block — four metrics, no glob keys — so it applies all four to the aggregate of everything instrumented, `packages/react/src` and `packages/studio/src` included. **Both additions fail on something the constitution does not require.** Packages: core 94.52% branches, schema 91.41%, react 87.52%, studio 87.56% — the two with a floor clear it, the aggregate fails because of the two without one. Metrics: core reports `functions` at 88.69% while clearing line and branch at 96.96% and 94.52%. The config's own comments already claim the thresholds are "scoped to core and schema" and that the editor "carries no numeric floor" — neither is true as configured. FR-012 makes them true; FR-012a stops the fix turning into a coverage-scope expansion. |
| **III. User Experience Consistency** | **Not engaged.** Nothing a learner or teacher sees changes. |
| **IV. Performance as a Contract** | **Engaged, and the row that needs reading.** The principle makes budgets contractual, and the obvious reading of this feature — "stop running the performance tests" — would breach it. What actually happens is that each budget keeps exactly one enforcer, and gains a coverage that `@cuestack/schema` did not have. **The feature ends with more budgets enforced than it started with, not fewer**, and R-07's check is what keeps that true afterwards. |
| **V. Preview-Player Parity (NON-NEGOTIABLE)** | **Not engaged.** No renderer, timing engine or effect changes. |

**What this feature could quietly give up.** Every convenient version of it weakens the contract:

- excluding `test/perf/**` and calling it done — which drops `@cuestack/schema` entirely, since its
  file is `test/perf.test.ts` and matches no directory pattern;
- widening the thresholds until the noise fits underneath — the failures cluster at 91–97ms against
  90, so the margin required is large enough to hide a real regression;
- lowering the coverage floor to whatever is achieved, which converts a standard into a description.

None of these fails a test today. Two of them make `pnpm gates` greener than it should be.

**Post-Phase-1 re-check: passes.** The design adds no violation and closes one gap. The item to
watch through implementation is Principle IV, above: the difference between "one enforcer per
budget" and "one fewer budget" is invisible in a green board, and only R-07's check tells them
apart.

## Requirement coverage

One row per functional requirement and the artifact that satisfies it. Kept because feature 011
lost a MUST between its contract and its task list, and `plan-coverage.test.ts` now checks this
table mechanically.

| Requirement | Satisfied by |
|---|---|
| FR-001 | Ten consecutive full runs on an unchanged **built** tree, recorded in the quickstart. The build is load-bearing: a stale-output check is the one other recorded cause of an intermittent red board (research R-12) |
| FR-002 | `gates/perf.mjs`, unchanged in what it asserts; a deliberate slowdown must fail it |
| FR-003 | Two configs: `vitest.perf.config.ts` collects the ten files, `vitest.config.ts` excludes them. Exclusion alone would take them from the gate too — verified, [R-04](./research.md) |
| FR-003a | `gates/perf.mjs` gains `@cuestack/schema` **before** the exclusion lands |
| FR-004 | The gate spawns each package's suite on its own; the ordinary suite no longer times anything, once FR-011's two stragglers are settled |
| FR-005 | Satisfied by relocation — measured, not assumed: five isolated runs, five passes (research R-02) |
| FR-006 | The margins stay as they are; the noise they were failing against is removed instead |
| FR-007 | Each performance suite reports its measured value; the gate prints them |
| FR-008 | A consistency check over four lists: excluded from the ordinary config, collected by the performance config, named by the gate, and present on disk (research R-07) |
| FR-009 | Removing 10 of 388 files can only make the suite faster; asserted rather than assumed |
| FR-010 | The root README's test count **and its duration** — 189/`< 1 s` against 2900/78 s — plus a check that keeps them true or a row that stops stating them |
| FR-011 | `react/test/ssr/timing.test.ts` and `schema/test/pathological.test.ts` for the assert-a-duration shape, `element/test/api.test.ts`'s two `vi.waitFor` sites for the wait-with-a-deadline shape — each settled by measurement rather than by filename (research R-09) |
| FR-011a | A fifth assertion in `perf-ownership.test.ts`: no test outside the performance config pairs `performance.now()` with an upper-bound assertion. Narrow enough to be exact — it matches exactly the two files the sweep found (research R-09) |
| FR-012 | `vitest.config.ts` — the global `thresholds` block **replaced** by glob entries for `core` and `schema` carrying `lines` and `branches` only. Verified: a glob entry *alongside* the global block changes nothing (research R-10) |
| FR-012a | Nothing. The coverage `include` list is untouched; the measurement for the decision it defers is recorded in R-10 |

## Project Structure

### Documentation (this feature)

```text
specs/013-trustworthy-test-signal/
├── spec.md
├── plan.md              # this file
├── research.md          # eight findings; two settle the diagnosis
├── data-model.md
├── contracts/
│   └── performance-ownership.md   # which mechanism owns which budget, and what may not happen
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
vitest.perf.config.ts                # NEW — the ten performance files, and nothing else
vitest.config.ts                     # CHANGED — excludes them; two string globs become projects
tools/scripts/gates/perf.mjs         # CHANGED — reads the new config; schema joins; values printed
tools/scripts/__tests__/
├── perf-ownership.test.ts           # NEW — the four lists must agree (FR-008)
└── readme-claims.test.ts            # NEW — keeps the front page's numbers true (FR-010)
packages/*/test/perf*                # CHANGED — each suite reports what it measured
packages/react/test/ssr/timing.test.ts        # possibly CHANGED — FR-011
packages/schema/test/pathological.test.ts     # possibly CHANGED — FR-011
README.md                            # CHANGED — 189 tests in < 1 s, against 2900 in 78 s
.github/workflows/ci.yml             # possibly CHANGED — see the note below
```

**`package.json` is deliberately absent.** `pnpm test` and `pnpm test:coverage` both read
`vitest.config.ts`, so the exclusion reaches the CI job without either script changing. Only the
gate is pointed somewhere new.

**Structure Decision.** No source changes and no new dependency. The performance suites stay where
they are and keep their assertions; what changes is which runner collects them.

**On CI.** Its test job runs `pnpm test:coverage`. Once performance leaves the ordinary suite that
job stops failing on timing and starts reporting coverage again — which may itself be red. That is
the point of SC-008 and explicitly not this feature's to fix: the number becomes visible, and what
to do about it is a separate decision that could not be made while it was hidden.
**Implementation must not "fix" a newly-visible coverage failure by adjusting the threshold.**

**But two different things look like adjusting the threshold, and only one of them is forbidden.**
Four metrics are asserted over four packages; the constitution sets two metrics on two packages, and
those two clear both. So the newly-visible red is not a report about `core` and `schema` at all — it
is partly a 90% floor applied to `react` and `studio`, which II exempts by name, and partly a
`functions` floor on `core` that II never sets. Left alone, the only answers available are an
indefinitely red board or coverage-chasing against numbers nobody agreed to. FR-012 asserts the
floor the way the constitution states it: same threshold values, same coverage, no test written, a
smaller set of claims.

**Which is a correction in two dimensions and must not become three.** Core's instrumented scope is
a five-directory slice widened one feature at a time, and the file already says closing the rest is
somebody's deliberate decision rather than a side effect. FR-012a keeps it that way. The
measurement is recorded anyway, because it changes what that decision is about: **the whole package
reports 92.85% functions against the slice's 88.69%**, so core's only sub-90 number comes from where
the boundary was drawn, not from untested code.

**And the exclusion itself costs a little coverage**, because instrumented runs no longer include
the performance suites. Measured: `react` statements 88.24 → 88.07 and branches 87.76 → 87.52;
`core` and `schema` unchanged to two decimal places. Small, but it means part of any shortfall is
this feature's doing rather than a pre-existing condition it revealed, and the two should not be
reported as one thing.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A consistency check for a change that removes tests | The feature's whole risk is a budget silently ceasing to be measured, and every failure mode of it leaves the board green | Trusting the two lists to stay in step is what produced three gates with stale package lists in feature 011 |
| Changing what the performance suites print | FR-007, and R-05: the gate says "budget met" and never says at what. A pass at 89ms and a pass at 12ms read identically, and one of them is about to become a flake | Leaving the output alone keeps the condition that made this invisible for five waves |
| A second Vitest config | The gate reaches these files through `--project`, so a file excluded from a project is invisible to the gate as well. Verified against the tree, not reasoned about | Per-project exclusion was the first design and breaks the gate; negated project filters are silently ignored by Vitest 4.1.10; listing the non-performance projects in `pnpm test` swaps one convention-held list for another |

## Phases

**Phase 0 — Research.** Complete. Eight findings in [research.md](./research.md). The two that
matter most: the diagnosis is measured across all five packages (nineteen isolated runs, nineteen
passes), and `@cuestack/schema` is not in the gate — so the obvious implementation deletes a budget.

**Phase 1 — Design.** Complete. [data-model.md](./data-model.md), one contract, and
[quickstart.md](./quickstart.md).

**Phase 2 — Tasks.** `/speckit-tasks`. Expected shape: the performance config and the gate that
reads it come **first** — including `@cuestack/schema`, which is not in the gate today — then the
consistency check, then the exclusion. Each step makes the next safe. The reporting change, the
README correction and FR-011's two stragglers are independent of all three.

**On ordering, and why it is not the usual dependency argument.** Normally a test comes before the
thing it tests. Here the consistency check must come before the *exclusion* for a different reason:
it is the only thing that can tell a successful relocation from a silent deletion, and once the
files are excluded, both look the same.
