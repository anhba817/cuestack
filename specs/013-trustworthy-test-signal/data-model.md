# Data Model: A red board means something is broken

No runtime data. What this feature models is an ownership relation between budgets and the
mechanisms that measure them — a relation that exists today only as a coincidence between two
lists nobody compares.

---

## 1. Performance budget

A stated limit on how long something may take. Every one of these exists today; this feature adds
none and removes none.

| Budget | Owner | Stated as |
|---|---|---|
| Resolution of a 300-element slide | `@cuestack/core` | < 10ms |
| Packaging and validation passes | `@cuestack/core` | suite-local |
| Per-frame player work | `@cuestack/react` | < 16.7ms, ×0.9 margin |
| Seek to rendered state | `@cuestack/react` | < 100ms, ×0.9 margin |
| Per-frame adapter work, and a slide change | `@cuestack/element` | < 16.7ms, ×0.9 margin |
| Editor interaction, timeline drag, playhead, history | `@cuestack/studio` | < 100ms, ×0.9 margin |
| Validation scaling, 300 → 600 elements | `@cuestack/schema` | ratio < 6 |

**The margin is a decision, not a rounding.** `MARGIN = 0.9` makes each threshold stricter than the
budget so a regression fails while there is still room. It also leaves 10% of headroom against
variation that is demonstrably larger than 10% — which is how a deliberate safety margin became the
source of the failures. This feature removes the variation rather than the margin.

---

## 2. Measurement context

The conditions a timing is taken under. Not modelled anywhere today, and the reason two runs of the
same assertion disagree.

| | Ordinary suite | The gate |
|---|---|---|
| What else is running | up to a dozen other suites, in parallel | that package's suite, alone |
| Instrumentation | coverage, in CI | none |
| Result | 91–97ms against a 90ms threshold, intermittently | passes |

**Nineteen isolated runs across five packages produced nineteen passes.** The context is the whole
difference; the code is the same code.

---

## 3. Ownership

The relation this feature makes explicit: **each budget has exactly one mechanism that measures
it.**

Today the relation is many-to-one in the wrong direction — every budget is measured twice, by two
mechanisms whose answers disagree — and one budget is measured by the ordinary suite only:

| Package | Files | In the ordinary suite | In the gate |
|---|---|---|---|
| `@cuestack/core` | 3 | yes | yes |
| `@cuestack/react` | 1 | yes | yes |
| `@cuestack/element` | 1 | yes | yes |
| `@cuestack/studio` | 4 | yes | yes |
| `@cuestack/schema` | 1 | yes | **no** |

That last row is why the ordering in the plan matters. Remove the left column first and schema's
budget stops existing.

**Ten files, and the count is load-bearing.** Core has three, not two: `test/resolve/perf.test.ts`
sits outside any `perf` directory and was missing from this model's own inventory until the
artifacts were checked against the tree. A file that no pattern names is a budget that no list
protects.

**After this feature the relation is one-to-one**: the gate owns every performance budget, and
nothing else measures one. It is held by two configs — `vitest.perf.config.ts` collects exactly
these files, `vitest.config.ts` excludes exactly these files — which is what makes the relation
checkable by reading rather than by running.

---

## 4. The consistency the feature has to hold

Three lists have to agree, and nothing compares them today:

- the performance files **excluded** from the ordinary suite;
- the performance files **collected** by the performance config;
- the packages the **gate** runs performance for.

And all three have to agree with a fourth thing that is not a list at all: the performance files
actually present on disk. That is the one that caught this feature's own inventory out.

Three ways they drift, all of which leave every board green:

| Drift | What it looks like |
|---|---|
| A new package gets a `test/perf/` directory and nobody adds it to the gate | Its budgets never run |
| A performance file is renamed outside the excluded pattern | It runs in both places again, and the flake returns |
| A performance file leaves the performance config but stays excluded from the ordinary one | It runs in neither, and both boards stay green |

**A fourth was assumed and is not real.** "A gate entry's filter matches no files, so the gate
passes trivially" was in this table until it was tested: Vitest exits 1 on *No test files found*
and the gate carries no `--passWithNoTests`. It fails — but reports the collection failure as a
budget breach, which is a defect against SC-004 rather than FR-008. The flag that would make a
suite pass having measured nothing is on `pnpm test`, not on the gate.

**Each is the same failure this repository has already had**: three gates carrying package lists
that reached nothing, and a public-surface check that ran one direction for five waves. A relation
that is only a convention between two files is a relation that decays.

---

## 4a. A second ownership relation, in the same shape

The feature's subject is a budget with two enforcers that disagree. The coverage floor has the
mirror-image defect: **one threshold asserted over four packages, set by the constitution for two.**

| Package | Branches | Floor per Constitution II |
|---|---|---|
| `@cuestack/core` | 94.52 | 90 |
| `@cuestack/schema` | 91.41 | 90 |
| `@cuestack/react` | 87.52 | **none** |
| `@cuestack/studio` | 87.56 | **none** |

Both owners of a floor satisfy it. The aggregate fails because two packages with no floor are
inside the assertion — and the configuration's comments already say they should not be. It is the
same class of thing as a budget measured in a room where it cannot be measured: a number produced
correctly and claimed about the wrong subject.

---

## 5. What a measurement reports

Today: whether the budget was met. After: what was measured, and against what.

The difference is not cosmetic. A pass at 89ms and a pass at 12ms are indistinguishable in the
current output, and only one of them is about to start failing. Nobody knew these budgets were being
met at 91–97ms against 90 until they stopped being met — that information existed at every run and
was discarded each time.
