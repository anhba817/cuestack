- **FR-011**: A test that depends on the wall clock MUST be treated as one wherever it lives, and
  the rule MUST be enforced rather than swept once. Two shapes qualify: a test that **asserts a
  duration** — two files outside any `perf` path do, one of them at 20 ms — and a test that **waits
  with a deadline**, which fails the same way for the same reason without asserting any duration at
  all. Each MUST be settled: moved to the mechanism that owns performance, or kept with its ceiling
  shown to be far enough from ordinary variation that contention cannot reach it, and the reason
  recorded next to it.
- **FR-011a**: Something MUST fail when the next such test is written. A one-time sweep finds
  today's files and nothing stops tomorrow's — which is the failure mode this feature's own FR-008
  exists to prevent, applied to itself. The repository already enforces a neighbouring rule this
  way for a single package, so the shape is established; what is missing is a check for *this*
  rule, and it can be narrow enough to be exact rather than heuristic.
# Feature Specification: A red board means something is broken

**Feature Branch**: `013-trustworthy-test-signal`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "Do The perf flake"

## Context

`pnpm test` currently fails at random. Three consecutive full runs of the same committed tree
gave two failures and one pass, and **the failing test was different each time**:

| Run | Result | Failing assertion |
|---|---|---|
| 1 | fail | `@cuestack/schema` — validation scaling ratio 7.93 against a limit of 6 |
| 2 | fail | `@cuestack/studio` — timeline playhead 93.3 ms against a 90 ms threshold |
| 3 | pass | — |

An earlier run failed on a third: `@cuestack/studio` editor render at 97.5 ms. Every one of these
suites passes in isolation — the studio performance suite passed five times out of five — and
`pnpm gates`, which is what CI enforces, passes.

**And on a quiet machine the failures do not appear at all.** Six consecutive full runs of the same
unfixed tree, taken later on 28 cores at a load average of about 3, passed six times out of six —
2900 tests, ~77 s each. Those three original runs were taken while the machine was also building and
typechecking. **This is the diagnosis confirmed, and it is also a warning about how to measure the
fix**: the failure rate is a property of what else is running, not of the tree, so a run of the suite
that passes proves nothing on its own and neither does ten of them.

**The cost is not the failures. It is that the board can no longer be read.** A developer who sees
`pnpm test` fail has to decide whether they broke something, and the honest answer today is "run it
again". That erodes every future change: the one signal that should be unambiguous has become a
coin flip, and a real regression arriving in one of these files would be indistinguishable from the
noise. It has already had that effect — a genuine regression during feature 012's implementation
had to be separated by hand from two unrelated timing failures in the same run.

**And it is not only a local problem.** CI's test job runs `pnpm test:coverage`, which collects the
same files under coverage instrumentation — more overhead against the same timing thresholds. That
job fails on this flake, and because it fails at the test stage **coverage is never evaluated at
all**. So the flake is currently hiding the project's coverage standing: the most recent figure
anyone has, 89.03% branches against a 90% floor, was measured locally rather than reported by the
gate that is supposed to report it. Making that number visible again is part of what this feature
buys, and is distinct from deciding what to do about it.

**Two facts shape the work.** First, every performance suite runs **twice**: the workspace test
projects glob `test/**`, which includes `test/perf/**`, and `tools/scripts/gates/perf.mjs` then
spawns vitest again per package to run the same files. Second, the two runs are not equivalent —
the gate runs a package's performance suite on its own, and `pnpm test` runs it alongside up to a
dozen other suites competing for the same cores. The measurement that CI trusts is the second one;
the one that fails is the first.

## Clarifications

### Session 2026-08-21

- Q: Where should timing assertions live once each budget is measured in exactly one place? → A: Only in the gate. Performance suites leave the workspace test projects; `pnpm gates` keeps owning them, and **`@cuestack/schema` must be added to the gate first**, since it is not there today and its perf test is one of the failing ones.
- Q: CI's test job fails on this flake before coverage is ever evaluated — should this feature also take on the coverage floor it is currently hiding? → A: No. Fix the flake so the coverage number becomes visible; what to do about that number is a separate decision that cannot be made properly until it can be seen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A developer can believe the test board (Priority: P1)

A developer changes something, runs the suite, and reads the result. Green means their change is
fine. Red means they broke something.

**Why this priority**: It is the whole feature. Every other quality mechanism in this repository —
the gates, the checks, the constitution — is downstream of a test result somebody trusts.

**Independent Test**: run the full suite ten times on an unchanged tree; every run gives the same
answer.

**Acceptance Scenarios**:

1. **Given** a committed tree with no changes, **When** the full suite runs repeatedly, **Then**
   every run passes.
2. **Given** a change that genuinely breaks behaviour, **When** the suite runs, **Then** it fails,
   and it fails for that reason.
3. **Given** a run that does fail, **When** a developer reads the output, **Then** what failed and
   why is unambiguous without re-running.

---

### User Story 2 - A performance budget still catches a real regression (Priority: P1)

Somebody makes the editor slower. A gate says so, before it reaches a teacher.

**Why this priority**: Also P1, and separately at risk. The obvious way to stop timing tests
failing is to loosen or delete them, which would trade a noisy signal for no signal. Constitution IV
makes performance a contract; whatever this feature does to the noise, the contract must still be
enforced somewhere that is watched.

**Independent Test**: make a deliberate, meaningful slowdown; the mechanism that owns performance
reports it.

**Acceptance Scenarios**:

1. **Given** a change that makes a measured interaction materially slower, **When** the performance
   mechanism runs, **Then** it fails and names the budget that was exceeded.
2. **Given** the same change, **When** it is proposed for merge, **Then** it is caught before merge
   rather than after.
3. **Given** no such change, **When** the mechanism runs repeatedly, **Then** it passes every time.

---

### User Story 3 - A measurement says how much room is left (Priority: P2)

Somebody wants to know whether a budget is close to being exceeded, not merely whether it was.

**Why this priority**: Lower, because a lesson does not depend on it. It is worth having because
the current failures cluster at 91–97 ms against a 90 ms threshold — margins that thin are how a
budget becomes noise, and nobody can see that from a pass.

**Independent Test**: the performance output reports the measured value alongside the budget, so a
reader can see the headroom.

**Acceptance Scenarios**:

1. **Given** a passing performance run, **When** a developer reads its output, **Then** they can
   see how close each measurement came to its budget.
2. **Given** a measurement that is passing but close, **When** the run reports, **Then** that is
   visible rather than indistinguishable from one with room to spare.

---

### Edge Cases

- **A slower machine.** A contributor's laptop is not the reference runner. A budget that only
  holds on fast hardware fails honest people and teaches them to ignore it.
- **A genuinely quadratic regression.** The scaling check exists to catch accidental quadratic
  behaviour, and must keep doing so. **An earlier draft of this edge case named the wrong cause**:
  it said the check divides by a measurement floored at 0.1 ms, so noise in the denominator
  dominates. Measured over eight isolated samples the denominator runs 0.485–3.027 ms and **the
  floor is never reached** — it is inert. What actually happens is that both measurements are under
  5 ms and taken back to back, so one scheduler preemption swings their ratio. That is contention,
  which is what FR-005 says, and it is why the ratio reads 1.48–2.06 against a limit of 6 when
  nothing else is running and 7.93 when the machine is busy.
- **A first run on a cold cache.** Compilation and module loading are not the thing being measured.
- **A performance suite that stops running at all.** Removing timing tests from one place must not
  quietly remove them from every place — a budget nothing runs is worse than a noisy one, because
  it looks like coverage.
- **A timing assertion that is not in a file named for timing.** The move is defined by where a
  file lives; the flake is caused by what a file asserts. Two files assert durations from outside
  any `perf` path, and one of them holds a 20 ms ceiling.
- **A failure that names the wrong cause.** A mechanism that cannot collect its tests and reports
  that as a budget breach costs a reader the same hour the flake costs. Determinism is not the only
  thing that makes a board readable; a true message is the other half.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A full run of the test suite on an unchanged tree MUST give the same result every
  time, once the tree has been built. **There is a second, known cause of a red board on an
  unchanged tree, and it is not this feature's**: a freshness check compares the kernel's source and
  output timestamps, and a build-cache restore can invert them — so the suite fails with a message
  telling the reader to build. It is recorded in the project's own history, it announces its own
  cause on screen, and `pnpm build && pnpm test` is reliable. This requirement covers the cause that
  does *not* announce itself. **What it does require is that the second cause cannot be mistaken for
  the first**, which means the evidence for this requirement is gathered on a built tree.
- **FR-002**: A performance budget MUST still be enforced, and MUST fail when a change makes a
  measured interaction materially slower.
- **FR-003**: Each performance budget MUST be measured in exactly one place — **the mechanism that
  owns performance**, which spawns each package's suite on its own. Measuring the same thing twice,
  under conditions that disagree, produces a result that has to be adjudicated rather than read.
- **FR-003a**: Every package whose budgets leave the ordinary suite MUST be covered by that
  mechanism **before** it leaves. One is not covered today: `@cuestack/schema`'s scaling check runs
  only in the ordinary suite, and removing it there without adding it to the gate would delete a
  budget while looking like a tidy-up — which is exactly what FR-008 forbids.
- **FR-004**: A timing measurement MUST NOT be taken while unrelated work competes for the same
  machine, or it measures the competition.
- **FR-005**: The scaling check MUST keep catching accidentally quadratic behaviour, and MUST give
  the same answer on repeated runs. An earlier wording of this requirement demanded it stop
  dividing by a measurement small enough for its own noise to dominate — prescribing a rewrite
  before anyone had established one was needed. Run on its own it passes five times out of five, so
  relocation may be the whole fix; the requirement now states the outcome and leaves the mechanism
  to whatever turns out to be true.
- **FR-006**: Where a threshold is stricter than the budget it protects, the difference MUST be
  large enough to survive ordinary variation, or it converts a margin into a source of failures.
- **FR-007**: A performance run MUST report the measured value against its budget, not only
  pass or fail.
- **FR-008**: Removing a timing assertion from one execution path MUST NOT remove it from every
  path. A budget that no longer runs anywhere MUST fail loudly rather than pass silently.
- **FR-009**: The change MUST NOT make the suite slower to run in the ordinary case, since a suite
  people avoid running is a signal nobody reads.
- **FR-010**: The repository's front page states two numbers about the test suite, and **both** are
  wrong: `| pnpm test (189 tests) | — | < 1 s |`. A full run measures 388 test files, 2900 tests,
  78 seconds. Both MUST be corrected, and the row MUST end up either maintained by a check or
  stating only what does not go stale. A number nobody maintains is the same class of claim this
  project has spent two features removing — and a *duration* nobody maintains, in the row directly
  under a timing budget, is that claim in the exact form this feature exists to fix.
- **FR-012**: The coverage floor MUST be asserted the way the constitution states it — **90% line
  and branch coverage, on `@cuestack/core` and `@cuestack/schema`** — and MUST NOT be asserted in
  dimensions it does not state. The configuration currently asserts **four metrics over four
  packages**. Two of those metrics and two of those packages are the configuration's own additions,
  and each addition fails on something the constitution does not require: the aggregate fails
  because of the two packages that are exempt by name, and `@cuestack/core` fails on `functions` at
  88.69% while clearing line and branch at 96.96% and 94.52%. Both packages that carry a floor clear
  the two metrics it is set in. **This changes no threshold's value and writes no test** — it stops
  making assertions the constitution does not make.
- **FR-012a**: Correcting how the floor is asserted MUST NOT widen which files are instrumented.
  Core's coverage scope is a five-directory slice that has been widened one feature at a time, and
  the configuration records that closing the rest is *"a decision somebody should make deliberately,
  not a side effect of an unrelated diff"*. That stands. **Measured for whoever eventually makes
  that decision**: the whole package reports 97.61% lines, 94.44% branches and 92.85% functions —
  better than the current slice on every metric but branches, where it is 0.08 lower. So the single
  sub-90 number in either package is an artifact of where the boundary was drawn, not of code that
  nobody tested.
- **FR-011**: A test that asserts a duration MUST be treated as one wherever it lives. Two files
  outside any `perf` path assert wall-clock times, and each MUST be settled: moved to the mechanism
  that owns performance, or kept with its ceiling shown to be far enough from ordinary variation
  that contention cannot reach it, and the reason recorded next to it.

### Key Entities

- **Performance budget**: a stated limit on how long something may take, owned by a success
  criterion or a constitutional principle. Exists today; this feature does not add or remove one.
- **Measurement context**: the conditions a timing is taken under — how much else is running, on
  what hardware, warm or cold. Not currently modelled anywhere, and the reason two runs of the same
  assertion disagree.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ten consecutive full runs on an unchanged built tree give ten identical results,
  **under conditions that produced failures before the change**. The build is part of the criterion,
  not a convenience: the one other recorded cause of an intermittent failure here is a stale-output
  check, and a run that trips it would otherwise be counted as this feature not having worked. The
  conditions are part of it for a sharper reason — **a baseline that does not reproduce the failure
  has not established a baseline**, and ten green runs before the change followed by ten green runs
  after it demonstrate nothing whatever. Where the failure cannot be reproduced on the machine at
  hand, that is what gets reported, rather than a matched pair of clean sweeps.
- **SC-002**: A deliberate, material slowdown is caught by the mechanism that owns performance, and
  is caught before merge.
- **SC-003**: No performance budget that exists today stops being enforced.
- **SC-004**: A developer reading a failed run can tell what broke without re-running it.
- **SC-005**: The full suite is no slower to run than it is today.
- **SC-006**: Every timing budget's measured value and its limit are both visible in the output of
  the mechanism that owns it.
- **SC-007**: Every number the repository's front page states about the test suite matches reality,
  and something keeps it that way or it does not get stated.
- **SC-009**: A failed performance run names what actually failed. A suite that could not be
  collected does not report itself as a budget that was exceeded.
- **SC-010**: When the coverage figure becomes visible, what it reports is the standard the
  constitution states — 90% line and branch on the two packages that carry a floor, and no numeric
  floor on the packages that do not — with no threshold value changed, no test written, and no
  change to which files are instrumented.
- **SC-008**: CI reports the project's coverage figure again, rather than aborting before it is
  measured. What that figure should be is out of scope; being able to see it is not. **The figure
  covers four of the six packages** — `@cuestack/element` and `@cuestack/adapter-http` are not
  instrumented at all — and saying so is part of reporting it honestly.

## Assumptions

- **It is the timing suites, and one other thing that is not.** The project has recorded exactly
  one other intermittent failure on an unchanged tree: `core-freshness.test.ts` compares the newest
  mtime in `packages/core/src` against the newest in `packages/core/dist`, and a turbo cache restore
  can leave the output older than a source file nobody changed. Its own note says it is *"recorded
  because a contributor meeting it reads it as a flake"* — which is this feature's thesis, written
  down earlier about a different cause. It is out of scope: it is pre-existing, it prints the reason
  and the fix, and building first avoids it. It is in this spec because a run of the ten that trips
  it must be diagnosed rather than counted.
- **The failures are contention, not regressions.** Every failing suite passes in isolation — the
  studio performance suite five times out of five, the schema scaling check five times out of five
  — and the failing test moves between runs. That is the signature of shared-resource interference
  rather than of code getting slower. The work should still confirm this per package rather than
  assume it: if any of it is a real regression, that is a more important finding than the flake.
- **`pnpm gates` is the mechanism that owns performance.** It is what CI enforces, it spawns each
  package's suite separately, and it already prints what it measured and against what. **Verified
  rather than assumed**: it passes on the current tree in 10.2 seconds, running all four packages'
  performance suites plus the accessibility, parity and theme gates. Making it the sole owner costs
  ten seconds in a job that already runs. The
  duplicate execution inside `pnpm test` is the part with no owner.
- **No budget changes value.** This feature is about where and how a measurement is taken, not
  about what is fast enough. Loosening a budget to stop it failing would trade a noisy signal for
  no signal, which is the outcome US2 exists to prevent.
- **The coverage floor is not this feature's to move — and there are two different things that
  look like moving it.** The flake hides the number and this work reveals it; raising coverage or
  recording a justified exception is a separate judgement nobody can make sensibly while the figure
  is unknown. Lowering the threshold to whatever is achieved would convert a standard the
  constitution sets into a description of wherever the code happens to be — the same trade this
  feature refuses for performance, and it stays refused. See Clarifications.

  **Asserting the floor the way the constitution states it is not that trade**, and FR-012 requires
  it. The constitution puts a 90% **line and branch** floor on two packages and states that UI
  packages carry none, *"behavioral tests are required instead of coverage theater"*. The
  configuration asserts four metrics over four packages. Both packages with a floor clear both
  metrics it is set in; the aggregate fails because of the two packages without one, and `core`
  fails on a metric — `functions` — that the constitution never mentions. So the number this feature reveals will read as a failure of code that is
  passing, and the only ways to answer it are to leave the board red or to chase branch coverage in
  the packages the principle exempts — which is the theater it names. Correcting the scope changes
  no threshold's value and no package's coverage. It changes which packages a number is asserted
  about, which is the part that is currently wrong.
- **The reference environment stays as it is.** Budgets are stated against the project's standard
  CI runner, and a contributor's machine is explicitly not authoritative. This feature does not
  change that and should make it clearer.
- **No new dependency.** The repository has a test runner, a gate script, and a CI workflow; the
  work is in how they are arranged.
