# Quickstart: proving the board can be read

Each scenario is a command and what it should say. Two of them can pass for the wrong reason, and
those are called out.

**Scenario 0, before any of them.** The gate must be able to reach the performance files at all:

```bash
pnpm exec vitest run -c vitest.perf.config.ts --project @cuestack/schema
pnpm exec vitest run -c vitest.perf.config.ts --project @cuestack/studio
```

One file for schema, four for studio — the two file shapes the repository has. If the performance
files were excluded from `vitest.config.ts` without this config existing, both of these report *No
test files found*, and `gates/perf.mjs` prints that as a budget breach.

---

## 1. The suite gives the same answer every time

```bash
pnpm build
for i in $(seq 10); do pnpm test >/dev/null 2>&1 && echo pass || echo FAIL; done
```

Ten passes. Today this produces a mix — three runs of the same commit gave two failures and a pass,
on different tests.

**`pnpm build` is part of the scenario, not preamble.** `core-freshness.test.ts` compares
`packages/core/src` and `packages/core/dist` mtimes and a turbo cache restore can invert them, so an
unbuilt run can go red for the one other recorded reason. It says so on screen —
*"run `pnpm build` before the React suite"* — which is how to tell it apart from the failure this
scenario is about. Counting it as the flake returning is the mistake that costs the hour.

**Ten and not three**, because repetition guards against a low failure rate. **But repetition does
not rescue the wrong conditions.** Six consecutive runs of the unfixed tree passed on 28 idle cores;
the original three failures were recorded while the same machine was building and typechecking. Run
this alongside comparable load, and record the core count and load average with the result.

**If it passes ten times before the fix, stop.** That is not a good baseline, it is an absent one —
and ten green runs afterwards would match it perfectly while demonstrating nothing.

### Recorded baseline (T001/T002)

**Unfixed tree, 28 cores, 12 concurrent CPU burners, load ~16.** Ten runs, ~100 s each:

```text
run1 pass   run2 FAIL   run3 pass   run4 pass   run5 FAIL
run6 FAIL   run7 FAIL   run8 pass   run9 FAIL   run10 FAIL
```

**Six failures in ten — 60%**, and the failing assertion moves, which is the contention signature:

| Run | Package | Assertion | Measured / limit |
|---|---|---|---|
| 2 | `@cuestack/studio` | timeline playhead to rendered state | 99.57 / 90 ms |
| 5 | `@cuestack/studio` | timeline drag feedback | 92.20 / 90 ms |
| 6 | `@cuestack/schema` | validation scaling 300→600 | ratio 9.85 / 6 |
| 7 | `@cuestack/element` | slide change including stage clone | 45.90 / 30.06 ms |
| 9 | `@cuestack/studio` | timeline playhead to rendered state | 91.70 / 90 ms |
| 10 | `@cuestack/schema` | validation scaling 300→600 | ratio 6.63 / 6 |

**The load is the measurement, not the setup.** Six consecutive runs of this same tree passed on an
idle machine. A baseline taken there would have been 10/10 — a matched pair of clean sweeps proving
nothing, which is what R-13 exists to prevent.

### Recorded result (T012/T013)

**Same tree fixed, same machine, same 12 burners:**

```text
run1..run10  pass   13–15 s each   2850 tests
```

| | Before (T001) | After (T012) |
|---|---|---|
| Failures in ten runs | **6** | **0** |
| Wall clock per run, under load | ~102 s | **~14 s** |
| Wall clock, idle | ~77 s | **9.9 s** |
| Test files / tests | 388 / 2900 | 378 / 2850 |

**The baseline reproduced the failure, so the comparison means something.** Ten green runs after ten
green runs would have demonstrated nothing; ten green runs after six failures in ten is the claim
SC-001 asks for.

Most of the speed is not the ten relocated files. It is `check-gates.test.ts` leaving the ordinary
suite: it spawned `gates/perf.mjs` four times and `run-all.mjs` once on every `pnpm test`, which
accounted for 69.8 s of the 77 s and re-measured every budget under contention.

---

## 2. Nothing stopped being measured

```bash
pnpm vitest run tools/scripts/__tests__/perf-ownership
```

Four lists agree: files excluded from `vitest.config.ts`, files collected by
`vitest.perf.config.ts`, packages named in `gates/perf.mjs`, and performance files present on disk.

**The fourth is the one that earns its place.** The other three are documents agreeing with
documents; only disk can report a file no pattern was written for — which is how
`packages/core/test/resolve/perf.test.ts` was found missing from this feature's own inventory.

**This is the scenario the feature exists around.** After the exclusion, a budget that moved and a
budget that vanished look identical — both leave `pnpm test` green and `pnpm gates` green. This is
the only thing that tells them apart.

Break it deliberately: remove `@cuestack/schema` from the gate's list and it must fail.

---

## 3. The gate still catches a real regression

Baseline, measured before any of this landed: `pnpm gates` **passes on the current tree in 10.2 s**,
running all four packages' performance suites plus the accessibility, parity and theme gates. That
is the price of making it the sole owner, in a CI job that already runs.

```bash
pnpm gates
```

Then make something genuinely slower — a sleep in the timeline's drag path, an accidental
quadratic in the referential validation pass — and run it again. It must fail, and name the budget.

**Passes for the wrong reason if** you only check that the gate is green today. The point is not
that it passes; it is that it still fails when it should.

---

## 4. The gate says what it measured

```bash
pnpm gates 2>&1 | grep -A2 'gate:perf'
```

Each budget's measured value against its limit. Today the output states the limit and the verdict
and never the measurement, which is why nobody noticed these were passing at 91–97ms against 90.

---

## 5. `@cuestack/schema` is covered

```bash
pnpm gates 2>&1 | grep -i schema
```

It is absent today. Its scaling check is one of the two tests that failed, so a relocation that
did not add it here would have deleted the budget.

---

## 6. Coverage is reported again

```bash
pnpm test:coverage
```

It reaches the coverage stage instead of aborting at the test stage.

**And the figure covers four of the six packages** — `@cuestack/element` and
`@cuestack/adapter-http` are not in `coverage.include` at all. Worth saying when reporting it, so
"the project's coverage" is not read as more than it is.

**It may then report a failure**, and that is the expected outcome, not a regression this feature
introduced: the number has been hidden by the flake, and the last figure anyone has — 89.03% —
came from a local run rather than from CI. **Do not answer a newly-visible coverage failure by
adjusting a threshold's value.** Seeing the number is this feature's deliverable; deciding about it
is not.

**One correction is required, and it is not that.** Four metrics are asserted over four packages;
Constitution II sets **line and branch** on two and exempts UI packages by name. Both packages that
carry a floor clear both metrics — 94.52% and 91.41% branches against 87.52% and 87.56% for the two
that do not — and `core` fails only on `functions`, at 88.69%, which II never mentions:

```bash
pnpm test:coverage 2>&1 | grep -E 'packages/(core|schema|react|studio)/src|All files'
```

After the thresholds are scoped, this passes on the same coverage it has today. **Two ways to get
it wrong**: leave the global numbers in place beside the new glob entries, which changes nothing;
or carry `functions` and `statements` into the glob entries, which fails core at 88.69% on a metric
the constitution does not set. If it still fails after both are avoided, that is a real finding
about `core` or `schema` and it belongs to whoever decides about it.

And it must not be fixed by widening `coverage.include`. Recorded for whoever eventually decides
that: the whole of core reports 92.85% functions against the slice's 88.69%, so the one sub-90
number comes from where the boundary sits.

**And this feature took a little coverage with it.** Removing the performance suites from the
instrumented run costs about a quarter of a branch point in `@cuestack/react` and nothing in `core`
or `schema`. Report that separately from what was already there.

---

## 7. The suite is not slower

```bash
time pnpm test
```

Ten files of 388 leave, so it can only be faster. Recorded rather than assumed.

---

## 8. A failure names what actually failed

```bash
pnpm exec vitest run -c vitest.perf.config.ts --project @cuestack/core zzz-no-such-file
```

Vitest exits 1 with *No test files found*. Run through the gate, that must read as a suite that
could not be collected — **not** as *"Resolution exceeded its budget or stopped scaling linearly"*,
which is what it says today.

**Can pass for the wrong reason.** A gate that is green because everything is fine looks exactly
like a gate that is green because it is not checking. Make the message wrong on purpose and confirm
the check for it fails.

---

## 9. Nothing else in the suite is timing anything

```bash
pnpm vitest run tools/scripts/__tests__/perf-ownership
grep -rln 'performance\.now()' packages/*/test | grep -v perf
grep -rn 'vi\.waitFor\|waitFor(' packages/*/test --include=*.ts --include=*.tsx
```

The check must name what the greps name — **a rule check that finds fewer files than the manual
sweep did is not enforcing the rule**, and confirming that is the whole point of running both.

Whatever remains must be a *guard* and not a *budget* — a ceiling far enough from ordinary variation
that contention cannot reach it, with the reason written beside it.
`packages/schema/test/pathological.test.ts` at 2000 ms qualifies; the 20 ms assertion in
`packages/react/test/ssr/timing.test.ts` is the one to settle by measurement; and
`packages/element/test/api.test.ts`'s two `vi.waitFor` calls are the third shape — a 1000 ms
deadline that asserts no duration and fails under load anyway.

**The neighbouring check is not this one.** `packages/core/test/harness/duration.test.ts` forbids a
test that *waits* — for one package, under a name that reads project-wide. It does not see
`performance.now()` and it does not leave core. Do not widen it: sixteen files outside core trip its
regex and most are legitimate async flushes.

---

## 10. Everything still holds

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm gates
pnpm check:rules && pnpm check:docs && pnpm check:agreement
```

`check:rules` must still read 18 of 18. The root README's test count must match a real run —
it reads 189 tests in under a second, against 2900 tests in 78 seconds today.
