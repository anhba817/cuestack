# Feature Specification: A frame rate nobody has ever seen

**Feature Branch**: `014-browser-playback-check`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "the browser playback check"

## Context

The performance gate says this on every run, in its own output:

> This measures the player's own work — resolve, compose, frame writes, React commit — and **NOT
> paint**. happy-dom has no compositor, so a browser-based check is still required before claiming
> a frame rate. **A pass here is not that claim.**

It has been saying it since Wave 3. Nobody has taken it up, and there is no browser anywhere in this
repository: no Playwright, no Puppeteer, no WebDriver. Every one of the 379 test files runs in
Node or in happy-dom, which computes no layout, paints nothing, and reports a `<div>` with an
explicit `width: 800px` as having a bounding rectangle of zero.

**So Constitution IV has a row nothing verifies.** *"Playback: 60 fps target, 30 fps floor on the
reference device."* The gate's proxy is a good one and it is honest about being a proxy: it measures
everything the framework controls and nothing it does not. But the product's differentiating claim
is precise timing, and a teacher does not experience resolve-and-commit — they experience whether
the slide moved smoothly. That layer has no evidence behind it at all.

**Four things are invisible for the same reason**, and they are not obscure corners:

| What | Why happy-dom cannot see it |
|---|---|
| Whether a frame is actually painted in time | there is no compositor |
| Canvas-relative layout, 9 uses of container-query units | `cqw` is never evaluated |
| 13 CSS transitions and animations | no style resolution over time |
| `domMediaPort.ts` — the real media adapter | needs real `<video>`/`<audio>` elements and their events |

That last one is measured rather than asserted: it reports **21.27% of statements and 0% of
branches**, and no test references it directly — the coverage it has comes from being imported. Its
sibling `browserPorts.ts` is excluded from coverage entirely, with the reason written in the config:
*"coverable here only by asserting that happy-dom's `document` behaves like a browser's — which
would test happy-dom."* That reasoning is correct, and it applies equally to `domMediaPort.ts`,
which was never given the same exemption. It just sits in the report at zero.

**And a deferred decision is blocked on a measurement that cannot currently be taken.** The
canvas/WebGL render path is parked with the re-open condition *"that measurement, not before"* — and
the measurement is the one no runner in this repository can make.

**Feature 013 is the cautionary tale, not a template.** It has just finished removing a timing
signal that had become noise: the same commit passed or failed six times in ten because budgets were
measured while a dozen suites competed for the same cores. A browser frame-rate measurement is
noisier than anything 013 dealt with. Whatever this feature builds has to be trustworthy on the day
it goes red, or it will be ignored and then removed — which is worse than not having it.

## Clarifications

### Session 2026-08-22

- Q: What counts as "the reference device" for a frame-rate claim? → A: **Two figures, each with one
  job.** An unthrottled run on the project's standard CI runner detects regressions; a throttled run
  approximating a named consumer baseline is what a claim about a learner's experience may be made
  from. Neither may be presented as the other. A single CI number would have been cheaper and would
  have quietly become "the frame rate", which is the misreading the whole feature exists to stop.
- Q: Does this cover frame rate only, or everything happy-dom cannot see? → A: **Both.** Frame rate
  answers the constitution's open row; the browser-only paths are where the defects actually are —
  the media adapter is at 0% branch coverage with no test referencing it. Closing one without the
  other would leave a real browser running and the code most needing it still unexercised.
- Q: Which statistic is compared to the 60 fps target and the 30 fps floor? → A: **Two statistics,
  one per number.** The **median** frame time answers the 60 fps target; the **count of frames
  exceeding the 30 fps floor** answers the floor, with its allowed bound set later from the variance
  FR-007 measures rather than guessed now. A mean would let a lesson that stalls once per slide pass
  while reading as broken to a teacher, and the repository already works this way: the playback
  budget takes medians over many runs and adds a separate worst-case bound, because *"a learner
  scrubs to one slide, not to the median of eight."*
- Q: Does a browser result block a merge or report alongside one? → A: **Report first; gate once the
  variance is known.** FR-007 requires measuring run-to-run spread before any threshold is enforced,
  and arming one is a separate deliberate act with a date on it. Feature 013 has just finished
  removing a timing threshold whose variance nobody had measured, and frame timing is noisier than
  anything it removed.

- Q: How does `domMediaPort.ts` stop being reported at 0% branch coverage, if the browser run does
  not feed the coverage report? → A: **The documented exemption its sibling already has**, with the
  browser check named as its evidence. `browserPorts.ts` carries exactly this reasoning in the
  config today — *"coverable here only by asserting that happy-dom's `document` behaves like a
  browser's, which would test happy-dom"* — and after FR-011 this module gains something the
  precedent never had: a real engine exercising it. Merging browser coverage into the Node report
  was the alternative and buys an instrumentation pipeline for a number the constitution sets no
  floor on for UI packages.

- Q: What lesson does the browser play while frames are counted? → A: **Each reference carries the
  subject that fits its job**, which costs no extra runs beyond the two already chosen. The
  unthrottled CI run plays the **heavy fixture** — 50 slides, 300 elements, the same shape every
  existing budget uses and deliberately dense, so the browser figure stays directly comparable to
  the proxy figure and the difference is what paint costs. The throttled baseline run plays the
  **example app's tour lesson**, because a claim about a teacher's experience can only honestly be
  made about a lesson someone would sit through.

- Q: How many browser engines does the check run against? → A: **One for timing, all three for
  behaviour.** Frame timing is engine-specific enough that three numbers would be three unrelated
  numbers, and a single engine keeps the figure comparable run to run — which is what FR-007's
  variance work depends on. The browser-only behaviour paths go the other way: autoplay policy,
  media events and container-query layout are exactly where engines disagree, and a media adapter
  at 0% branch coverage verified only on Chromium would be verified on the most permissive of the
  three.

- Q: Which device is the named consumer baseline meant to represent? → A: **A several-year-old
  school laptop or mid-range Chromebook**, approximated by roughly 4x CPU throttling. That is who
  actually presents a lesson — far more often than a current developer machine — and it is the
  reading that gives Constitution IV's 30 fps *floor* meaning: a floor only says something if the
  baseline is a device that can plausibly reach it and not much more. A current mid-range laptop
  would make the claim true and uninformative; a low-end tablet is the most defensible target and
  the most likely to reveal that playback cannot currently meet the constitution, which is a finding
  worth having but too large to take on inside this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The frame-rate claim has evidence (Priority: P1)

Somebody asks whether Cuestack actually plays a lesson at 60 fps. Today the honest answer is "the
player's own work fits inside a frame, and nobody has looked at the rest". After this, there is a
number, taken in a real browser, against the constitution's row.

**Why this priority**: It is the feature. Constitution IV calls its budgets acceptance criteria
rather than aspirations, and one of them has never been accepted or rejected because nothing could
measure it.

**Independent Test**: run a lesson in a real browser and read the frame timings against the 60 fps
target and the 30 fps floor.

**Acceptance Scenarios**:

1. **Given** a lesson playing in a real browser, **When** the check runs, **Then** it reports the
   measured frame timing against the constitutional target and floor.
2. **Given** a change that makes painting materially slower, **When** the check runs, **Then** the
   result reflects it rather than staying green because the player's own work was unchanged.
3. **Given** no such change, **When** the check runs repeatedly, **Then** it gives the same answer
   — or reports its own variance honestly enough that a reader knows what "the same" means.

---

### User Story 2 - The code only a browser can exercise gets exercised (Priority: P1)

The real media adapter, canvas-relative layout, and the transitions a learner actually sees are run
against a real engine rather than against a simulation of one.

**Why this priority**: Also P1, and it is the half with defects waiting in it. A media adapter at 0%
branch coverage is not a coverage statistic — it is the component that decides whether a video
starts, and nothing has ever run it.

**Independent Test**: the browser check exercises those paths, and a deliberate break in one of them
is reported.

**Acceptance Scenarios**:

1. **Given** a lesson with media, **When** it plays in a real browser, **Then** the media adapter's
   real paths run and their behaviour is asserted.
2. **Given** a slide authored at a canvas position, **When** it renders in a real browser at two
   different viewport sizes, **Then** the element lands where the author placed it, proportionally.
3. **Given** a learner who prefers reduced motion, **When** a transition would play, **Then** the
   preference is honoured in a real engine rather than in a stub.

---

### User Story 3 - A pass says what it covered (Priority: P2)

A reader of a green result can tell which claims it supports and which it does not.

**Why this priority**: Lower, because a lesson does not depend on it — but the gate this feature
extends already models the behaviour, and the reason it does is that its own predecessor was read as
a fuller answer than it was.

**Acceptance Scenarios**:

1. **Given** a passing browser check, **When** a developer reads its output, **Then** the measured
   values and the conditions they were taken under are both visible.
2. **Given** a claim the check does not cover, **When** the output is read, **Then** that limit is
   stated rather than left to be inferred from a green line.

---

### Edge Cases

- **A headless browser is not a phone.** A frame rate measured on a CI runner says little about a
  classroom tablet, and a check that implies otherwise is worse than none.
- **A baseline that cannot meet the constitution.** Throttling to a school laptop may show playback
  missing the 60 fps target, or the 30 fps floor. That is a finding to report, not a reason to
  soften the baseline — and it is the most valuable thing this feature could discover.
- **Frame timing is noisy by nature.** Compositor scheduling, GPU availability and background tabs
  all move the number. Feature 013 removed a timing signal for less variance than this.
- **A browser that never launches.** A check whose runtime is missing must fail loudly, not skip
  silently — the failure mode this repository has now found four times.
- **Media that cannot autoplay.** Browsers block audible playback without a gesture; a check that
  waits for a video that will never start hangs rather than fails.
- **A first run on a cold profile.** Extension-free profiles, font loading and JIT warm-up are not
  the thing being measured.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Playback MUST be measured in **one** real browser engine — the same one every time,
  because a frame figure is only comparable to itself — and reported as two statistics:
  - the **number of frames exceeding the 30 fps floor**, against that floor. This is the statistic
    the browser check owns.
  - the **median frame time**, reported for the record but **not** compared to the 60 fps target.
    Building this showed why: `requestAnimationFrame` deltas measure frame *pacing*, which is
    pinned to the display refresh interval whenever nothing is dropped. Measured, it reads 16.70 ms
    unthrottled and 16.70 ms at 4x CPU, with **zero spread across ten runs**. It cannot
    discriminate, and comparing a constant to a constant is not a check.
- **FR-001a**: The 60 fps target stays owned by the existing performance gate, which measures the
  player's *work per frame* rather than the interval between frames. **The two mechanisms answer
  different halves of Constitution IV and neither replaces the other**: the gate says whether the
  framework's own work fits in a frame, and the browser check says whether the compositor actually
  delivered one. The original wording assigned both halves to the browser and was wrong about the
  second.
- **FR-001b**: A measurement of a page that did not change MUST be refused rather than reported.
  An idle page reports a flawless frame rate, because rAF ticks at the refresh rate whether or not
  there is work to do — the first run of this check produced exactly that, at 1x and 4x alike, and
  it looked like success.
- **FR-002**: The measurement MUST state the conditions it was taken under, because a frame rate
  without a device is not a claim.
- **FR-003**: The check MUST exercise the paths that exist only in a browser — the real media
  adapter, canvas-relative layout, and transitions — rather than only measuring frames.
- **FR-004**: A result MUST report what it measured, not only whether a threshold was met, and MUST
  state which claims it does not cover.
- **FR-005**: A check that cannot run — no browser, no engine, no lesson — MUST fail loudly rather
  than pass having measured nothing.
- **FR-006**: The check MUST NOT be added to the ordinary test suite. Feature 013 removed timing
  from that suite because a measurement taken against competing work measures the competition, and
  a browser is heavier than anything it removed.
- **FR-007**: Before any threshold is enforced, its run-to-run variance MUST be measured and
  recorded. A threshold set without knowing the variance is the flake feature 013 spent itself
  removing, reintroduced at a larger scale.
- **FR-008**: The existing gate's honest disclaimer MUST be updated to reflect whatever this feature
  does and does not close. It currently says a browser-based check is still required; if that stops
  being true in part, the output must say which part.
- **FR-009** *(deferred — not met)*: `domMediaPort.ts` MUST leave the coverage report, carrying the documented exemption
  its sibling `browserPorts.ts` already has, and the exemption MUST name the browser check as what
  exercises it instead. Sitting in the report at 0% branches, meaning neither tested nor excused, is
  the state this feature exists to end. **The exemption is only honest once FR-011 is true** — a
  module excused from coverage and exercised by nothing is a worse position than the one it is in
  today, so this requirement is not satisfiable on its own.

- **FR-010**: Every playback measurement MUST state which of two references it was taken against,
  and the two MUST NOT be conflated:
  - an **unthrottled run on the project's standard CI runner**, playing the **heavy fixture** (50
    slides, 300 elements), whose job is detecting regressions and which is explicitly not a claim
    about any learner's device. The fixture is the one every existing budget uses, so this figure
    sits directly beside the proxy figure and the gap between them is what paint costs;
  - a **throttled run approximating a named consumer baseline**, playing the **example app's tour
    lesson**, which is the only figure a claim about a teacher's experience may be made from. A
    synthetic stress fixture cannot support that claim however carefully it is measured.
- **FR-010a**: The consumer baseline is **a several-year-old school laptop or mid-range Chromebook**,
  approximated by roughly 4x CPU throttling, and both the device class and the throttling that
  stands in for it MUST be written down where the figure is reported. An unnamed baseline is a
  number without a subject — the defect FR-002 exists to prevent, one level up. The multiplier is a
  starting approximation, and if the first measurements show it does not represent that class, the
  right correction is to the multiplier, **not** to the device class it stands for.
- **FR-011** *(partially met)*: The check MUST cover the paths that exist only in a real engine as
  well as frame rate: the real media adapter, canvas-relative layout at more than one viewport size,
  and reduced-motion handling. **Layout and media rendering are covered; reduced motion is
  deferred** — four assertions for it were written and each was disproved by deliberate breakage. Running a browser and leaving the code that most needs one unexercised would spend the
  cost of this feature without collecting its main benefit.
- **FR-011a** *(met in CI only)*: Those behaviour paths MUST be checked on **all three** major
  engines, unlike the
  frame measurement. Autoplay policy, media event ordering and container-query layout are where
  engines genuinely differ, so a single-engine pass would be evidence about one engine presented as
  evidence about the web. Where an engine's documented behaviour differs legitimately, the
  difference MUST be asserted rather than smoothed over — a check that demands identical behaviour
  from three engines encodes a specification nobody wrote.
- **FR-012**: A browser result MUST report alongside a merge rather than block it, until the
  variance FR-007 requires has been measured and recorded. **Arming a threshold is a separate,
  deliberate act**, not a default this feature ships with — and when it happens, what is armed and
  on what evidence MUST be recorded.
- **FR-012a**: This is the first exception to a stated project invariant, and it MUST be written as
  one. The CI workflow opens by declaring that every job blocks and that *"a gate that tolerates
  failure is documentation, not a gate"* — which is correct, and is why the exception has to be
  recorded in that comment alongside the condition that ends it, rather than arriving as a silent
  `continue-on-error`. An invariant with an unexplained exception is no longer an invariant.

### Key Entities

- **Reference**: the conditions a playback measurement was taken under. There are two, deliberately:
  the **CI runner**, unthrottled, for regression detection, and a **named consumer baseline**,
  throttled, for any claim about a learner. Constitution IV says "the reference device" and never
  defines it; the README defines a reference *environment* for build timing, which is a 4 vCPU
  runner and plainly not a device a teacher holds. This feature names both and keeps them apart.
- **Browser-only path**: code whose behaviour cannot be observed without a real engine — the media
  adapter, container-query layout, style transitions, and paint itself.
- **Coverage exemption**: the existing, documented pattern for code that a simulated DOM cannot
  honestly test — an entry in the coverage config carrying the reason in prose. One such file has
  it; its sibling does not. An exemption is a claim about where the evidence lives, so it is only
  worth granting alongside the evidence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two frame-rate figures for lesson playback exist, taken in a real browser — one
  unthrottled on the CI runner, one against the named consumer baseline — and each states both the
  median frame time against the 60 fps target and the count of frames past the 30 fps floor.
- **SC-002**: The conditions of each measurement are recorded alongside it, so a figure can be
  reproduced or disputed, and so the two can never be mistaken for one another.
- **SC-003** *(deferred — not met)*: The real media adapter is exercised by a real engine **and**
  carries a written exemption naming that as its evidence. It is no longer reported at 0% branch coverage with
  neither.
- **SC-004**: A deliberate regression in a browser-only path is reported by the check.
- **SC-005**: The run-to-run variance of every browser measurement is recorded before any threshold
  derived from it is enforced.
- **SC-006**: The ordinary test suite is no slower and no less deterministic than feature 013 left
  it: ten consecutive runs, ten identical results.
- **SC-007**: A reader of a passing result can state which claims it supports without asking anyone.
- **SC-008**: The performance gate's stated limits match what is actually true after this feature.
- **SC-009**: No merge is blocked by a browser measurement whose run-to-run variance has not been
  measured and recorded first, and the CI workflow says in writing why this one job does not block
  and what would change that.

## Assumptions

- **The proxy stays.** The existing gate measures what the framework controls and does it well. This
  feature adds the layer beneath it; it does not replace or relax anything already enforced.
- **This does not join `pnpm test`.** Feature 013 established where timing lives and why, and it
  cost six analysis passes and a 632-line discovery to get there. A browser check belongs with the
  gates, not in the suite people run while they work.
- **Noise is the central risk, not capability.** Launching a browser and reading frame timings is
  well-trodden. Making the number mean something on a shared runner is the hard part, and the
  project has just finished paying for the version of that lesson that comes from getting it wrong.
- **No budget's value changes.** 60 fps and 30 fps come from the constitution. If a measurement
  cannot meet them, that is a finding to report, not a threshold to adjust.
- **Reporting is a starting posture, not a permanent one.** FR-012 defers enforcement until the
  variance is known; it does not excuse the project from ever enforcing. Constitution IV calls these
  acceptance criteria, and a check that reports forever is a check nobody reads. The deliberate act
  of arming it is in scope for a later feature, on evidence this one produces.
- **The example app is a usable subject.** `examples/nextjs` builds in CI and carries a reference
  lesson, so a real lesson exists to play without inventing a fixture.
- **CPU throttling stands in for a device; it is not one.** A throttled desktop engine shares the
  desktop's memory bandwidth, GPU and display pipeline. The baseline figure is therefore an estimate
  of a school laptop rather than a measurement of one, and it must be reported as such. Measuring
  real hardware is a larger question this feature does not settle.
