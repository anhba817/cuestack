# Specification Quality Checklist: A frame rate nobody has ever seen

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
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

**Re-validated after clarification (2026-08-22). 13/16 → 16/16.** Three questions asked, three
answered, and each answer narrowed the feature rather than filling a blank.

Newly passing: *no [NEEDS CLARIFICATION] markers remain*, *scope is clearly bounded*, *all
functional requirements have clear acceptance criteria* — all three had failed on the same cause.

**On "no implementation details".** The Context section names `happy-dom`, `cqw`, `domMediaPort.ts`
and a coverage percentage. That is evidence, not design: the case for funding this rests on the gap
being real and specific, and a reader owed that case is owed the measurements. No requirement or
success criterion names a tool, an engine, or a file — FR-009 names a module because the module's
current state *is* the requirement's subject.

**The user here is a developer, and the beneficiary is a teacher.** The story that matters is
"playback is smooth", which nobody can currently verify. The spec states the value where it lands
rather than pretending a learner will read a frame-timing report.

**Three markers, and all three are genuinely undecidable from context.**

- **The reference device** has no default. Constitution IV says "on the reference device" and never
  says what it is; the README defines a reference *environment* for build timing — a 4 vCPU CI
  runner — which is plainly not a device a learner holds. Choosing one changes what the number
  means and how much it can ever be trusted.
- **The scope boundary** has two defensible readings that differ by a factor of several: frame rate
  alone, or every path happy-dom cannot see. The second is where the known defects are; the first
  is what the feature is named after.
- **Gate or report** is a live tension with the constitution on one side and feature 013's evidence
  on the other. IV says budgets are acceptance criteria and a regression is reverted. 013 has just
  demonstrated what a timing threshold does to a board when its variance is not understood — and
  frame timing is noisier than the budgets it removed. FR-007 keeps that honest whichever way the
  question is answered, but the answer decides whether CI can go red on this.

**FR-006 is the requirement most likely to be quietly dropped.** It says the browser check must not
join the ordinary suite. That is not caution — it is the finding feature 013 spent six analysis
passes and a 632-line discovery reaching, and this feature adds something far heavier than what was
removed.


---

**What the three answers changed.**

**Two references, not one.** A single CI figure would have been cheaper and would have quietly
become "the frame rate" — a datacentre VM with no GPU standing in for a classroom tablet. FR-010
keeps them apart by requiring every measurement to say which it is, and FR-010a forbids an unnamed
baseline, because a number without a subject is the same defect as a measurement without conditions.

**The scope answer doubled the feature and was still right.** Frame rate alone would have left a
real browser running while `domMediaPort.ts` stayed at 0% branch coverage with no test referencing
it — paying the cost of the feature and skipping its main benefit. US2 is now half the work.

**Reporting first is the answer this project earned.** Constitution IV calls its budgets acceptance
criteria and says a regression is reverted, which argues for gating immediately. Feature 013 has
just spent six analysis passes removing a timing threshold whose variance nobody had measured, and
frame timing is noisier than anything it removed. FR-007 requires measuring the spread; FR-012 makes
arming a threshold a separate deliberate act on that evidence. The assumption added alongside it
says the quiet part: reporting forever is a check nobody reads, so this is a starting posture with
a successor, not a permanent exemption.

**Still the requirement most likely to be quietly dropped: FR-006** — the browser check must not
join the ordinary suite. Feature 013 reached that finding through a 632-line discovery nobody had
looked at, and this feature adds something far heavier than what was removed.

---

**Re-validated after `/speckit-clarify` (2026-08-22). 16/16 → 16/16. No item changed state, and that
is the interesting part.**

Five questions were asked and answered, each one settling a decision that materially changes the
work: the statistic compared to the constitution's numbers, how the media adapter leaves the
coverage report, what lesson is actually played, how many engines are involved, and which device the
baseline stands for. None of them was a `[NEEDS CLARIFICATION]` marker, because none of them looked
like a gap — the spec read as complete at 16/16 while leaving all five open.

**So a full checklist is not the same as a specified feature.** These items ask whether requirements
are testable and whether scope is bounded, and the spec passed both while saying "measured against
Constitution IV's 60 fps target" without saying which frame. That sentence is testable-looking and
unbuildable. The checklist cannot catch a question nobody thought to ask, which is the same shape as
the finding feature 013 recorded five times over: an artifact checked only against other artifacts.

**Two answers changed the spec's structure rather than filling a blank.**

- **FR-009 became unsatisfiable on its own, deliberately.** It said the media adapter must gain
  coverage *or* an exemption. But the coverage report comes from a Node run that a browser check
  never feeds, so "exercise it in a browser" and "raise its coverage number" turned out to be
  different things that the spec had treated as one. It now requires the exemption *and* names
  FR-011 as the evidence that makes the exemption honest — a module excused from coverage and
  exercised by nothing would be worse off than it is today.
- **FR-011a splits the engine count against the feature's own seam.** One engine for timing, three
  for behaviour. The two halves wanted opposite answers and a single figure would have hidden that:
  three frame numbers are three unrelated numbers, while a media adapter checked only on Chromium is
  checked on the most permissive engine of the three.

**One assumption was added that nobody asked for**, because the answer to Q5 implies a limit worth
stating: CPU throttling stands in for a device but is not one. A throttled desktop keeps the
desktop's memory bandwidth, GPU and display pipeline, so the baseline figure estimates a school
laptop rather than measuring one. Reporting it as a measurement would be the same category of error
as reporting the CI figure as a claim about learners.


---

**Re-validated after `/speckit-analyze` (2026-08-22). 16/16 → 16/16. Two findings were
unimplementable-as-written, and both came from running things rather than reading them.**

**The harness could not have been built.** Both plan and tasks said "load built `dist`, because that
is what a host gets". A browser resolves none of what `dist` imports — `@cuestack/core`, `react`,
`react/jsx-runtime`, `@cuestack/schema/validate` are all bare specifiers. The justification was
wrong too: what a host gets is `dist` *through a bundler*, and the thing in this repository that
already does that is the example app. So the React harness is a route in it, and the element harness
is a static page with a five-entry import map — which is not a workaround but the way a web
component is meant to be consumed. **No bundler is added**, and that matters: `vite` is not
resolvable at the workspace root, so reaching for it would have been a second build dependency
alongside Playwright.

**A test task would have produced a file nothing runs.** T008 placed a unit test at
`tools/browser/__tests__/`, and the `gates` project collects only `tools/scripts/__tests__/**`. It
would have been written, reviewed, and never executed — this feature's own subject applied to
itself, and the mirror image of what feature 013 found one directory in the other direction. Fixed,
and it forced a better design: `measure.mjs` must expose the statistics as a pure function so the
arithmetic is testable without launching a browser.

**FR-012a exists because FR-012 breaks something somebody wrote on purpose.** `ci.yml` opens with
*"Every job here is blocking. No `continue-on-error` appears in this file and none should: a gate
that tolerates failure is documentation, not a gate."* That is correct, and so is FR-012 — a
threshold armed before its variance is known is the flake feature 013 removed. The two had simply
never met. The exception now has to be written into that comment with the condition that ends it,
because an invariant with an unexplained exception is not one.

**And the inventory was wrong again, in the same shape as feature 013's.** Container units live in
four files across three packages, including `packages/react/src/player/Stage.tsx` — the primary
player — not only in `packages/element/src/styles.ts`. The two-harness split survives on a better
reason (each adapter is consumed differently), but a layout assertion written from the old inventory
would have tested the adapter that is not the main one. **A design decision resting on an incomplete
look is the recurring defect in this repository, and this is its fifth appearance.**


---

**Re-validated after a second `/speckit-analyze` (2026-08-22). 16/16 → 16/16. Every finding was
something the previous remediation created.**

**The fix for A1 created B2.** Moving the React harness into the example app solved the
bare-specifier problem and did not answer how `heavyLesson()` reaches the route —
`tools/scripts/fixtures/` is in neither that app's dependency graph nor its tree. A relative import
four levels up "may work under Next's bundler", which is precisely the phrase R-08 was written to
eliminate, so it could not be the answer here either. R-09 generates the fixture into `public/` and
carries the constraint that matters more than the mechanism: **Gate 12 builds that app on every CI
run and knows nothing about this feature**, so the route must render a notice when the file is
absent rather than break an existing gate for an unrelated reason.

**The fix for A2 half-created B4.** Moving the unit test somewhere a project collects it was right,
and "expose the computation as a pure function" stopped one step short of saying *where*. Importing
`measure.mjs` to test arithmetic would pull Playwright into every `pnpm test` — the suite feature
013 took from 77 s to 10 s, and the one FR-006 exists to keep this feature out of. The statistics now
live in their own module.

**And B1 is the check from feature 013 working exactly as built.** The README states 379 test files
in two places and `readme-claims.test.ts` asserts both; T008 makes it 380. That check caught its own
author twice during 013's implementation and has now caught a task list written three features later.
The remediation is one clause in T008 — but unstated, an implementer meets a red board in the middle
of an unrelated task and has to work out why.

**B3 is pnpm's strict layout, twice.** `vite` is not resolvable at the workspace root and `zod`
resolves to a version-numbered path under `.pnpm/`. Neither is a path that may be written down; both
have to be resolved. The first ruled out a bundler, the second shapes `serve.mjs`.

**Two passes, and the pattern is stable: every finding this time was downstream of last time's fix.**
That is the question worth keeping — not "what is wrong with this document" but "what did the last
correction put here".


---

**Re-validated after a third `/speckit-analyze` (2026-08-22). 16/16 → 16/16. The main finding was a
mechanism invented while the answer sat one file away.**

**R-09's first version generated a fixture into `public/` and had the route fetch it.**
`examples/nextjs/app/page.tsx` line 2 has always read:

```ts
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }
```

A static JSON import. The invented version silently took on three things the existing one does not:
`public/` does not exist, nothing gitignores it (`git check-ignore` returns no rule), and
`app/page.tsx` is a **server component** — a same-origin fetch at prerender time has no server to
answer it. It would have needed `'use client'` and an effect, or `force-dynamic`.

**The corrected version deletes work rather than adding it.** A static import removes the directory,
the gitignore rule, the fetch, the server/client question, and the "render a notice when the file is
absent" requirement — that last one only existed because Gate 12 builds this app on every CI run and
would otherwise have broken.

**And it inherits this repository's standing answer to committed artifacts.** 86KB of JSON beside the
function that produces it is two sources of truth and will drift, so one assertion checks it — the
same shape as `core-freshness.test.ts`, `check-data-model` and `check-agreement`. It lives in the
same file as the statistics assertions so the README's test-file count moves once rather than twice,
which is itself a consequence of the check feature 013 built.

**Placement mattered more than it looked.** `packages/schema` is public with
`"files": ["dist", "fixtures"]`, so the obvious home would have shipped 86KB to every consumer of
the schema package for the benefit of one private demo.

**Three passes, three findings downstream of the previous fix, and the same root cause each time**: a
decision made without looking at what the codebase already does. Sixth appearance. The question that
keeps paying is not "is this document consistent" but "does this exist already, and did anyone
check".


---

**Re-validated after a fourth `/speckit-analyze` (2026-08-22). 16/16 → 16/16. No critical issue; the
yield has flattened to corrections of emphasis and one stale number.**

**The example app is built by `pnpm build`, not just by Gate 12.** `examples/*` is a pnpm workspace
member with a build script — `turbo run build --dry` lists seven building packages and
`@cuestack/example-nextjs` is one. Every artifact had framed the perf route's blast radius as a
single CI job. It is actually every contributor's build, CI's first gate before typecheck, and this
feature's own sweep. Nothing in the design was wrong — pass 3's static import is exactly what makes
that safe, because there is nothing left to be absent — but **T003's stakes were understated by an
order of magnitude**, and a task nobody treats carefully is where the mistake goes.

**`README.md:54` still says `pnpm build` covers 5 workspace projects. It is 7.** That line sits in
the same table whose two other figures feature 013 corrected and placed under
`readme-claims.test.ts`. The asymmetry is worth naming: **one unchecked number beside two verified
ones is worse than three unchecked**, because the verified neighbours lend it credibility it has not
earned. T027 corrects it and adds the assertion — an edit to an existing test file, so the test count
does not move a second time.

**And the freshness assertion rests on something now verified rather than assumed.**
`heavy-lesson.mjs` has no `Math.random`, `Date.now`, `new Date`, `performance.now`, `process.env` or
`crypto`, and two calls produce byte-identical output at 87,944 bytes. Recorded so that if
variability is ever introduced, the reason that check exists is on record instead of being
rediscovered when it starts flaking.

**Four passes: two criticals, then none, none, none.** The first two passes found things that would
have stopped implementation — a harness that could not load, a test nothing would run. The last two
found a mechanism invented beside an existing one, and an understated blast radius. That is a
reasonable place to stop looking and start building.
