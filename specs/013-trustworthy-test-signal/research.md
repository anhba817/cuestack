# Research: A red board means something is broken

Thirteen findings. Two settle the diagnosis, three shape the fix, and six are traps the obvious
implementation walks into — four of which it walks into silently. Three were found by measuring what
the others had only asserted, and the last one by reading what the project had already written down
about itself.

---

## R-01: It is contention in every package, and now measured rather than assumed

**Decision.** Treat the failures as shared-resource interference. No package has a real regression.

The spec required this be confirmed per package rather than inferred from two examples. Every
performance suite was run on its own, repeatedly:

| Package | Isolated runs | Result |
|---|---|---|
| `@cuestack/studio` | 5 | 5 pass |
| `@cuestack/schema` | 5 | 5 pass |
| `@cuestack/core` | 3 | 3 pass |
| `@cuestack/react` | 3 | 3 pass |
| `@cuestack/element` | 3 | 3 pass |

Nineteen isolated runs, nineteen passes. Against that, three full-suite runs of the same commit
gave two failures on **different** tests. A regression does not move between files and does not
disappear when the machine is quieter.

**Why it mattered to check.** The spec named this an assumption and said a real slowdown would be
the more important finding. It would also have changed the feature entirely: relocating a
measurement does not fix code that got slower.

---

## R-02: The two failure shapes have one cause

**Decision.** One fix addresses both.

They look different — a wall-clock threshold (`93.3ms` against `90`) and a scaling ratio (`7.93`
against `6`) — and the second looked the more suspicious, since it divides by a measurement floored
at `0.1ms`.

**That suspicion was wrong, and it was worth measuring rather than repairing.** Eight isolated
samples:

```text
small=0.485–3.027ms   large=0.887–4.825ms   ratio 1.48–2.06   limit 6
the 500ms validation budget: 0.524ms
```

The denominator never reaches `0.1ms`, so the floor is inert and rewriting it would have fixed
nothing. Both timings are under 5ms and taken back to back, so a single preemption in either one
swings the ratio — the same cause as the wall-clock failures, in a different shape. The ratio has
roughly threefold headroom and the 500ms budget has three orders of magnitude, which is what makes
relocation sufficient here rather than merely plausible.

It is not fragile in isolation: five runs, five passes. Both shapes are noisy for the same reason
— the measurement is taken while a dozen other suites compete for the same cores — and both are
stable when they are not. The ratio needs no rewrite, only a quieter room.

**Recorded because a plausible wrong turn was available**: reshaping the scaling check is real work,
and it would have "fixed" a test that was never broken.

---

## R-03: The gate does not cover `@cuestack/schema`

**Decision.** Add it to `gates/perf.mjs` **before** anything leaves the ordinary suite.

`gates/perf.mjs` spawns four packages: core, react, element, studio. `packages/schema/test/perf.test.ts`
is not among them — and it is one of the two files that failed.

So the obvious implementation of "move performance into the gate" deletes a budget. It would look
exactly like a tidy-up, `pnpm gates` would stay green, and nothing would ever measure schema's
validation scaling again. FR-003a exists for this, and it is the reason ordering matters: cover
first, exclude second.

---

## R-04: Exclusion alone breaks the gate, so the gate needs its own config

**Decision.** Two configs. `vitest.perf.config.ts` collects the performance files and nothing else;
`vitest.config.ts` excludes them. `gates/perf.mjs` runs the first, `pnpm test` and
`pnpm test:coverage` run the second.

**This is not the first design.** The obvious one — exclude `test/perf/**` per project, the way
`@cuestack/studio` already excludes `test/geometry/**` — was tried against the tree and does not
work. `perf.mjs` reaches the files through `vitest run --project <name> <filter>`. `--project`
selects a project; the project's own include/exclude decides the file set. Exclude the files there
and the gate cannot see them either:

```text
$ vitest run -c <probe> --project @cuestack/studio test/perf
No test files found, exiting with code 1
exclude:  test/geometry/**, test/draft/**, **/*.pure.test.{ts,tsx}, test/perf/**
```

`perf.mjs` catches that non-zero exit and prints **"gate:perf — FAILED. The editor exceeded an
interaction, seek, or startup budget."** The one-line change lands, the gate goes red, and it
blames a budget for a file it never collected.

**And the precedent argues the other way.** `@cuestack/studio` excluding `test/geometry/**` is a
*split*, not a removal: `@cuestack/studio-pure` includes those same files and runs them in a
different environment. Nothing anywhere would claim the performance files. The one existing use of
per-project exclusion in this repository is the case where exclusion removes nothing — which is
exactly why it is safe there and is not here.

**Two other routes were tested and rejected.** Negated project filters
(`--project '!@cuestack/studio'`) are silently ignored by Vitest 4.1.10 — the full 388 files still
ran. Listing the non-performance projects positively in `pnpm test` works, but replaces one
convention-held list with another and adds a drift surface rather than removing one.

**The two-config shape was verified**, in both file shapes the repository has:

```text
$ vitest run -c vitest.perf.config.ts --project @cuestack/schema   # test/perf.test.ts — a file
  Test Files  1 passed (1)   Tests  2 passed (2)
$ vitest run -c vitest.perf.config.ts --project @cuestack/studio   # test/perf/** — a directory
  Test Files  4 passed (4)   Tests  19 passed (19)
```

It also removes the filter arguments from the gate entirely: each project in the performance config
already includes only performance files, so `--project <name>` is the whole invocation.

### What has to move, and where it lives now

**Ten files, not nine.** The count of nine is exactly what the two patterns `test/perf/**` and
`test/perf.test.ts` catch, and it misses one:

| Project | Performance files | Environment | Where the exclusion goes |
|---|---|---|---|
| `@cuestack/core` | `test/perf/packaging.test.ts`, `test/perf/validation.test.ts`, **`test/resolve/perf.test.ts`** | node | **no project object exists** |
| `@cuestack/schema` | `test/perf.test.ts` | node | **no project object exists** |
| `@cuestack/element` | `test/perf/frame.test.ts` | happy-dom | add `exclude` |
| `@cuestack/react` | `test/perf/playback.test.ts` | happy-dom | add `exclude` |
| `@cuestack/studio` | `test/perf/{editor,history,preview,timeline}.test.tsx` | happy-dom | existing `exclude` list |
| `@cuestack/studio-pure`, `gates` | none | — | — |

**`packages/core/test/resolve/perf.test.ts` is the missed one.** It carries `performance.now()`, a
10ms budget, a linear-growth ratio (`cost < smallest * 3`) and a 50ms median — every property that
makes a file flake under contention — and it sits under `test/resolve/`, so it matches neither
pattern. The gate happens to run it, because core's filter is the bare substring `perf`. Left as
it was, it would be the one file still measured in both places: the flake retained, in the package
the resolution budget belongs to.

**Neither `@cuestack/schema` nor `@cuestack/core` has anywhere to put an `exclude` today.** Both
come from the string glob `packages/{schema,core,adapter-http}`, which Vitest resolves with its
default include and no config object of its own:

```text
|@cuestack/core|
include: **/*.{test,spec}.?(c|m)[jt]s?(x)
exclude:  **/node_modules/**, **/.git/**
```

There are no per-package vitest configs in the repository. So the two packages that matter most
here — the one that is missing from the gate and the one that is missing from the inventory — both
require that glob entry to be expanded into explicit project objects first. That is a structural
change, not a pattern edit.

---

## R-05: The gate reports prose, not numbers

**Decision.** FR-007 needs a change to what the tests emit, not only to where they run.

`gates/perf.mjs` prints sentences: *"playback budgets met on the 50-slide/300-element fixture"*,
*"per-frame player work < 16.7ms"*. It states the budget and whether it was met. It does not state
what was measured.

That is why nobody noticed these budgets were being met at 91–97ms against 90 until they started
failing. A pass at 89ms and a pass at 12ms read identically, and only one of them is about to
become a flake. The measured value has to reach the output.

---

## R-06: CI fails here, and coverage is never reached

**Decision.** Scope includes making the coverage figure visible again; it excludes moving it.

CI's test job runs `pnpm test:coverage`, which collects the same files under coverage
instrumentation — more overhead against the same thresholds. Run locally it exits non-zero on the
perf flake, and because it fails at the test stage **coverage is never evaluated at all**.

So the widely-quoted 89.03% branches against a 90% floor was measured in a local run that happened
to pass, not reported by the gate meant to report it. Nobody currently knows the project's coverage
standing from CI.

**This is why the clarification put the floor out of scope**: what to do about a number is a
judgement, and the number cannot be seen.

---

## R-07: What must not become possible

**Decision.** A budget that stops running must fail, not pass.

The change removes files from the default suite on the promise that another mechanism runs them.
That promise is exactly the kind this repository has watched decay: feature 011 found three gates
carrying package lists that reached nothing, and a public-surface check that ran in one direction
for five waves.

The same shape is available here in three ways — a package added to the workspace with a `test/perf`
directory nobody adds to the gate; a performance file renamed out of the excluded pattern and
quietly running in both places again; and a performance file dropped from the performance config
while staying excluded from the ordinary one. Each leaves everything green.

**One drift on the first list turned out not to exist.** "A gate entry whose filter matches nothing
passes trivially" was assumed and is false: Vitest exits 1 on *No test files found*, and
`perf.mjs` passes no `--passWithNoTests`, so the gate goes red. Verified:

```text
$ vitest run --project @cuestack/core zzz-no-such-file
No test files found, exiting with code 1     # exit 1
```

What is true is worse for SC-004 than for FR-008: the gate reports that collection failure as
*"Resolution exceeded its budget or stopped scaling linearly"*. It fails loudly and names the wrong
cause. (The flag that would make it pass silently, `--passWithNoTests`, is on `pnpm test` — not on
the gate.)

So the feature needs a check that the two lists agree: every performance file excluded from the
ordinary suite is collected by the performance config, every package the gate names actually has
files to run, and no performance file on disk is missing from both.

---

## R-08: Scale, and what the change costs

**Decision.** Ten files of 388 — 2.6% of the suite.

The change is small in surface and the risk is concentrated in R-03 and R-07 rather than in the
mechanics. Removing files can only make `pnpm test` faster, so FR-009 is satisfied by construction;
the interesting number is not the saving but whether anything stops being measured.

---

## R-09: Two files assert a duration and are not called performance tests

**Decision.** Settle each by measurement rather than by its filename. A budget moves; a guard stays,
with its reason written down.

The exclusion is defined by path, so it catches files that live in a `perf` directory or are named
for one. Two files assert wall-clock durations and are neither:

| File | What it asserts | Reading |
|---|---|---|
| `packages/react/test/ssr/timing.test.ts` | `elapsed < BUDGET_MS` (2000ms), **`elapsed < BUDGET_MS / 100`** (20ms), and `full < max(empty * 50, 20)` | the 20ms line is a budget wearing a guard's clothes |
| `packages/schema/test/pathological.test.ts` | `withinBudget(fn, ms = 2000)`, one call at 10\_000ms | a termination guard: it catches an infinite loop, not a slowdown |

The distinction that matters is not where a file lives but what its number is for. **A budget** is a
stated contract, tight enough that ordinary variation reaches it — it has to be measured alone.
**A guard** is a generous ceiling that catches catastrophe, three orders of magnitude away from
anything contention can do — it is fine where it is, and moving it to the gate would slow the gate
down to assert something that cannot fail there either.

`pathological.test.ts` at 2000ms and 10\_000ms is a guard by that test. The 20ms assertion in
`ssr/timing.test.ts` is not obviously either, and both readings are defensible from the source, so
it is settled the way R-01 and R-02 were settled: run it under contention and see. It survives, it
is a guard and the reason gets written next to it; it does not, it is a budget and it moves.

**A third shape, and it is not a duration at all.** `packages/element/test/api.test.ts` calls
`vi.waitFor` twice, whose default deadline is 1000 ms. It asserts no duration, so a rule written
about duration assertions misses it — and it fails under contention for exactly the same reason,
because a deadline is a duration somebody else wrote down. FR-011 covers both shapes.

**Why this is in scope at all.** SC-001 asks for ten identical runs of the whole suite. A file that
still times something under contention can fail that criterion no matter how cleanly the ten
performance files were relocated — and it would then be diagnosed, correctly but expensively, as
this feature not having worked.

### The rule needs a check, and the repository already shows the shape

**`packages/core/test/harness/duration.test.ts` enforces a neighbouring rule this way.** It walks
`packages/core/test/**` and fails if any test file references `setTimeout`, `setInterval`,
`vi.advanceTimersByTime` or `await new Promise` — Constitution II in executable form. Two things
about it matter here:

- **It covers one package of six**, under an assertion named *"no test file references a real
  delay"*. The name reads project-wide; the walk starts at core's test directory.
- **Widening it is the wrong move.** Sixteen files outside core trip that regex, and most are
  legitimate async-React flushes rather than real sleeps. The regex encodes something true of
  core's synthetic-clock harness and false generally — a check widened into producing fifteen false
  positives is a check somebody turns off.

**So FR-011a gets its own check, narrow enough to be exact.** The rule is *a test outside the
performance config that pairs `performance.now()` with an upper-bound assertion*. Applied to the
tree today it matches exactly two files — the two the manual sweep found — which is the property
worth having: it reproduces the sweep rather than approximating it, so it can be trusted to catch
the third.

**And it belongs in `perf-ownership.test.ts`** rather than in a new file. That check already answers
"where is timing allowed to live"; this is the same question asked of the files nobody thought to
name.

---

## R-10: The coverage floor is asserted over four packages and set for two

**Decision.** Scope the thresholds to `@cuestack/core` and `@cuestack/schema`, which is what the
configuration's own comments already claim and what Constitution II requires. No threshold's value
changes.

`vitest.config.ts` carries one `thresholds` block — `lines`, `branches`, `functions`, `statements`
at 90 — with no glob keys and no `perFile`. Vitest applies that to the **aggregate** of everything
in `coverage.include`, and that list has grown one package per feature: schema's validate/migrate,
core's resolve/effects/time/advance/packaging, then `packages/react/src/**`, then
`packages/studio/src/**`.

Constitution II sets the floor for two packages and says of the others: *"UI packages carry no
numeric floor — behavioral tests are required instead of coverage theater."*

Measured per package:

| Package | Statements | Branches | Constitutional floor |
|---|---|---|---|
| `@cuestack/core` | 95.10 | **94.52** | 90 — clears |
| `@cuestack/schema` | 96.89 | **91.41** | 90 — clears |
| `@cuestack/react` | 88.24 | 87.52 | none |
| `@cuestack/studio` | 93.50 | 87.56 | none |

**Both packages that carry a floor clear it. The aggregate fails only because of the two that do
not.** So the 89.03% figure everyone quotes is not a report about `core` and `schema`; it is a
weighted average dragged under 90 by two packages the constitution deliberately exempted, and the
comments in the file say as much already — *"the thresholds below stay scoped to core and schema"*,
*"the editor is reported but carries no numeric floor"*. Both are false as configured, and they read
as descriptions of intent that nobody checked against Vitest's semantics.

**Why this belongs to this feature.** SC-008 makes the number visible. The moment it is visible it
goes red, and the two available answers are both bad: leave the board red, or chase branch coverage
in `react` and `studio` — which is the coverage theater II names in the same sentence that exempts
them. A third answer exists and is the correct one, and it is only distinguishable from "lowering
the floor" if somebody has written down that the floor was never set for those packages.

**And it is wrong in a second dimension.** II says *"90% **line and branch** coverage"*. The
configuration sets four metrics. `@cuestack/core` clears line and branch — 96.96% and 94.52% — and
reports `functions` at **88.69%**, so scoping by package alone still fails, on a metric the
constitution never mentions:

```text
{ 'packages/core/src/**': { lines: 90, branches: 90 } }                     → passes
{ 'packages/core/src/**': { lines: 90, branches: 90, functions: 90, … } }   → ERROR functions 88.69%
```

### The mechanism, verified rather than assumed

Glob-keyed thresholds were recommended before they were tested. Tested:

| Threshold block | Result |
|---|---|
| glob entries only | **passes** — files outside every glob are held to nothing |
| glob entries **plus** global numbers | **fails** — the global numbers still apply to the aggregate |
| a glob entry set to 99% | **fails, naming the glob** — the control: glob thresholds really are enforced |

**The middle row is the trap.** "Scope the thresholds" is most naturally implemented by adding a
glob entry, and doing that while leaving the global block in place changes nothing at all — the
board stays red for the same reason and the diff looks like the fix. The global numbers have to be
*replaced*.

The third row matters for the same reason every negative control in this repository matters: a
threshold block that is silently not enforced is indistinguishable from one that is being met.

### What the fix is not, and one measurement for the decision it defers

Not a change to any threshold's value, not a change to any package's coverage, not a test written,
and not the decision the clarification put out of scope — *what to do about the number* stays a
separate judgement. This is which claims a number is asserted under.

**It is also not a widening of `coverage.include`**, and FR-012a says so, because core's instrumented
scope is a five-directory slice grown one feature at a time and the file already records that
closing the rest is *"a decision somebody should make deliberately, not a side effect of an
unrelated diff"*.

**But that decision looks different once measured**, so the number is recorded here:

| core scope | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| the current five-directory slice | 95.10 | 94.52 | **88.69** | 96.96 |
| the whole package | 95.78 | 94.44 | **92.85** | 97.61 |

The whole package is better covered than the slice on three metrics of four, and 0.08 lower on the
fourth. `elements/builtin` at 100%, `interactions` at 98.18% and `validation` at 96.85% all sit
outside the current boundary. **So core's single sub-90 number is an artifact of where the line was
drawn, not of code nobody tested** — which is worth knowing before anyone treats it as a coverage
debt to pay down.

One related observation, left as an observation: `packages/core/src/resolve/element.ts` is excluded
with the stated condition that it *"returns to the floor when US4 lands"*. Included, `resolve`
measures 99.16% statements and 98.09% branches. The condition looks met. Not this feature's to
change, and it is the same pattern as everything else here — a hand-maintained list carrying a claim
nobody re-checked.

---

## R-11: The exclusion costs a little coverage, in one package

**Decision.** Record the delta rather than discover it later inside a bigger number.

Performance suites currently run under coverage instrumentation, so they contribute coverage.
Removing them removes that contribution. Measured, per package, with and without:

| Package | Statements | Branches |
|---|---|---|
| `@cuestack/react` | 88.24 → **88.07** | 87.76 → **87.52** |
| `@cuestack/core` | 95.10 → 95.10 | 94.52 → 94.52 |
| `@cuestack/schema` | 96.89 → 96.89 | 91.41 → 91.41 |

Zero in the two packages that carry a floor — a performance suite drives code that behavioural
tests already drive — and about a quarter of a branch point in `react`, whose perf suite exercises
the whole player.

Small, and worth writing down for one reason: it means part of whatever coverage shortfall CI
reports after this feature is **caused** by it rather than revealed by it. Those are different
claims about the same number, and a feature whose entire subject is a signal being misread should
not hand over a number that conflates them.

---

## R-12: There is one other way this board goes red on an unchanged tree

**Decision.** Out of scope, named anyway, and the acceptance evidence is gathered on a built tree so
it cannot be confused for the flake.

`packages/react/test/harness/core-freshness.test.ts` compares the newest mtime under
`packages/core/src` with the newest under `packages/core/dist` and fails if source is newer:

> `packages/core/src is newer than packages/core/dist — run pnpm build before the React suite, or
> you are testing the previous kernel`

**The check is correct and worth keeping.** `@cuestack/core` resolves to `dist`, so the React
package tests the built kernel — which is what a consumer gets, and which once cost an hour on a
change where a subscriber appeared never to fire because the executing module genuinely did not
contain it. A timestamp comparison is crude and catches exactly the case that matters.

**But a turbo cache restore can invert those timestamps with nothing changed**, and the project
already knows: `docs/cuestack_framework_plan.md` records it as failing intermittently, notes that
`pnpm build && pnpm test` is reliable, and says it is written down *"because a contributor meeting
it reads it as a flake."* That sentence is this feature's thesis, recorded earlier about a different
cause.

**Why it stays out of scope.** It is pre-existing, it prints its own cause and its own fix, and it
is avoidable by building. This feature is about the cause that announces nothing.

**Why it is in the artifacts anyway.** SC-001 asks for ten identical runs. A run that trips this
would be counted as the flake returning, and the diagnosis would be expensive and wrong — the
second time this feature would have cost someone the hour it exists to save. T001 and T012 build
first for that reason, and the failure message is distinctive enough that a run tripping it can be
told apart on sight.

**And it is the only other one.** The framework plan, every document under `docs/`, every package
README and `CLAUDE.md` were searched for recorded intermittency: this is the single instance.

---

## R-13: The failure rate belongs to the machine, not to the tree

**Decision.** Measure the fix against conditions that reproduce the failure, and treat a clean
baseline as a failed measurement rather than as a good sign.

Six consecutive full runs of the **unfixed** tree:

```text
run1..run5  pass  2900 tests  ~77s each      28 cores, load average ~3
plus one earlier run in the same session: pass
```

Against the recorded premise of three runs giving two failures, six passes is not a near miss.
P(6 passes | rate 0.5) is 1.6%; at the recorded 2-in-3 rate it is 0.13%. The rate did not drift —
**the conditions changed.** The original three runs were taken while the same machine was building
and typechecking; these were taken while it was quiet.

**That is the contention diagnosis holding up under a test it could have failed.** R-01 established
that every suite passes in isolation. This establishes the other half: the whole suite passes too,
when nothing else is competing. The cause is load, and load is not a property of the commit.

**And it puts a hole in the acceptance protocol, which is why it is a finding and not a footnote.**
SC-001 is a before-and-after claim, gathered by running the suite ten times before the change and
ten times after. On a quiet machine the *before* is 10/10. The *after* is also 10/10. The comparison
shows no change, the criterion reads as met, and the evidence would have looked exactly the same if
nobody had done anything.

**A green baseline is a failed measurement.** It means the conditions did not reproduce the problem,
so nothing has been established about whether the fix works. The honest responses are to reproduce
the load, or to report that this machine could not demonstrate the criterion — not to run ten more
afterwards and present the match as a result.

**This is the feature's own failure mode, in its own acceptance criteria.** Six analysis passes have
been spent removing checks that pass for the wrong reason; this was one of them.
