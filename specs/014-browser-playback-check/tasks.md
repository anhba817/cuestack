# Tasks: A frame rate nobody has ever seen

**Input**: Design documents from `/specs/014-browser-playback-check/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/browser-measurement.md](./contracts/browser-measurement.md),
[quickstart.md](./quickstart.md)

**Tests are required, not optional.** Constitution II is NON-NEGOTIABLE. This feature also removes a
module from the coverage report on the promise that something else exercises it, and the promise and
the removal are one change.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelizable, different files, no dependency on incomplete work
- **[US1]/[US2]/[US3]** — the user story a task serves; setup, foundational and polish carry none

---

## The two orderings this feature turns on

**The exemption comes last, and not for a dependency reason.** T023 removes `domMediaPort.ts` from
the coverage report. It is a one-line change with no prerequisites — the easiest task here — and the
only one that makes things worse if it lands alone. A module reporting 0% branches at least tells
the truth; a module carrying an exemption that names evidence which does not exist tells a lie that
reads better. It sits at the end of US2, immediately after the browser check that gives the
exemption something true to say.

**No threshold is written down before its variance is measured.** T017 runs the measurement ten
times and records the spread. Feature 013 spent itself removing a timing threshold set without that,
and frame timing is noisier than anything it removed. Until T017 exists, the floor's allowed count
stays unwritten — a bound of zero is one garbage collection from permanently red, and a bound
invented to avoid that is not a measurement.

---

## Phase 1: Setup

- [X] T001 Add Playwright as a root devDependency and install its engines, in `package.json` — **FR-011a** needs WebKit, which Puppeteer does not drive, so the engine most likely to differ on media policy would otherwise be the one not checked (research R-01)
- [X] T002 Confirm the new dependency reaches no package, by running `pnpm check:isolation`, `pnpm check:element-isolation` and `pnpm check:packaging` — this is the repository's first browser dependency, and all three of those checks exist because a dependency once leaked into a package that should not have had it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Nothing in any user story can be asserted before these exist**, because every later task measures
or inspects what they produce.

- [X] T003 Build the two harnesses, each loaded the way its adapter is actually consumed — **research R-08**, **R-09**. **A browser cannot load either `dist` directly**: react's imports `@cuestack/core`, `react`, `react/jsx-runtime` and element's imports `@cuestack/core`, `@cuestack/schema/validate`, and `<script type="module">` resolves no bare specifier. So: `examples/nextjs/app/perf/page.tsx` is the **React harness** — the app already bundles, and it is built far more often than it looks: `examples/*` is a workspace member, so **`pnpm build` compiles it**, which means every contributor's build, CI's first gate, and this feature's own sweep all compile this route. **A mistake here breaks every build, not one gate** — treat it with more care than its size suggests. It **imports** `../heavy-lesson.json` and hands it to a client half that plays it, mirroring `app/page.tsx` handing off to `app/tour-view.tsx`; the app has imported fixtures this way since it was written. And `tools/browser/harness/element.html` is a static page with a five-entry **import map**. **No bundler is added, no `public/` directory, and no fetch** — a static import keeps Gate 12 building unconditionally
- [X] T004 Serve the element page and the workspace `dist` directories in `tools/browser/serve.mjs`, and commit `examples/nextjs/app/heavy-lesson.json` (86KB) from `heavyLesson()` — **research R-09**. **In the app, not in a package**: `packages/schema` is public with `"files": ["dist","fixtures"]`, so putting it there ships 86KB to every consumer for one private demo. **Resolve `zod` rather than writing its path**: under pnpm it lives at `node_modules/.pnpm/zod@4.4.3/node_modules/zod/index.js`, a literal that changes on every upgrade, so `serve.mjs` resolves it from `@cuestack/schema`'s context. The tour lesson needs nothing: it is TypeScript, and the app compiles it
- [X] T005 Define the one result shape in `tools/browser/report.mjs` — **FR-002**. Every figure carries reference, engine, subject, throttling, both statistics, sample count, and what it does not cover ([contract §1](./contracts/browser-measurement.md)). A figure without its conditions is not a weaker result but a false one, because a reader supplies the missing context from whatever they assumed
- [X] T006 Make all three silences loud, in `tools/browser/serve.mjs` and `tools/browser/measure.mjs` — **FR-005**. A missing engine must fail rather than reduce the run to the engines present; a harness that loads but never starts the lesson must time out rather than wait; media blocked from autoplaying must be handled rather than waited on ([contract §4](./contracts/browser-measurement.md))
- [X] T007 Run the controls on T006 **before** trusting it: uninstall one engine and confirm the run fails naming it, point the harness at a lesson that never starts and confirm a bounded failure. **This repository has shipped four gates whose lists reached nothing** — a browser check that quietly skips an engine is that defect in a new coat

**Checkpoint**: a browser can play a lesson, and every way that can fail is loud.

---

## Phase 3: User Story 1 — The frame-rate claim has evidence (Priority: P1) 🎯 MVP

**Goal**: Constitution IV's row stops being unverified.

**Independent Test**: run a lesson in a real browser; read median frame time against the 60 fps
target and the count of frames past the 30 fps floor.

**Depends on**: Phase 2.

### Tests for User Story 1

- [X] T008 [US1] Assert the statistics are a median and a floor-breach count and never a mean, **and that the committed fixture still matches its generator**, in `tools/scripts/__tests__/browser-check.test.ts`, importing **`tools/browser/statistics.mjs` and not `measure.mjs`** — **FR-001**, **FR-006**. **The path**: the `gates` project collects only `tools/scripts/__tests__/**`, so a test under `tools/browser/__tests__/` would be written, reviewed and never executed. **The import**: `measure.mjs` drives Playwright, so importing it would pull a browser driver into every `pnpm test`. **The freshness assertion**: `app/heavy-lesson.json` must equal `JSON.stringify(heavyLesson())` — which works because the generator is deterministic, verified rather than assumed (no `Math.random`, `Date.now` or `process.env` in it; two calls give byte-identical 87,944 bytes) — because a committed artifact beside the function that produces it is two sources of truth and will drift — the browser check would then measure a different lesson than `pnpm gates` does. **One file for both**, so the README count moves once. **And bump the two README figures in the same change** (`README.md:31` and `:55`, 379 -> 380): `readme-claims.test.ts` asserts both against `vitest list`

### Implementation for User Story 1

- [X] T009 [US1] Collect frame deltas in-page in `tools/browser/measure.mjs` and compute the two statistics in `tools/browser/statistics.mjs` — **FR-001**. `requestAnimationFrame` deltas rather than a Chromium trace: tracing is richer and Chromium-only, and the same collection code has to be readable on all three engines even though only one is measured (research R-02)
- [X] T010 [US1] Add the CI reference run — unthrottled, heavy fixture, one engine — in `tools/browser/measure.mjs` — **FR-010**. Same fixture as the existing gate deliberately: **the gap between this figure and the gate's proxy figure is what paint costs**, and that number has never existed
- [X] T011 [US1] Add the baseline reference run — ~4x CPU throttling, tour lesson — in `tools/browser/measure.mjs` — **FR-010**, **FR-010a**. Throttling is `Emulation.setCPUThrottlingRate`, a CDP capability, so this run is necessarily Chromium (research R-03). State the device class and the multiplier wherever the figure appears
- [X] T012 [US1] Enforce the two prohibitions in `tools/browser/report.mjs` — **FR-002**, **SC-002**. The CI figure may not be used to say anything about a learner's device; the baseline figure may not be presented as a measurement of real hardware ([contract §2](./contracts/browser-measurement.md)). **A throttled desktop keeps the desktop's memory bandwidth, GPU and display pipeline** — it estimates a school laptop rather than measuring one
- [X] T013 [US1] Record both figures in `specs/014-browser-playback-check/quickstart.md` — **SC-001**. Median against 16.7 ms and floor-breach count for each reference
- [X] T014 [US1] Add `check:browser` to `package.json` as a fourth runner, with the surface the quickstart uses — bare (both references), `--behaviour` (the three-engine suite), `--repeat N` (the variance run) — **FR-006**. Not `pnpm test`, not `pnpm gates`. Feature 013 established where timing lives and why; `pnpm gates` runs in 10.2 s and that speed is why people run it before pushing
- [X] T015 [US1] Add the CI job in `.github/workflows/ci.yml`, **reporting and not blocking**, and **amend the invariant it breaks in the same edit** — **FR-012**, **FR-012a**, **SC-009**. The steps, because **CI contains zero Playwright references today** and nothing is inherited from a neighbour: install, `pnpm build`, `pnpm exec playwright install --with-deps` (the slowest step in the workflow — cache it by lockfile hash), `pnpm --filter @cuestack/example-nextjs build`, then `pnpm check:browser`. That file opens by declaring every job blocking, because *"a gate that tolerates failure is documentation, not a gate"* — which is right, and is why this exception belongs in that comment with the condition that ends it (FR-007's variance run) rather than arriving as a silent `continue-on-error`. **An invariant with an unexplained exception is no longer an invariant**
- [X] T016 [US1] Record the variance: run the measurement ten times and write the spread of both statistics into the quickstart — **FR-007**, **SC-005**. **This is the prerequisite for writing down any threshold at all.** If the spread is wider than a margin would need, that is the finding and it is more useful than a threshold

**Checkpoint**: two figures exist, each honest about exactly one thing. Shippable alone.

---

## Phase 4: User Story 2 — The code only a browser can exercise gets exercised (Priority: P1)

**Goal**: the paths happy-dom cannot see are run against real engines.

**Independent Test**: the behaviour suite exercises media, layout and reduced motion on three
engines, and a deliberate break in one is reported.

**Depends on**: Phase 2. Independent of US1 — the behaviour suite asserts, it does not measure time.

### Tests for User Story 2

- [X] T017 [P] [US2] Exercise the real media adapter in `tools/browser/behaviour.spec.ts` — **FR-003**, **FR-011**. Both paths: muted media that may autoplay, and audible media the browser blocks, which must be handled rather than waited on. **Blocking audible autoplay without a gesture is correct browser behaviour**, so it is a case to assert, not an obstacle to work around
- [X] T018 [P] [US2] Assert canvas-relative layout at two viewport widths, **on both adapters**, in `tools/browser/behaviour.spec.ts` — **FR-011**. Elements land proportionally where the author placed them. Container units are in four files across three packages, and one of them is `packages/react/src/player/Stage.tsx` — **the primary player** — so an assertion written only against the element page would test the adapter that is not the main one. happy-dom never evaluates `cqw`, so none of these has been checked by anything
- [ ] T019 [P] [US2] Assert reduced motion is honoured in `tools/browser/behaviour.spec.ts` — **FR-011**. Constitution III requires it; `packages/element/src/styles.ts` has two `prefers-reduced-motion` blocks and **nothing has ever evaluated them**, because happy-dom resolves no media queries over style

### Implementation for User Story 2

- [ ] T020 [US2] Run the behaviour suite on Chromium, Firefox and WebKit — **FR-011a**. Where engines legitimately differ, assert the difference rather than smoothing it: **a check demanding identical behaviour from three engines encodes a specification nobody wrote**
- [X] T021 [US2] Verify a deliberate break is reported — **SC-004**. Break the media adapter's play path, then the layout's unit conversion, one at a time, and confirm the suite fails naming what broke. **Passes for the wrong reason if you only check it is green today**
- [ ] T022 [US2] Confirm the suite genuinely covers `domMediaPort.ts` before T023 — its play, pause and event-subscription paths, not merely its import. T023 is not safe to write until this is true
- [ ] T023 [US2] Move `domMediaPort.ts` into the coverage exclusions in `vitest.config.ts`, naming the browser check as its evidence — **FR-009**, **SC-003**. **Last, and only now.** Its sibling `browserPorts.ts` already carries this exact reasoning; the difference is that after T017 this module has something the precedent never had. Landing this before T017 would swap a visible 0% for silence, which reads better and says less

**Checkpoint**: the four things happy-dom cannot see are seen.

---

## Phase 5: User Story 3 — A pass says what it covered (Priority: P2)

**Goal**: a green result cannot be read as more than it is.

**Independent Test**: read the output and state which claims it supports.

**Depends on**: Phase 2. Independent of US1 and US2, though it has little to print until they exist.

- [X] T024 [P] [US3] Print the measured values and their conditions in `tools/browser/report.mjs` — **FR-004**, **SC-007**. Both statistics, the reference, engine, subject, throttling and sample count
- [X] T025 [US3] Print what the result does not cover — **FR-004**, [contract §6](./contracts/browser-measurement.md). Not real hardware; not a cross-engine frame claim; not frames the compositor never scheduled; not the devices teachers own. **The gate's existing disclaimer is the precedent and the reason**: a green line gets read as a full answer unless it says otherwise

**Checkpoint**: all three stories delivered.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 Correct the performance gate's disclaimer in `tools/scripts/gates/perf.mjs` — **FR-008**, **SC-008**. It says a browser-based check is *still required*; after this feature that is true of a smaller thing, and the output must say which part is now covered and which is not
- [X] T027 [P] Say where playback is measured in `README.md`, alongside the commands feature 013 added — a contributor who does not know `check:browser` exists will assume `pnpm gates` covers paint, which is exactly what its own disclaimer denies. **And correct the stale figure two lines away**: `README.md:54` says `pnpm build` covers *5 workspace projects* and it is **7**. Feature 013 corrected the two numbers beside it and put them under `readme-claims.test.ts`; leaving this one unchecked next to two checked ones is worse than three unchecked, because the verified neighbours lend it credibility. Add the assertion to `readme-claims.test.ts` — no new file, so the test count does not move again
- [X] T028 Confirm nothing else got slower or less deterministic — **FR-006**, **SC-006**. `pnpm test` ten runs, ten identical results, ~10 s; `pnpm gates` still ~10.2 s. If `pnpm gates` has grown, browser work has leaked into the signal people run before pushing
- [X] T029 Record the finding in `docs/cuestack_framework_plan.md` — what paint actually costs on top of the proxy, whether the throttled baseline meets the constitution, and the three engines' disagreements. **If the baseline misses the 60 fps target or the 30 fps floor, that is the most valuable thing this feature produced** and must be written down rather than softened
- [X] T030 Run `pnpm build --force && pnpm typecheck && pnpm lint && pnpm test && pnpm test:gates && pnpm gates && pnpm check:rules && pnpm check:docs && pnpm check:agreement && pnpm check:element-isolation && pnpm check:packaging && pnpm check:isolation && pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations` and confirm every one is green. Note that `pnpm build --force` here compiles the example app including the new perf route, so this sweep is the first place a mistake in T003 would surface if it somehow had not already. `check:rules` must still read **18 of 18**
- [ ] T031 Verify the negative controls by deliberate breakage, restoring each afterwards: add a test file without updating the README count (`readme-claims` must fail); remove an engine (T007 must fail), point at a lesson that never starts (T007 must fail), break the media play path (T021 must fail), break the layout units (T021 must fail), and revert T023's exemption to confirm the module returns to the report. **`git checkout` is not a restore for an untracked file and is destructive for a tracked one** — feature 011 hit both halves of that in one session

---

## Dependencies & Execution Order

```text
Phase 1 (Playwright)
   └──► Phase 2 (harness, result shape, loud failures)  ──┬──► Phase 3 (US1 — the two figures)  🎯 MVP
                                                           ├──► Phase 4 (US2 — the unseen paths)
                                                           └──► Phase 5 (US3 — what it does not cover)
```

**Within Phase 4, T023 depends on T017 and T022** — that is the whole point of it being last. Nothing
else in the feature has that shape: it is the one task that is safe only after another has proved
something.

**Within Phase 3, T016 gates the future rather than the present.** Nothing in this feature needs the
variance number, and everything after it does. It is where the decision to arm a threshold gets its
evidence.

**US1, US2 and US3 are independent of each other.** US2 asserts behaviour and does not measure time;
US3 formats what the other two produce and can be written against either.

## Parallel opportunities

**Phase 4** — T017, T018 and T019 are three separate assertions in one file; write them together,
run them together.

**Phase 3 and Phase 4** — different files entirely, and neither reads the other's output.

**Phase 6** — T027 and T029 touch different documents; T028 and T030 must run after everything else.

## Implementation strategy

**MVP is Phase 1 + Phase 2 + Phase 3.** That produces the two figures and closes Constitution IV's
open row, which is the feature's name and its point.

**Then Phase 4 before Phase 5.** US2 is P1 and US3 is P2 — and US2 is where the defects actually
are: a media adapter at 0% branch coverage is not a statistic, it is the component that decides
whether a video starts, and nothing has ever run it.

**The task to read carefully is T023**, and the reason is the opposite of the usual one. It is
trivial, unblocked and tempting to do first. Doing it first is the only way this feature can leave
the repository worse than it found it.


---

## Not done, and why — **deferred 2026-08-22**

Four decisions were taken on these after the first implementation pass. Two closed; two did not, and
those two are now parked in `docs/cuestack_framework_plan.md` under **Deferred & future**, each with
the condition that re-opens it. The requirements they leave unmet are marked in the spec rather than
left reading as satisfied: **FR-009** and **SC-003** not met, **FR-011** partially met, **FR-011a**
met in CI only.

**T019 — reduced motion. Attempted again, still not verified.** The decision was to reach a
discriminating transition via the tour lesson. **It cannot be reached**: the tour's only `slide`
transition is on its third slide, behind a slide whose advance is `after_interaction`, so it stalls
there unattended. A two-slide lesson derived from the heavy fixture was then served with a `slide`
transition — playback advanced (element count moved 4 → 5 as authored) but **no
`[data-cs-transition]` node ever appeared across 20 seconds**, on a slide authored to end at 8s.
Either the adapter does not mark transitions the way its own stylesheet expects, or it did not
advance. **Both are worth knowing and neither is verified here.** The scaffolding was reverted
rather than left as dead code, and the four disproved assertions are recorded in the `fixme` so
nobody repeats them.

**T020 — three engines. Closed as an accepted gap.** Chromium and Firefox pass; WebKit needs
`libevent`, `libavif` and `libmanette` installed as root. CI covers it via `--with-deps`. **The
risk is now named in `ci.yml` rather than left implicit**: that job reports without blocking, so a
WebKit-only regression is invisible locally *and* non-blocking in CI. Reading its log after a media
or layout change is the mitigation, and it is written down.

**T022 / T023 — the coverage exemption. Still blocked, and now for a known reason.** The decision
was to get the evidence first. Probing showed why it cannot be got from the current subject: the
heavy fixture's single media element points at `https://example.test/clip-0.mp4`, which does not
resolve — `readyState` stays 0, `currentTime` stays 0, `paused` stays true. **The port's `play`,
`pause` and event-subscription branches produce nothing observable through media that never loads.**
Obtaining the evidence means adding real servable media to the harness, which is a further piece of
work rather than a tweak. Until then `domMediaPort.ts` stays in the coverage report at 0% branches,
which is the honest state: a visible zero tells the truth.

**T031 — negative controls. Partially run.** Verified by deliberate breakage: a missing engine fails
the suite (WebKit, in earnest); a harness that never signals readiness fails naming the URL
(observed when `/perf/tour` was requested before it existed); an idle page is refused rather than
reported; the coverage-table check caught two new requirements the moment they were added; and the
reduced-motion controls, which are what exposed four successive assertions as theatre. Not run:
breaking the layout unit conversion, and reverting the exemption — the latter because T023 was not
done.
