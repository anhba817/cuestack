# Contract: what a browser measurement must carry, and what it may not claim

## 1. The rule

**A playback figure is meaningless without its conditions, so the two travel together or neither is
reported.**

Every measurement states its **reference**, **engine**, **subject**, **throttling**, both
**statistics**, the **sample count**, and what it does **not** cover. A figure that arrives without
them is not a weaker result; it is a different and false one, because a reader will supply the
missing context from whatever they assumed.

---

## 2. The two references, and the sentence each may not say

| | CI reference | Baseline reference |
|---|---|---|
| Throttling | none | ~4x CPU, standing for a several-year-old school laptop |
| Subject | heavy fixture, 50 slides / 300 elements | example app's tour lesson |
| May be used to say | "this change made playback slower" | "playback is smooth on a school laptop, approximately" |
| **May NOT be used to say** | **anything about a learner's device** | **anything measured on real hardware** |

**Both prohibitions are load-bearing.** The CI runner is a datacentre VM with no GPU; the throttled
run is a desktop wearing a laptop's CPU budget while keeping its memory bandwidth and display
pipeline. Each figure is honest about exactly one thing.

---

## 3. The two statistics

| Statistic | Compared against | Reported |
|---|---|---|
| Median frame time | 60 fps target — 16.7 ms | always |
| Frames exceeding 33.3 ms | 30 fps floor | always, as a count |

**Neither may be replaced by a mean.** A lesson that holds 60 fps and stalls once per slide averages
well and plays badly, and the average is the number that would get quoted.

**The floor's allowed count stays unwritten until FR-007's variance run.** Writing it first is how
feature 013's flake was built: a threshold set without knowing the spread, which then fails for
reasons unrelated to the code until somebody removes it.

---

## 4. What must not be possible

Three silences, each of which leaves a green result:

| | |
|---|---|
| An engine is not installed, so its behaviour checks never run | two engines report a pass and the third is absent |
| The harness loads but the lesson never starts | the run waits for frames that never arrive |
| Media is blocked from autoplaying and nothing expects that | the same hang, from the policy browsers implement on purpose |

Each fails loudly. **The third is not an edge case** — blocking audible autoplay without a gesture is
correct browser behaviour, so the suite asserts both the muted path that may play and the blocked
path that must be handled, under a bounded timeout.

This repository has shipped four gates whose lists reached nothing. A browser check that quietly
skips an engine is that defect in a new coat.

---

## 5. What this contract does not change

- **No budget's value.** 60 fps and 30 fps are the constitution's. If the baseline cannot meet them,
  that is the finding — and it is the most valuable thing this feature could produce.
- **No gate.** Results report alongside a merge and do not block it until FR-007's variance is
  recorded. Arming a threshold is a later, deliberate act with evidence behind it.
- **`pnpm gates` stays fast.** It runs in 10.2s and that is why people run it. The browser check is a
  separate runner with a separate command; the only thing `pnpm gates` gains is a corrected sentence
  about what it still does not measure.
- **The proxy stays.** The existing gate measures what the framework controls and is honest about
  the boundary. This feature adds the layer beneath it and relaxes nothing above it.

---

## 6. What a pass here still does not mean

The gate's existing disclaimer exists because a green line gets read as a full answer. This check
inherits that problem and must inherit the discipline:

- it is **not** a measurement of real hardware — see section 2;
- it is **not** a cross-engine frame-rate claim; timing is single-engine by design;
- it does **not** cover frames the compositor never scheduled, or work on other threads
  ([research R-02](../research.md));
- it does **not** cover the devices teachers actually own, only an approximation of one class of
  them.

FR-008 requires the performance gate's own disclaimer to be corrected once this lands — it currently
says a browser-based check is *still required*, and after this feature that is true of a smaller
thing than it was.
