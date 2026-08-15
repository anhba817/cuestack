# Contract: the media port, now bidirectional

**Date**: 2026-08-15 · **Feature**: `004-player-completion`

This amends a Wave 1 decision. Feature 002's research R-04 chose a one-way port and recorded why;
this states what replaces it and what does not change.

## The port

```ts
interface MediaStatus {
  readonly positionMs: number
  readonly durationMs: number | null   // null while unknown; the file wins over the manifest
  readonly ended: boolean
  readonly paused: boolean
  readonly failed: boolean
}

interface MediaPort {
  query(elementId: string): MediaStatus | null
  subscribe(listener: (elementId: string) => void): () => void

  // Added in this feature.
  play(elementId: string): void
  pause(elementId: string): void
  seek(elementId: string, positionMs: number): void
}
```

Commands are **fire-and-forget and never throw**. A media element that is not attached, has failed,
or refuses the command is not an error the kernel can act on — the truth arrives through the next
`query`, which is the same route every other fact about media takes. A command that returned a
promise would invite the lesson to await it, and a lesson that waits on a video is a lesson that
stalls.

## The authority rule

> **The transport is the only clock. Either side may request a position change; every change is
> applied to the transport, and the transport then commands the media.**

Stated as an algorithm, in one place (`core/src/media/reconcile.ts`):

```
on lesson seek to T:
    transport.position = T
    media.seek(element, T - elementStartMs)
    link.commandedMs = T - elementStartMs
    link.following = false

on media report of position P:
    if link.commandedMs != null and |P - link.commandedMs| <= TOLERANCE:
        link.following = true                 # echo: the seek landed
    else if |P - link.reportedMs| <= TOLERANCE:
        pass                                  # drift: playing, or still buffering
    else:
        transport.seek(elementStartMs + P)    # jump: the learner moved it
    link.reportedMs = P
```

**Corrected during implementation.** The middle branch originally read `else if link.following`,
and that is wrong in a way only the tests found. It reintroduces exactly the stall that got the
`ignoreNextReport` flag rejected: a seek the platform silently refuses leaves `following` false
forever, so the learner's next genuine scrub falls into the guard and is swallowed — the same
failure, wearing a different name.

Its opposite, "always follow when outside tolerance", is worse and in a commoner case. A media
element still buffering toward a commanded seek reports the position it has *not yet left*, and
the transport would chase it backwards, undoing the seek the learner just made.

Comparing against the **last reported position** separates the two without a clock and without
state that can be left set. A playing element creeps by roughly one report interval per report and
never trips the threshold; a learner dragging a scrub bar always does. A refused seek produces no
report at all, so there is nothing latched waiting for one.

**Three properties this has and a flag would not.**

1. It cannot get stuck. Every branch is a comparison of two numbers, and a stale comparison is a
   comparison against an old number — which the next report resolves.
2. It distinguishes "our own seek came back", "the media is drifting", and "the learner scrubbed"
   by arithmetic rather than by bookkeeping.
3. It is a pure function of three numbers, so it is testable without a media element, a clock, or
   a DOM — which is what let the original rule's defect be found before any of it ran in a
   browser.

## Tolerance

**`MEDIA_SYNC_TOLERANCE_MS = 500`**, exported from `core/src/media/reconcile.ts`. One constant, one
place. It is *not* the timing tolerance FR-PLY-018 defines for non-streaming elements — that one
governs a guarantee this cannot make, and the two are separate numbers for separate promises.

The value is bounded on both sides, and both bounds already exist in the codebase:

| Bound | Value | Why |
|---|---|---|
| **Floor** | 250 ms | A playing media element reports its position at roughly 4 Hz, so a report can be up to one interval further along than when the seek landed. Below this, every report during playback reads as a learner scrub and the loop returns. Wave 1 chose the same figure for `CLAMP_CEILING_MS`, for the same physical reason: it is the cadence a browser can be relied on to tick at. |
| **Ceiling** | 1000 ms | The smallest deliberate move a learner can make. Wave 2 fixed the seek slider's `step` at one second so that an arrow key moves it visibly. Above this, a genuine single-step scrub is swallowed as an echo. |

500 ms is the midpoint, with 2× headroom under the floor and 2× margin below the ceiling.

**The bounds are asserted, not just the value.** A test in `@cuestack/core` checks the floor against
the report interval, and a test in `@cuestack/react` checks the ceiling against the exported seek
step. If a later wave changes the slider to quarter-second steps — Wave 4's editor timeline is
likely to want finer scrubbing — the ceiling assertion fails and names the tolerance as the thing
that has to shrink. A bare constant would instead have started silently swallowing scrubs.

Picking the number is the easy half. What makes it survive is that the two facts it was derived
from are still checked.

## What this weakens, stated plainly

For elements whose visibility is synchronised to media (FR-TIM-018), parity degrades from
**identical** to **within tolerance**. A media element owns a clock the framework does not
control, cannot pause deterministically, and cannot seek exactly. No design removes this; what a
design can do is confine it, which is why:

- Only media-synchronised elements are affected. Everything timed against slide time keeps the
  exact guarantee, because slide time is still one monotonic clock.
- The reconciliation lives in one pure function, so "which clock is right" has one answer rather
  than one per call site (FR-037).
- Tests drive a scripted fake, so the *reconciliation* is verified exactly even though real media
  is approximate. Constitution II forbids a test that depends on real media playback, and this is
  the reason the rule was made pure.

## What does not change

- The kernel still decides what a media position *means*. `after_media_ends` is evaluated in
  `core/src/advance/conditions.ts` and nothing about that moves.
- `mediaEnded` still reads `query(...)?.ended`, and a paused video still postpones rather than
  cancels — that behaviour was correct before and is untouched.
- Single-fire advancement (BR-007) is unchanged and still keyed on `slideId#visitCount`. A
  duplicated end event within one visit advances once; a replayed slide may advance again.
- Adapters that only observe media remain valid. The commands are additive, and a port that
  implements them as no-ops behaves exactly as Wave 1's did.

## Obligations on an implementer

An adapter implementing this port MUST:

- Report position changes from **every** source, including the element's own native controls.
  Reporting only lesson-initiated changes reintroduces the desynchronisation this feature exists to
  fix, and does so invisibly.
- Report `failed: true` rather than never reporting. A slide gated on media that will never load
  must be able to reach `ADVANCE_MEDIA_FAILED` instead of waiting forever.
- Treat `durationMs` from the file as authoritative over the manifest's. The manifest's figure is
  authoring metadata and may be wrong; the learner watches the file.
- Never call back into the transport. The adapter reports; reconciliation decides.
