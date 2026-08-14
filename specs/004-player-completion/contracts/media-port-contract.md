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
        link.following = true          # the seek landed; this is an echo
    else if link.following:
        transport.seek(elementStartMs + P)   # the learner moved the media directly
    link.reportedMs = P
```

**Three properties this has and a flag would not.**

1. It cannot get stuck. A seek the platform silently refuses leaves `following` false, and the
   next genuine report is compared against a number rather than swallowed by a latch nobody
   cleared.
2. It has one branch for "the learner scrubbed the video" and one for "our own seek came back",
   distinguished by arithmetic rather than by bookkeeping.
3. It is a pure function of two numbers and a tolerance, so it is testable without a media element,
   a clock, or a DOM.

An `ignoreNextReport` flag was the obvious alternative and is rejected for property 1: it is state
that can be left set, and the failure mode is a learner whose scrub is ignored with no way to tell
why.

## Tolerance

One constant, in one place. It is the same order as the timing tolerance FR-PLY-018 defines for
non-streaming elements, and it is **not** the same guarantee — see below.

Too small and every report looks like a learner seek, producing the loop the rule exists to
prevent. Too large and a genuine small scrub is swallowed as an echo. The value is chosen against
the smallest scrub a learner can perform with the seek control, which Wave 2 fixed at one second
per step for exactly this kind of reason.

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
