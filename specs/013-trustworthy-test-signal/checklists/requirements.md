# Specification Quality Checklist: A red board means something is broken

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

**Re-validated after clarification (2026-08-21).** Two questions asked; sixteen items still pass.
Both answers narrowed scope rather than filling a blank, and each turned up a fact that changes the
work:

- Timing assertions move to the gate — **and `@cuestack/schema` is not in the gate today**, so
  moving its perf test without adding it there would delete a budget while looking like a tidy-up.
  FR-003a now says so.
- CI runs `pnpm test:coverage`, which fails on this flake **before coverage is evaluated at all**.
  So the flake is hiding the project's coverage standing, and the 89.03% figure everyone quotes was
  measured locally rather than reported by the gate meant to report it. SC-008 makes visibility the
  deliverable; moving the number stays out of scope.

**A third question was answered by measurement instead of being asked.** Whether the scaling check
needed reshaping or merely relocating was genuinely uncertain — so it was run in isolation five
times, passed five times, and FR-005 was rewritten to state the outcome rather than mandate a
rewrite nobody had shown was necessary. A requirement that prescribes a fix before the diagnosis is
a requirement that can be satisfied and still be wrong.

**On "no implementation details".** The Context section names files and numbers —
`gates/perf.mjs`, the `test/**` glob, 93.3 ms against 90. That is evidence, not design: the case
for funding this rests on the failures being real and non-random-looking, and a reader owed that
case is owed the measurements. No requirement or success criterion names a file, a runner, or a
configuration.

**The developer is the user here, and that is deliberate.** Every other feature in this repository
has a learner or a teacher at the end of it. This one does not, and pretending otherwise would
produce a vague spec. The value is stated where it actually lands: a signal people can act on, and
a regression that gets caught.

**US2 exists because the obvious fix is the wrong one.** The cheapest way to stop timing tests
failing is to loosen or delete them, which trades a noisy signal for no signal at all —
Constitution IV makes performance a contract. The spec makes "the budget still catches a real
regression" a P1 story of its own so that outcome cannot be reached by accident.

**One assumption is load-bearing and should be checked first, not assumed.** The spec takes the
failures to be contention rather than regressions, on the evidence that every suite passes in
isolation and the failing test moves between runs. If part of it turns out to be a genuine
slowdown, that is the more important finding and this feature's shape changes.

**FR-010 is not scope creep.** The repository's front page states `| pnpm test (189 tests) | — |
< 1 s |` against a measured 388 files, 2900 tests, 78 seconds. It sits inside the same table as the
build-timing budgets this feature is about, it is the same class of unmaintained claim the last two
features spent their time removing, and leaving it while rewriting the surrounding section would be
choosing not to see it. **Both halves of the row are wrong**, and a stale duration directly beneath
a timing budget is this feature's own subject stated about itself.

---

**Re-validated after analysis (2026-08-21). Sixteen items pass; two requirements were added and
one number in these notes was wrong.**

The pass checked the artifacts against the tree rather than only against each other, and four
claims were tested by running them. Two were false:

- **The mechanism did not work.** Excluding the performance files from the workspace projects — the
  plan's stated fix — also removes them from the gate, because the gate reaches them through
  `--project` and a project's own exclude decides its file set. The one-line diff would have
  produced a red gate blaming a budget for a file it never opened. The spec is unchanged by this;
  it is a plan-level correction, and it is why **SC-009** now exists: a failure that names the
  wrong cause is its own defect, separate from the flake.
- **The inventory was short by a file.** Ten files carry these budgets, not nine. The count of nine
  was exactly what the candidate patterns catch, which is the trap: an inventory derived from the
  pattern meant to move something cannot report what the pattern misses.

**FR-011 was added** for two files that assert durations from outside any `perf` path, one of them
at 20 ms. The move is defined by where a file lives and the flake is caused by what a file asserts,
so a path-shaped rule was always going to leave some behind — and SC-001 asks for ten identical
runs of the *whole* suite, which one straggler can deny.

**And these notes said 2899.** A full run measures 2900. The number moved between writing the spec
and analysing it, which is the argument for SC-007's second clause better than any prose: a figure
corrected by hand is stale at the next commit.

---

**Re-validated after a second analysis pass (2026-08-21). Sixteen items pass. Two requirements
added; four claims corrected, three of them by measurement.**

**The pass-2 finding is about a floor, not a flake.** SC-008 makes the coverage number visible, and
the number that becomes visible is asserted over the wrong set of packages. `vitest.config.ts` has
one `thresholds` block with no glob keys, so Vitest applies 90% to the aggregate of everything
instrumented — `core`, `schema`, `react`, `studio`. Constitution II sets that floor for the first
two and says the others carry none. Measured: core 94.52% branches, schema 91.41%, react 87.52%,
studio 87.56%. **Both packages with a floor clear it; the aggregate fails because of the two
without one**, and the file's own comments already claim to be scoped the correct way.

That made the previous draft's guidance actively wrong. "Do not answer a newly-visible coverage
failure by adjusting the threshold" is right about the trade it names and it also forbade the only
correct answer, leaving an implementer with an indefinitely red board or branch-chasing in the
packages the principle excuses — the coverage theater II names in the same sentence. **FR-012** and
**SC-010** now separate the two moves: a threshold's *value* stays out of scope, the *set of
packages it is asserted over* is a defect this feature surfaces and must not leave miscoped.

**Three claims were settled by running something rather than reasoning about it.**

- The scaling check does **not** divide by a floored measurement. Eight isolated samples put the
  denominator at 0.485–3.027 ms; the 0.1 ms floor is inert. The ratio reads 1.48–2.06 against a
  limit of 6, and the 500 ms validation budget completes in 0.524 ms. So FR-005 is satisfied by
  relocation with a *number* rather than a pass count — and the edge case that named the floor was
  describing a mechanism that does not exist.
- The exclusion **does** cost coverage, in one package: react 87.76 → 87.52 branches, core and
  schema unchanged. Small, and it means part of any post-feature shortfall is caused here rather
  than revealed here. T013a records it so the two do not arrive as one number.
- Expanding the `packages/{schema,core,adapter-http}` glob into explicit projects is safe: none of
  the three has a test file outside `test/`, and there are no `.spec.ts` files in any of them.

**And these notes said eighteen items where sixteen exist** — written in the pass that corrected a
count claim in the README. A checklist is not exempt from the thing it is checking for.

---

**Re-validated after a third analysis pass (2026-08-21). Sixteen items pass. Two requirements added;
the previous pass's own fix was half-finished.**

**Pass 2 recommended a mechanism without testing it, which is the mistake pass 1 existed to catch.**
Glob-keyed coverage thresholds were proposed as the fix for FR-012 and then verified:

| Threshold block | Result |
|---|---|
| glob entries only | passes — files outside every glob are held to nothing |
| glob entries **plus** the global numbers | fails — the global numbers still bind the aggregate |
| a glob entry at 99% | fails, naming the glob — the control bites |

The mechanism works. **The prediction about what it would produce was wrong.** T023 said a correctly
scoped gate "should pass on their own numbers", and with the configuration's four metrics it does
not: `@cuestack/core` reports `functions` at 88.69%. Constitution II sets *"90% line and branch"* —
two metrics, not four. So the threshold block is wrong in two dimensions and pass 2 fixed one.
**FR-012** now covers both, and T022 says *replace* rather than *scope*, because a glob entry added
beside the global numbers is the reading most people would take and it changes nothing.

**FR-012a exists to stop a two-line correction becoming a decision nobody asked for.** Core's
instrumented scope is a five-directory slice widened one feature at a time, and the configuration
already records that closing the rest is deliberate work for someone else. The measurement is kept
anyway because it reframes that work: the whole package reports 92.85% functions against the slice's
88.69%, better on three metrics of four. **Core's only sub-90 number is an artifact of where the
boundary was drawn, not a coverage debt.**

Three passes, and each one found that the previous pass's fix was true but incomplete in the
dimension nobody had measured yet: the file inventory, then the package scope, then the metric set.
The pattern is worth naming — a correction derived from the same document that contained the error
inherits its blind spot.

---

**Re-validated after a fourth analysis pass (2026-08-21). Sixteen items pass. No critical issue —
the first pass that has been able to say so.**

The three previous passes each closed the dimension they opened, so this one went looking somewhere
else: what else in the suite depends on the wall clock, and whether anything actually runs.

- **`pnpm gates` had never been run.** It is the mechanism the entire design makes the sole owner of
  performance, its passing is a stated assumption, and four passes of analysis had taken it on
  trust. It passes, in **10.2 seconds**, running all four packages' performance suites plus the
  accessibility, parity and theme gates. The gate's core filter collects three files, which
  confirms the inventory correction from pass 1 against the runner rather than against a document.
- **A rule was being enforced next door and nobody had looked.**
  `packages/core/test/harness/duration.test.ts` fails if a test file references `setTimeout`,
  `setInterval`, `vi.advanceTimersByTime` or `await new Promise` — Constitution II in executable
  form, for **one package of six**, under an assertion named *"no test file references a real
  delay"*. It made a sentence in the contract false, and it showed that FR-011 was a one-time sweep
  in a feature whose thesis is that one-time sweeps decay. **FR-011a** now requires a check.
- **A third shape of wall-clock dependence had no name.** `vi.waitFor` asserts no duration, so a
  requirement written about duration assertions missed it — and a 1000 ms deadline fails under
  contention for exactly the same reason, because a deadline is a duration somebody else wrote
  down. FR-011 now covers both.

**And the check FR-011a asks for is deliberately narrow.** Widening the existing one would produce
sixteen hits outside core, most of them legitimate async flushes — a check that cries wolf fifteen
times is a check somebody turns off. The rule is stated precisely enough to reproduce the manual
sweep exactly: `performance.now()` paired with an upper-bound assertion, outside the performance
config, two files. T011a requires confirming it names those two and not fewer.

---

**Re-validated after a fifth analysis pass (2026-08-21). Sixteen items pass. One high finding, from
the only place nobody had looked: what the project had already written down about itself.**

**There is a second cause of a red board on an unchanged tree, and it was recorded a feature ago.**
`packages/react/test/harness/core-freshness.test.ts` compares the newest mtime under
`packages/core/src` with the newest under `packages/core/dist`, and a turbo cache restore can invert
them. `docs/cuestack_framework_plan.md` records it as intermittent, notes that
`pnpm build && pnpm test` is reliable, and says it was written down *"because a contributor meeting
it reads it as a flake."*

**That sentence is this spec's thesis, written earlier about a different cause** — and this spec had
not noticed it. The consequence was concrete rather than philosophical: T001 and T012 produce SC-001's
evidence by running `pnpm test` ten times, and neither built first. A cache restore during the ten
would have polluted the baseline, and a failure in T012 would have been read as *the fix did not
work* while the screen said *run `pnpm build`* — the same misdiagnosis this feature exists to
prevent, produced by this feature's own acceptance procedure.

It stays out of scope: it is pre-existing, it announces its own cause and fix, and building avoids
it. **FR-001 now says which cause it covers**, SC-001 makes the build part of the criterion, and
R-12 records why. The search was exhaustive — the framework plan, every document under `docs/`,
every package README and `CLAUDE.md` — and this is the only other recorded instance.

**And one thing specified last pass was verified rather than trusted.** FR-011a's rule matches
exactly the two files the manual sweep found, and no test anywhere uses `Date.now()` or
`process.hrtime` for timing, so it needs no second clause. It reproduces the sweep instead of
approximating it, which is what makes it worth enforcing.

Five passes. The first four each found the previous fix incomplete in a dimension nobody had
measured; this one found a dimension the project had already documented and the feature had not
read. Both failure modes are the same shape — **an artifact checked only against other artifacts** —
and the answer both times was to go and look at something outside the feature's own paperwork.

---

**Re-validated after a sixth analysis pass (2026-08-21). Sixteen items pass. The high finding is in
this feature's own acceptance criteria.**

**Six consecutive full runs of the unfixed tree passed** — 2900 tests, ~77 s each, on 28 cores at a
load average of about 3. Against the recorded premise of three runs giving two failures, that is not
a near miss: at a 2-in-3 rate the odds are about one in eight hundred. The rate did not drift; the
conditions did. The original runs were taken while the same machine was building and typechecking.

**That is the contention diagnosis surviving a test it could have failed**, and it is also a hole in
how the fix was to be measured. SC-001 is a before-and-after claim gathered by running the suite ten
times before and ten times after. On a quiet machine the before is 10/10, the after is 10/10, the
comparison shows no change, and **the evidence looks identical to the evidence for having done
nothing at all**.

So **a green baseline is now stated as a failed measurement**, in SC-001, T001 and T012: it means the
conditions did not reproduce the problem, and the correct response is to reproduce the load or to
report that this machine cannot demonstrate the criterion — not to run ten more afterwards and
present the match as a result.

Six passes have been spent finding checks that pass for the wrong reason. This one was in the
acceptance criteria of the feature doing the finding.

**And the feature branch did not exist.** Both `spec.md` and `plan.md` named
`013-trustworthy-test-signal`; `HEAD` was `main`, where seven prior features each have a branch. It
exists now. Related and worth recording: `011-docs-and-web-components` and `012-learner-navigation`
are both ancestors of `main`, and `main` is level with `origin/main` — the "committed but unpushed"
state noted earlier is stale.
