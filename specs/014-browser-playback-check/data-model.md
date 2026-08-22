# Data Model: A frame rate nobody has ever seen

No runtime data. What this feature models is **a measurement and the conditions that make it mean
something** — a relation the project has never had to express, because until now every number it
produced came from one kind of runner.

---

## 1. Reference

The conditions a playback measurement is taken under. There are two, deliberately, and the whole
point is that they are never conflated.

| | CI reference | Baseline reference |
|---|---|---|
| Machine | the project's standard CI runner | the same runner, throttled |
| Throttling | none | ~4x CPU ([research R-03](./research.md)) |
| Stands for | itself | a several-year-old school laptop or mid-range Chromebook |
| Subject | the heavy fixture — 50 slides, 300 elements | the example app's tour lesson |
| Engine | one (Chromium) | Chromium, necessarily — throttling is a CDP capability |
| Its job | detecting regressions | the only figure a claim about a teacher may rest on |
| What it is **not** | a claim about any learner's device | a measurement of real hardware |

**The second row of "what it is not" is the one that will be forgotten.** A throttled desktop keeps
the desktop's memory bandwidth, GPU and display pipeline. The baseline *estimates* a school laptop.
Reporting it as a measurement of one is the same category of error as reporting the CI figure as a
claim about learners — which is the error the two-reference split exists to prevent.

---

## 2. Frame measurement

Constitution IV states two numbers, so a measurement reports two statistics. One each.

| Statistic | Against | Why this one |
|---|---|---|
| Median frame time | 60 fps target (16.7 ms) | the typical frame, and what the repository already does — the playback budget takes medians over many runs |
| Count of frames over 33.3 ms | 30 fps floor | a floor is about the worst case, and a mean hides it |

**A mean would pass a lesson that stalls once per slide** while reading as broken to the person
watching. The existing playback budget already reasons this way in its own comments: *"a learner
scrubs to one slide, not to the median of eight."*

**The floor's allowed count is not set here.** FR-007 requires the run-to-run variance to be
measured first. A bound of zero is one garbage collection away from permanently red; a bound
invented to avoid that is not a measurement.

---

## 3. Browser-only path

Code whose behaviour cannot be observed without a real engine. Four kinds, and they are not obscure.

| Path | Where | Why happy-dom cannot see it |
|---|---|---|
| Paint | the compositor | there isn't one |
| Container-query layout | `@cuestack/element` — 9 uses | `cqw` is never evaluated |
| Style transitions | 13 across the packages | no style resolution over time |
| Real media adapter | `packages/react/src/media/domMediaPort.ts` | needs real `<video>`/`<audio>` and their events |

**Only the last one has a coverage number, and it is 21.27% of statements and 0% of branches** — the
coverage of a module that is imported and never exercised.

---

## 4. Coverage exemption

An entry in the coverage configuration carrying its reason in prose. The project has one already,
for `browserPorts.ts`.

**An exemption is a claim about where the evidence lives.** That makes it worth granting only
alongside the evidence, and it is why FR-009 is deliberately unsatisfiable on its own — see
[research R-07](./research.md). The failure it guards against is subtle: exempting the module first
would remove a visible zero and replace it with silence, which reads better and is worse.

---

## 5. What a result carries

Every figure this feature produces travels with the facts that let a reader judge it: its reference,
engine, subject, throttling, both statistics, the sample count, and the claims it does **not**
support. The shape is in [contracts/browser-measurement.md](./contracts/browser-measurement.md).

The reason is one line of existing output. The performance gate has been printing *"a browser-based
check is still required before claiming a frame rate — a pass here is not that claim"* on every run
since Wave 3, and it is the only reason nobody has misread the proxy as the thing. A number without
that discipline attached becomes the claim by default.
