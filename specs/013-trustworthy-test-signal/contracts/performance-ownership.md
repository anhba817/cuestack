# Contract: which mechanism owns which budget

## 1. The rule

**Every performance budget is measured by exactly one mechanism: `pnpm gates`.** Nothing else times
anything.

The ordinary test suite asserts behaviour. It does not assert duration, because it cannot: it runs
a dozen suites in parallel and, in CI, under coverage instrumentation. A timing taken there measures
the machine's contention, not the code.

**Two configs, because one cannot express this.** `gates/perf.mjs` reaches these files through
`vitest run --project <name>`, and `--project` selects a project whose own include/exclude decides
its file set — so a file excluded from the ordinary suite is, by the same act, invisible to the
gate. The two mechanisms therefore need two configs:

| | Collects | Run by |
|---|---|---|
| `vitest.config.ts` | everything **except** the performance files | `pnpm test`, `pnpm test:coverage` |
| `vitest.perf.config.ts` | the performance files and nothing else | `gates/perf.mjs` |

**Both configs name their projects the same way**, so `--project @cuestack/core` means a different
file set depending on which `-c` it is given. That is deliberate — the gate's package list stays
readable against the contract's table — but it means an invocation without `-c` silently asks the
wrong config. The gate always passes it explicitly.

Both entry points of the ordinary suite read the same config, so the exclusion covers
`pnpm test:coverage` — the one CI actually fails on — without a second change.

---

## 2. What the gate must cover

**Ten files across five packages.** The count of nine that this document carried until now was
exactly what the patterns `test/perf/**` and `test/perf.test.ts` catch, which is the point: a file
inventory derived from the pattern meant to move it cannot tell you what the pattern misses.

| Package | Performance files | Env | In the gate |
|---|---|---|---|
| `@cuestack/core` | `test/perf/packaging.test.ts`, `test/perf/validation.test.ts`, **`test/resolve/perf.test.ts`** | node | yes |
| `@cuestack/react` | `test/perf/playback.test.ts` | happy-dom | yes |
| `@cuestack/element` | `test/perf/frame.test.ts` | happy-dom | yes |
| `@cuestack/studio` | `test/perf/{editor,history,preview,timeline}.test.tsx` | happy-dom | yes |
| `@cuestack/schema` | `test/perf.test.ts` | node | **must be added** |

**Two of these packages have no project object to exclude from.** `@cuestack/core` and
`@cuestack/schema` come from the string glob `packages/{schema,core,adapter-http}`, which resolves
with Vitest's default include and no config of its own. Both must be expanded into explicit
projects before anything can be excluded from them — the two packages that matter most here are the
two the existing mechanism does not reach.

**`@cuestack/schema` is the reason this is a contract and not a config change.** It is not in the
gate today, and its file is `test/perf.test.ts` — a file, not a directory — so a pattern written
for `test/perf/**` misses it in both directions: it would not be excluded from the ordinary suite,
or, written loosely enough to catch it, it would be excluded from a suite that never gained a gate
entry.

**`packages/core/test/resolve/perf.test.ts` is the reason the inventory is stated file by file.**
It holds a 10ms budget, a growth ratio and a 50ms median, and it lives under `test/resolve/`. The
gate runs it only because core's filter is the bare substring `perf`; no directory pattern reaches
it. It is the one file that would have kept being measured twice.

**Cover before excluding.** After the exclusion, a relocated budget and a deleted one look
identical: both leave the ordinary suite green and `pnpm gates` green.

---

## 3. What must not be possible

Three drifts, each of which leaves every board green:

| | |
|---|---|
| A package gains performance files and nobody adds it to the performance config or the gate | Its budgets never run again |
| A performance file is renamed outside the excluded pattern | It runs in both places, and the flake returns |
| A performance file is dropped from the performance config while staying excluded from the ordinary one | It runs in neither, and both boards stay green |

A check must compare the lists — files excluded from the ordinary suite, files collected by the
performance config, packages the gate runs, and performance files present on disk — and fail when
they disagree. **This is not belt-and-braces.** This repository has already shipped three gates
whose package lists reached nothing, and a public-surface check that ran in one direction for five
waves. A relation held only by convention between two files decays, and every symptom of this one
decaying is silence.

**A fourth drift was assumed and does not exist.** "A gate entry's filter matches nothing, so the
gate passes having measured nothing" is false: Vitest exits 1 on *No test files found*, and the
gate passes no `--passWithNoTests`. What actually happens is a different defect — the gate reports
that collection failure as a budget breach:

> `gate:perf — FAILED. Resolution exceeded its budget or stopped scaling linearly.`

**The gate must distinguish a budget it failed from a suite it never collected.** A message that
names the wrong cause costs whoever reads it the same hour the flake costs, and SC-004 is the
criterion that forbids it.

---

## 4. What the gate reports

Each budget's **measured value** alongside its limit, not merely that it was met.

Today the gate prints *"playback budgets met on the 50-slide/300-element fixture"* and *"per-frame
player work < 16.7ms"*. It states the limit and the verdict, never the measurement — so a pass at
89ms against 90 and a pass at 12ms against 90 are the same line of output.

Nobody knew these budgets were being met within 3% of their thresholds until they started failing.
That information was produced on every run and discarded on every run.

---

## 5. What this contract does not change

- **No budget's value.** Loosening a threshold to stop it failing trades a noisy signal for no
  signal. The variation is removed instead.
- **No assertion.** The performance suites keep every check they have.
- **The reference environment.** Budgets are stated against the project's CI runner; a
  contributor's machine is indicative. Unchanged, and worth stating more clearly than it is now.
- **A termination guard.** `packages/schema/test/pathological.test.ts` bounds validation at 2000ms
  to catch an infinite loop, not a slowdown. A ceiling three orders of magnitude clear of anything
  contention can do belongs with the behaviour it protects; moving it here would cost the gate time
  to assert something that cannot fail either way. The distinction is what the number is for, not
  where the file lives — see [research R-09](../research.md).
- **The coverage floor's value.** CI's test job currently fails on the flake *before* coverage is
  evaluated, so the project's coverage standing is unknown from CI. This feature makes the number
  visible again. It does not move it, and a newly-visible coverage failure must not be answered by
  adjusting the threshold.

  **What it does change is which packages that number is asserted about.** Constitution II sets a
  90% floor for `@cuestack/core` and `@cuestack/schema` and states that UI packages carry none.
  `vitest.config.ts` asserts 90% over the aggregate of four instrumented packages, and both of the
  two with a floor clear it — 94.52% and 91.41% branches against 87.52% and 87.56% for the two
  without. So the red this feature reveals is a floor applied where the constitution says there
  is none. Scoping it is not lowering it; see [research R-10](../research.md).

  **And this contract's own subject makes a small dent in it.** Performance suites contribute
  coverage today, so removing them from the instrumented run costs about a quarter of a branch
  point in `@cuestack/react` and nothing in `core` or `schema` ([R-11](../research.md)). Part of
  the shortfall is therefore caused here rather than merely uncovered here, and the two should be
  reported as two things.

---

## 6. Wall-clock time, and Constitution II

Constitution II says timing tests MUST drive an injectable virtual clock and MUST NOT depend on
wall-clock sleeps. Every file in section 2 calls `performance.now()`.

**These are not the tests that principle governs, and the distinction is worth stating once.**
Principle II is about *playback timing* — slide advance, sequence-to-absolute conversion, effect
scheduling. Those describe behaviour that must be reproducible, and a real clock there makes a suite
that gets muted the first week it flakes, which is the rationale the principle gives.

Principle IV asks for something a virtual clock cannot supply: how long the code actually takes on
a real machine. A performance fixture that ran on a fake clock would measure nothing. The two
principles are not in tension — they govern different questions.

**Part of this is already written down, in code, and it is worth knowing where.**
`packages/core/test/harness/duration.test.ts` fails if any test file under `packages/core/test/`
references `setTimeout`, `setInterval`, `vi.advanceTimersByTime` or `await new Promise`. That is
Principle II in executable form, with its own rationale — and it covers **one package of six**,
under an assertion named *"no test file references a real delay"*.

It is not the same rule as this contract's. It forbids a test that **waits**; this contract governs
a test that **measures**. They overlap at the edge — both are about a suite's dependence on the
wall clock — and neither knows the other exists. What has never been written down is the *boundary*:
which of the two principles a given wall-clock reference falls under, and why the files in section 2
are exempt from the one and required by the other.

**What the exemption costs, and why the gate is where it is paid.** A real clock is exactly what
made these files flake. Principle II's rationale is right about the consequence and this feature is
the proof: it is why they get a runner with nothing else on it, rather than a place in the
ordinary suite.
