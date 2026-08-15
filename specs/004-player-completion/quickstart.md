# Quickstart: Validating Player Completion

**Date**: 2026-08-15 · **Feature**: `004-player-completion`

How to prove this feature works. Scenarios 1–4 are the MVP acceptance scenarios from
`docs/Cuestack_Framework.md` §34, which Constitution II requires as automated end-to-end tests
before the feature is called done. They come first here for that reason.

## Prerequisites

Node 22.12+, pnpm 11, `pnpm install && pnpm build`. No new toolchain dependencies.

## Scenario 1 — §34 A: timed effects and automatic progression

```bash
pnpm exec vitest run --project @cuestack/react acceptance/scenario-a
```

**Expected**: on an eight-second slide, the title appears at 0.5 s, the image at 2 s, the
explanation at 4 s, and the slide transitions at 8 s — in that order and within tolerance, with the
same result whether played or seeked to.

**This is the one that was untestable until now**, because nothing advanced. `slideIndex` was a
fixed prop through all of Wave 2 and no test noticed, since every player test rendered one slide.
The last clause — the transition at 8 s — is the new behaviour; the first three have worked since
Wave 2 and are asserted here so the scenario is whole.

## Scenario 2 — §34 B: a required interaction outranks the timer

```bash
pnpm exec vitest run --project @cuestack/react acceptance/scenario-b
```

**Expected**: a ten-second slide with an unanswered required question is still on screen at
fifteen seconds. Answer it; feedback appears; the lesson advances according to the policy.

Then the part worth checking by hand, because automated accessibility checking cannot. See
**The manual pass** at the end of this document — it is one checklist rather than a note in each
scenario, since it is done in one sitting with a screen reader running.

## Scenario 3 — §34 C: media-controlled advancement

```bash
pnpm exec vitest run --project @cuestack/react acceptance/scenario-c
```

**Expected**, in order:

| Step | Result |
|---|---|
| Video playing | Slide does not advance |
| Video paused | Advancement postponed, not cancelled |
| Video seeked to its end | Slide advances |
| End event delivered twice | Exactly one advance |

The last row is a test of Wave 1 behaviour through a new path: the single-fire guard keys on
`slideId#visitCount`, so a duplicate within one visit cannot fire twice while a replayed slide
still can.

## Scenario 4 — §34 F: reduced motion

```bash
pnpm exec vitest run --project @cuestack/react acceptance/scenario-f reduced-motion
```

**Expected**: every moving effect resolves to its declared alternative, content order and timing
are unchanged, and no element becomes invisible or unreachable.

The scenario file is named explicitly. Running `reduced-motion` alone matches
`scaling/reduced-motion` and `ssr/reduced-motion` and **not** `acceptance/scenario-f`, so the one
command in this section claiming to be §34 F did not run §34 F. Found by running every command in
this file as written (T112), which is the only way that class of error surfaces.

Then see it, because this is the scenario where a passing test is least convincing:

See **The manual pass** below. In short: emulate the preference in devtools, reload, and confirm
the **first paint is already correct** — nothing moves and then settles.

## Scenario 5 — Interactions, in detail

```bash
pnpm exec vitest run --project @cuestack/core interactions
pnpm exec vitest run --project @cuestack/react question
```

**Expected** from the kernel: each of the three completion policies decides correctly; attempts
count; `unsatisfiable` is reported for a question that can never complete rather than the gate
being quietly opened.

**Expected** from the renderer: an answer submits once per action, remaining attempts are stated,
the correct answer never appears in the markup before the response is final, and closed controls
are `aria-disabled` rather than `disabled` — reachable, so the learner can hear why they are inert.

## Scenario 6 — The media reconciliation rule

```bash
pnpm exec vitest run --project @cuestack/core media
```

**Expected**: seeking the lesson commands the media; the media's echo of that command is
recognised and does not seek the lesson back; a learner scrubbing the media directly moves the
lesson; and a seek the media never honours leaves the lesson responsive with its displayed
position honest about where the media actually is.

Driven by a scripted fake, never a real `<video>` — Constitution II forbids a test depending on
real media playback, and the reconciliation is a pure function of two numbers precisely so it can
be checked exactly even though real media is approximate.

The loop this rule exists to prevent has been provoked once, so it does not need provoking again:
setting `MEDIA_SYNC_TOLERANCE_MS` to 0 and rebuilding the kernel fails five tests in this suite,
including the one named `terminates with the tolerance`. The tolerance is load-bearing rather than
decorative, and that is now a fact on record instead of an exercise.

## Scenario 7 — Errors a learner can act on

```bash
pnpm exec vitest run --project @cuestack/react problem asset-retry dead-end
```

**Expected**: each blocking condition the kernel can report produces a stated, keyboard-reachable,
announced state naming the problem and the recommended action — and **no internal identifier
anywhere in it**. `element_briefing_video` is not a thing to say to a learner.

**Expected also**: `RenderState.problems`, the authoring diagnostics, appear nowhere in learner
output. They are notes to an author about a lesson the learner cannot fix.

## Scenario 8 — Progress and completion

```bash
pnpm exec vitest run --project @cuestack/react progress completion
```

**Expected**: progress appears only when the host enables it; it counts slides visited so seeking
backwards does not reduce it; a completion state appears and is announced after the final slide;
and the learner can return to the lesson from it rather than being trapped.

## Scenario 9 — Accessibility across everything new

```bash
pnpm exec vitest run --project @cuestack/react a11y
```

**Expected**: no WCAG 2.2 AA violations on any corpus slide in any of the states this wave adds —
question answered and unanswered, feedback shown, gesture prompt, mid-transition, progress,
completion, and every error state.

**What this does not prove**, restated because it has not changed: automated checking catches
roughly half of real defects. The half it catches is the half that regresses silently. A
screen-reader pass over an answered question belongs in review, and this wave adds more that needs
one than any before it.

## Scenario 10 — The performance budgets, finally armed

```bash
pnpm gates
```

**Expected**:

| Budget | Source | Status before this wave |
|---|---|---|
| Resolution: 300 elements < 10 ms | NFR-PERF-001 | armed in Wave 1 |
| Playback frame cost < 16.7 ms | NFR-PERF-004 | **armed here** |
| Seek to rendered state < 100 ms | NFR-PERF-003 | **armed here** |

Run against a generated 50-slide, 300-element fixture — the one the Constitution has required
since ratification and Wave 2 deferred with a stated reason.

**"Failing on a 10% regression" is a margin against the budget, not a ratchet against the last
run.** A ratchet needs a recorded baseline, and a baseline taken on one machine and enforced on
another fails for reasons that are about hardware rather than code — the first kind of gate anybody
disables. So each measurement must sit at or below 10/11ths of its budget: a run that has consumed
more than that fails now, while there is still room, instead of passing at 99% and breaking the
next time somebody adds a property to write.

**Read the gate's own output on what it measures.** happy-dom has no compositor, so this measures
the work the player does per frame — resolve, compose, and the writer's property writes — not
actual paint. That is everything the framework controls and nothing it does not, and the gate says
so rather than letting "60 fps: pass" be mistaken for a full answer.

## Scenario 11 — Parity, under new load

```bash
pnpm exec vitest run --project @cuestack/react rendered-parity
```

**Expected**: for every corpus slide, every state-change boundary, **every recorded interaction
state, and the position of a media element**, the rendered result of seeking equals that of playing.

One caveat, and it is the design rather than a gap: media within `MEDIA_SYNC_TOLERANCE_MS` of where
it should be is deliberately not re-commanded, so a route that steps through stops closer together
than the tolerance lands *within* it rather than exactly on it. The sweep spaces its stops wider
than the tolerance so the strict assertion is the correct one.

This is Wave 2's sweep extended, and the extension is the point: parity was proven when the only
input was time. It now has to hold when a learner has answered things and a video has a position of
its own. If it holds here it is a property of the design rather than a coincidence of the design
having been simple.

## The manual pass

Everything above is automated. This is not, and it cannot be: automated accessibility checking
catches roughly half of real defects, and the half it misses is the half that needs a person —
whether an announcement is intelligible, whether a focus order makes sense, whether a lesson is
usable. It is one checklist rather than a note per scenario because it is done in one sitting.

```bash
pnpm install && pnpm build
pnpm --filter @cuestack/example-nextjs dev   # then open the printed URL
```

The first player on the page is **A lesson worth finishing** — three slides, no assets, and a
required question on slide 2. It exists for this pass: the reference lesson below it cannot be
completed, because its media slide waits for a video nothing serves and its last slide advances
`on_click`, which no player supports yet.

With a screen reader running (VoiceOver, NVDA, or Orca — any one of them):

1. **Reach the question with the keyboard alone.** Tab into the player. Every option must be
   reachable and the group must announce what it is asking.
2. **Answer it with the keyboard alone.** Arrow keys to choose, Enter or Space to submit. No
   pointer at any stage.
3. **Confirm the verdict is _announced_, not only shown.** A colour change is not feedback to
   someone who cannot see it. It must also stay long enough to be read before the lesson moves on.
4. **Answer wrongly first.** Confirm the remaining attempts are stated, and that a spent control is
   still reachable and says why it is inert rather than vanishing from the tab order.
5. **Confirm the progress indicator announces a position with a subject** — "Lesson progress, slide
   2 of 3", not a bare number. (The name was missing until the T107 sweep found it; this is the
   check that would have found it first.)
6. **Reach the completion state** and confirm it is announced and that the way back into the lesson
   is reachable.
7. **Emulate reduced motion** — devtools → Rendering → *Emulate CSS `prefers-reduced-motion:
   reduce`* — and reload. The lesson still plays, the slide-in on slide 1 fades instead, and the
   **first paint is already correct**: nothing moves and then settles. Disable JavaScript as well
   and it is still correct, which is the property no amount of client-side preference reading can
   give.
8. **On the reference lesson below**, confirm the media slide states what went wrong and offers a
   way past it, and that both its controls are reachable and named.

What a failure here means: a defect the whole automated suite is structurally unable to see. Record
it as one, rather than as a note on this checklist.

## What this feature still does not do

Cross-session resume (FR-PLY-015, a "Should"). Preloading the next slide (FR-PLY-010, a MUST that
no wave in the plan currently claims — see the spec's Out of scope). Interaction types beyond
single-answer multiple choice and true-or-false. Points and scoring. Any authoring-side validation
of the dead ends this wave can now reach — a required `on_correct` question with one attempt is
authorable, reachable, and reported to the learner rather than to the author, until Wave 5.

There is no editor. Every scenario above is a learner's path through a lesson somebody else wrote.
