# Tasks: A red board means something is broken

**Input**: Design documents from `/specs/013-trustworthy-test-signal/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/performance-ownership.md](./contracts/performance-ownership.md),
[quickstart.md](./quickstart.md)

**Tests are required, not optional.** Constitution II is NON-NEGOTIABLE, and this feature removes
test files from the default suite on the promise that another mechanism runs them. Every way that
promise can break leaves the board green.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelizable, different files, no dependency on incomplete work
- **[US1]/[US2]/[US3]** — the user story a task serves; setup, foundational and polish carry none

---

## The ordering this feature turns on

**Collect, then cover, then check, then exclude — and not in any other order.**

Normally a test precedes the thing it tests. Here the ownership check must precede the *exclusion*
for a different reason: **after the exclusion, a budget that moved and a budget that vanished look
identical.** Both leave `pnpm test` green and `pnpm gates` green. The check is the only thing that
can tell them apart, so it has to exist while the difference is still visible.

**And the exclusion cannot come first for a harder reason: on its own it breaks the gate.**
`gates/perf.mjs` reaches these files through `vitest run --project <name>`, and `--project` picks a
project whose own include/exclude decides its file set. Exclude the files there and the gate
collects nothing, exits 1, and blames a budget for a file it never opened. So the gate gets its own
config first, and only then does anything leave the ordinary one.

`@cuestack/schema` is the concrete case for the middle step. It is not in the gate today, its
performance file is `test/perf.test.ts` — a file, not a directory — and it is one of the two tests
that has been failing. Exclude first and its budget is gone, silently, with every board green.

**Ten files, not nine.** `packages/core/test/resolve/perf.test.ts` carries a 10 ms budget, a growth
ratio and a 50 ms median from outside any `perf` directory. The count of nine that these documents
carried was exactly what the candidate patterns catch — an inventory derived from the pattern meant
to move it cannot report what the pattern misses.

---

## Phase 1: Setup

- [X] T001 Record the baseline in `specs/013-trustworthy-test-signal/quickstart.md` — run `pnpm build`, then `pnpm test` ten times on the unchanged tree, and write down how many passed. **SC-001 is a before-and-after claim and there is no "before" recorded yet.** Record the machine alongside the runs — core count and load average — because **the failure rate belongs to the conditions, not to the tree**: six consecutive runs of this same unfixed tree passed on 28 idle cores ([research R-13](./research.md)). **If the ten runs pass, you have not got a baseline**; you have established that these conditions do not reproduce the problem, and the comparison T012 makes against it would be meaningless. Reproduce the load — a concurrent build or typecheck is what the original failures were taken alongside — or report that this machine cannot demonstrate SC-001. **Build first, and not for tidiness**: `core-freshness.test.ts` compares `core/src` and `core/dist` mtimes and a turbo cache restore can invert them, so an unbuilt run can go red for a reason this feature is not about ([research R-12](./research.md)). It prints *"run `pnpm build` before the React suite"*, which is how to tell it apart on sight
- [X] T002 [P] Record, in the same place, which suites fail across those ten runs. Research R-01 established that the failing test *moves* — that is the evidence for contention over regression, and it should be written down from a ten-run sample rather than from three

---

## Phase 2: Foundational (Blocking Prerequisites)

**Nothing in US1 may land before all of these.** They are what make the exclusion possible at all,
and then what makes it distinguishable from a deletion.

- [X] T003 Create `vitest.perf.config.ts` at the repository root — **FR-003**. Five projects, one per package, each including **only** that package's performance files: core (`test/perf/**` *and* `test/resolve/perf.test.ts`, node), schema (`test/perf.test.ts`, node), element and react (`test/perf/**`, happy-dom), studio (`test/perf/**`, happy-dom). The full inventory is in [contracts §2](./contracts/performance-ownership.md). **Verified to work in both file shapes** — a directory (`--project @cuestack/studio` → 4 files) and a bare file (`--project @cuestack/schema` → 1 file)
- [X] T004 Point `tools/scripts/gates/perf.mjs` at the new config and add `@cuestack/schema` — **FR-003a**, **FR-005**. It spawns core, react, element and studio today and passes each a path filter; with the new config each project already holds only performance files, so `vitest run -c vitest.perf.config.ts --project <name>` is the whole invocation and the filters go. Schema's scaling check joins the gate here, which is also all FR-005 needs: research R-02 measured five isolated runs and five passes, so relocation is the fix and no rewrite is required
- [X] T005 Make the gate distinguish a suite it could not collect from a budget it failed, in `tools/scripts/gates/perf.mjs` — **SC-009**, **SC-004**. Today every non-zero exit is reported as a budget breach, so *No test files found* prints as *"Resolution exceeded its budget or stopped scaling linearly"*. **This is not hypothetical**: it is what the first design of this feature would have produced, and what a future empty project will produce
- [X] T006 Write `tools/scripts/__tests__/perf-ownership.test.ts` — **FR-008**, and the task the whole feature's risk sits on. Four lists must agree: files excluded from `vitest.config.ts`, files collected by `vitest.perf.config.ts`, packages named in `gates/perf.mjs`, and performance files **actually present on disk**. That fourth one is not decoration — it is the list that caught this feature's own inventory short by a file
- [X] T007 Run the controls on T006 **before** trusting it: remove `@cuestack/schema` from the gate and confirm it fails; add a file to the exclusion with no entry in the performance config and confirm it fails; delete a project from the performance config and confirm it fails. A check written for silence must be shown to break it

**Checkpoint**: every budget has an owner that can still reach it, and something asserts that it does.

---

## Phase 3: User Story 1 — A developer can believe the test board (Priority: P1) 🎯 MVP

**Goal**: `pnpm test` gives the same answer every time.

**Independent Test**: ten consecutive full runs on an unchanged tree, all identical.

**Depends on**: Phase 2. **Nothing here is safe before it, and T009 does not work before T003.**

### Tests for User Story 1

- [X] T008 [US1] Extend `tools/scripts/__tests__/perf-ownership.test.ts` with the remaining drift: a performance file renamed outside the excluded pattern runs in **both** places again and the flake returns. The check must notice a perf file that `vitest.config.ts` still collects

### Implementation for User Story 1

- [X] T009 [US1] Expand `packages/{schema,core,adapter-http}` into explicit project objects in `vitest.config.ts` — **prerequisite for T010, and not a pattern edit**. That string glob resolves with Vitest's default include and has no config of its own, so neither `@cuestack/core` nor `@cuestack/schema` has anywhere to put an `exclude` today. There are no per-package vitest configs in the repository. `include: ['test/**/*.test.ts']` is verified to collect exactly what the default glob does for all three: none of them has a test file outside `test/`, and there are no `.spec.ts` files anywhere in them — so `@cuestack/adapter-http` keeps its current 9 files and gains nothing
- [X] T010 [US1] Exclude the ten performance files from the workspace projects in `vitest.config.ts` — **FR-003**, **FR-004**. `@cuestack/element` and `@cuestack/react` glob `test/**`; `@cuestack/studio` already carries an `exclude` list to add to; core needs `test/perf/**` **and** `test/resolve/perf.test.ts`; schema needs a file pattern, not a directory one. The `studio-pure` and `gates` projects have narrow globs and no perf files
- [X] T011 [US1] Settle every test outside the performance config that depends on the wall clock — **FR-011**, **FR-004**. **Two shapes.** *Asserts a duration*: `packages/react/test/ssr/timing.test.ts` holds `elapsed < BUDGET_MS / 100` (20 ms) and a `full < max(empty * 50, 20)` ratio; `packages/schema/test/pathological.test.ts` bounds validation at 2000 ms. *Waits with a deadline*: `packages/element/test/api.test.ts` calls `vi.waitFor` twice, default deadline 1000 ms — it asserts no duration and fails under contention for the same reason, because a deadline is a duration somebody else wrote down. **Decide by measurement, not by filename**: a ceiling three orders of magnitude clear of anything contention can do is a guard and stays where it is with its reason written beside it; a 20 ms ceiling that moves under load is a budget and belongs in the performance config
- [X] T011a [US1] Add the fifth assertion to `tools/scripts/__tests__/perf-ownership.test.ts` — **FR-011a**. No test outside the performance config may pair `performance.now()` with an upper-bound assertion. **Verify it reproduces the sweep**: run it against the tree before T011 and confirm it names exactly the two files T011 found — measured at analysis, the rule matches `react/test/ssr/timing.test.ts` and `schema/test/pathological.test.ts` and nothing else, and no test anywhere uses `Date.now()` or `process.hrtime` for timing, so the rule needs no second clause — a rule check that finds fewer than the manual pass did is not enforcing the rule. `packages/core/test/harness/duration.test.ts` is the precedent for the shape and also the warning about scope: it enforces a neighbouring rule for one package of six under a name that reads project-wide, and widening *its* regex would produce sixteen hits, most of them legitimate async flushes
- [X] T012 [US1] Run `pnpm build`, then `pnpm test` ten times, and compare against T001's baseline — **FR-001**, **SC-001**. **Ten and not three**, and under the same conditions T001 recorded: repetition guards against a low failure rate, but no number of repetitions rescues a comparison whose baseline was already green. **Check T001's baseline before reading this result** — if it was 10/10, this is not evidence of anything and saying so is the correct outcome. **If one of the ten fails, read the message before concluding anything** — a stale-output failure names itself and is the one other recorded cause of an intermittent red board here, and counting it as the flake returning would cost exactly the hour this feature exists to save
- [X] T013 [US1] Record the suite's runtime before and after — **FR-009**, **SC-005**. Ten files of 388 leave, so it can only be faster; the number is worth having rather than assuming
- [X] T013a [US1] Record the coverage the exclusion costs, in the quickstart — measured at analysis as `@cuestack/react` 88.24 → 88.07 statements and 87.76 → 87.52 branches, with `core` and `schema` unchanged to two decimals ([research R-11](./research.md)). **Confirm those numbers rather than copying them.** Performance suites run under instrumentation today, so they contribute coverage, and removing them takes a little back. It is small and it matters for one reason: without it, a coverage shortfall this feature *caused* is indistinguishable from one it *revealed*, and T021 hands both to a reader as one number

**Checkpoint**: the board can be read. Shippable alone.

---

## Phase 4: User Story 2 — A performance budget still catches a real regression (Priority: P1)

**Goal**: the contract Constitution IV states is still enforced, by exactly one mechanism.

**Independent Test**: make something genuinely slower; the gate fails and names the budget.

**Depends on**: Phase 2. Independent of US1 — the gate's behaviour does not change when the
ordinary suite stops duplicating it.

### Tests for User Story 2

- [X] T014 [P] [US2] Verify the gate still fails on a deliberate slowdown — **FR-002**, **SC-002**. Baseline measured at analysis: `pnpm gates` **passes on the current tree in 10.2 s**, running all four packages' performance suites plus the a11y, parity and theme gates — so the cost of making it the sole owner is ten seconds in a job CI already runs. Add a delay to the timeline's drag path and to the referential validation pass, one at a time, and confirm `pnpm gates` fails and names the budget. **Passes for the wrong reason if you only check the gate is green today**; the point is that it still goes red when it should
- [X] T015 [P] [US2] Confirm every budget that existed before this feature still runs after it — **FR-002**, **FR-006**, **SC-003**. Count the assertions, not the files: [data-model §1](./data-model.md) lists seven budgets across five packages, and `@cuestack/schema` gains an enforcer it did not have. **The `MARGIN = 0.9` thresholds stay exactly as they are** — the failures cluster at 91–97 ms against 90, so any margin wide enough to silence them is wide enough to hide a regression. This feature removes the variation, not the margin

**Checkpoint**: more budgets are enforced than before this feature started.

---

## Phase 5: User Story 3 — A measurement says how much room is left (Priority: P2)

**Goal**: a pass at 89 ms and a pass at 12 ms stop reading identically.

**Independent Test**: read the gate's output and see each measured value against its limit.

**Depends on**: Phase 2 only. Independent of US1 and US2.

### Tests for User Story 3

- [X] T016 [P] [US3] Assert the gate's output carries a measured value for each budget, not only a verdict, in `tools/scripts/__tests__/` — **FR-007**, **SC-006**. Today it prints *"playback budgets met"* and *"per-frame player work < 16.7ms"*: the limit and the verdict, never the measurement

### Implementation for User Story 3

- [X] T017 [US3] Have each performance suite report what it measured, in `packages/*/test/perf*` and `packages/core/test/resolve/perf.test.ts` — **FR-007**. The values already exist at every run and are discarded at every run; **that is why nobody knew these budgets were passing within 3% of their thresholds until they started failing**
- [X] T018 [US3] Print them in `tools/scripts/gates/perf.mjs` alongside the budget each belongs to. Note that the gate captures each run with `stdio: 'pipe'` and currently discards stdout on success

**Checkpoint**: all three stories delivered.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 Correct **both** numbers in `README.md` — **FR-010**. The row reads `| pnpm test (189 tests) | — | < 1 s |`; a full run measures 388 files, 2900 tests, 78 s. A stale *duration*, in the row directly under a timing budget, is this feature's own subject stated about itself
- [X] T020 Add `tools/scripts/__tests__/readme-claims.test.ts` — **FR-010**, **SC-007**, whose second clause is *"something keeps it that way or it does not get stated"*. Count test **files** from disk rather than tests from a run, so the check is cheap and needs no suite; state the duration as indicative, or drop it from the row. **A number corrected by hand is stale at the next commit** — the spec said 2899 and the measured figure is already 2900
- [X] T021 Confirm `pnpm test:coverage` reaches the coverage stage — **SC-008**. It currently aborts at the test stage on the flake, so **CI has not reported this project's coverage figure at all**; and when it does, the figure covers **four of the six packages** — `element` and `adapter-http` are not in `coverage.include` at all, which is worth stating rather than letting "the project's coverage" imply otherwise; the widely-quoted 89.03% came from a local run. Both suite scripts read `vitest.config.ts`, so T010 should fix this with no change to `package.json` — confirm that rather than assume it. **It may now report a failure, and that is the expected outcome.** Do not answer it by changing a threshold's value — seeing the number is this feature's deliverable, deciding about it is not. T022 is the one exception, and it is not that
- [X] T022 **Replace** the global `thresholds` block in `vitest.config.ts` with glob entries for `@cuestack/core` and `@cuestack/schema`, carrying `lines` and `branches` only — **FR-012**, **SC-010**. One block with no glob keys applies all four of its metrics to the aggregate of every instrumented package, which now includes `packages/react/src` and `packages/studio/src`. Constitution II sets **90% line and branch** for two packages and says UI packages carry none, *"behavioral tests are required instead of coverage theater"*. **Replace, not supplement**: a glob entry added alongside the global numbers leaves those numbers enforcing 90% on the aggregate and changes nothing — verified, and it is the reading an implementer is most likely to take from the word "scope". **The file's own comments already claim this is how it works** — *"the thresholds below stay scoped to core and schema"* — and they are false as configured
- [X] T023 Verify T022 changed the assertion and not the standard, and run the control — **SC-010**, **FR-012a**. Measured at analysis: `{ 'packages/core/src/**': { lines: 90, branches: 90 } }` passes on today's coverage with nothing written; adding `functions: 90` to it fails at **88.69%**, which is the metric the constitution does not set. So a correct scoping passes and an over-wide one fails on a number nobody agreed to — **check which of those you have**. Then the control: set a glob threshold to 99 and confirm it fails naming the glob, because a threshold block that is silently not enforced looks exactly like one that is being met. Keep `react` and `studio` *reported* — that is what the config intends, and it makes a regression in them visible without failing the build over it. **And leave `coverage.include` alone** (FR-012a): core's instrumented scope is a five-directory slice the file says somebody should close deliberately, and widening it here would turn a two-line correction into that decision
- [X] T024 [P] Say where performance is measured, in `README.md` — after this change `pnpm test` no longer runs it, and a contributor who expects it to will conclude the budgets are gone. **Start with line 31**, `pnpm test          # run the suite`: it is the first thing a contributor reads about testing and it is where the claim stops being true, so prose added further down does not reach the reader who needs it. Then state that budgets are stated against the project's CI runner and that a local timing is indicative — true today and written only inside a 90KB plan
- [X] T025 Record the finding in `docs/cuestack_framework_plan.md` — the diagnosis measured across nineteen isolated runs, the budget that was one config change away from being deleted, the file that no pattern named, and what the gate was discarding on every run
- [X] T026 Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm gates && pnpm check:rules && pnpm check:docs && pnpm check:agreement && pnpm check:element-isolation && pnpm check:packaging && pnpm check:isolation && pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations` and confirm every one is green. `check:rules` must still read **18 of 18**. **Note what does not cover the new file**: there is no root `tsconfig.json` and `typecheck` runs per package, so `vitest.perf.config.ts` is linted by `eslint .` and typechecked by nothing. A mistake in it surfaces as the gate failing to collect, which T005 now makes legible
- [X] T027 Verify the negative controls by deliberate breakage, restoring each afterwards: remove `@cuestack/schema` from the gate (T006 must fail); exclude a file with no performance-config entry (T006 must fail); rename a perf file outside the excluded pattern (T008 must fail); point the gate at a project with no files (T005 must say so, and not name a budget); slow down a measured path (T014 must fail); widen the coverage scope back to the aggregate (T023 must fail). **`git checkout` is not a restore for an untracked file and is destructive for a tracked one** — feature 011 hit both halves of that in one session

---

## Dependencies & Execution Order

```text
Phase 1 (baseline)
   └──► Phase 2 (perf config → gate → check)  ──┬──► Phase 3 (US1 — the exclusion)  🎯 MVP
                                                 ├──► Phase 4 (US2 — the budget still bites)
                                                 └──► Phase 5 (US3 — report the headroom)
```

**Phase 2 blocks everything, for two separate reasons.** T003 is a hard prerequisite: without a
config the gate can read, T010 removes the files from the gate as well as from the suite. T006 is a
soft one that matters just as much: after T010 lands, a relocated budget and a deleted one are
indistinguishable, so the check has to exist while the difference is still observable.

**Within Phase 3, T009 precedes T010.** Two of the five packages have no project object to exclude
from until it does.

**US2 and US3 are independent of US1.** The gate's behaviour does not change when the ordinary
suite stops duplicating it, so both can proceed in parallel with the exclusion or without it.

## Parallel opportunities

**Phase 1** — T002 rides on T001's runs.

**Phase 2** — strictly sequential. Each task is the precondition for the next.

**Phase 4 and 5** — different files entirely from Phase 3, and from each other.

**Phase 6** — T019, T020 and T024 all touch `README.md` or a check over it and must run in order;
T021 → T022 → T023 is a chain; T025 is independent.

## Implementation strategy

**MVP is Phase 1 + Phase 2 + Phase 3.** That makes the board readable, which is the point, and it
is safe because Phase 2 precedes it.

**Then Phase 4 before Phase 5.** US2 is P1 and US3 is P2, and US2 is also the check that the MVP
did not quietly cost something — worth knowing before adding output nobody has read yet.

**Phase 6's T021 through T023 are the ones to read carefully.** It will most likely turn CI's test job from red to
red-for-a-different-reason, and that is success: the coverage number becomes visible for the first
time. The temptation to finish the job by moving the threshold is exactly what the spec put out of
scope.
