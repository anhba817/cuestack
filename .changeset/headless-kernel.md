---
'@cuestack/core': minor
---

The headless kernel: timeline resolution, playback clock, advance controller, and
the extension and host boundaries.

`resolve(slide, timeMs)` computes a slide's complete visual state as a fold over
effect descriptors — pure, with no browser, no clock, and no memory of prior calls.
Seeking recomputes rather than replays, `resolve(slide, 0)` runs on a server, and
playing to a time provably equals seeking to it across every state-change boundary
in the test corpus.

Also included: the eight MVP effects as progress-to-contribution descriptors each
declaring whether it is motion; an injected clock that clamps per-tick deltas so
machine sleep never becomes lesson time; an advance controller covering all four
modes with a single-fire guard keyed on slide instance; element and effect
registries that refuse incomplete registrations; and three host adapter interfaces
with an in-memory reference so the framework runs with no backend.
