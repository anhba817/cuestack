---
'@cuestack/react': minor
'@cuestack/core': minor
---

The player finishes: questions answer, media shares the lesson's clock, and a lesson
that stops says so.

Previous releases rendered a lesson. This one plays it through. A learner can answer a
question and have it gate the slide, watch media that stays in step with what is on
screen, see where they are and when they are done, and — when something goes wrong — be
told what happened and what they can do about it.

`@cuestack/react`:

- **Questions answer.** Keyboard-operable, announced through a live region, with the
  verdict held on screen long enough to be read. An answer is recorded against the
  element rather than the visit, so seeking backwards and returning neither asks again
  nor spends an attempt.
- **Media and the lesson share one clock.** Seeking commands the media; pausing the
  lesson or hiding the document pauses it; a learner scrubbing with the element's own
  controls moves the lesson to match. Within a tolerance, so the two do not chase each
  other.
- **Slide transitions**, timed on lesson time rather than wall-clock — a paused lesson's
  crossfade stays paused.
- **Progress and completion.** Progress counts slides *visited*, so reviewing does not
  un-earn it. `progress="slides"` is a host option; the format carries no such field.
- **Blocking conditions are shown to the learner**, in their terms, with a retry only
  where retrying can change something. Authoring problems are deliberately not shown.
- **Reduced motion is substituted per effect** rather than switched off: a slide-in
  becomes a fade instead of an instant appearance.
- The player now actually plays without being driven — a frame loop, not just a first
  frame.

`@cuestack/core`:

- **Media commands.** `MediaPort` gains `play`, `pause`, and `seek`; `createMediaLink`
  keeps a lesson and its media reconciled, and `MEDIA_SYNC_TOLERANCE_MS` is exported so a
  host can see the rule rather than guess it.
- **Interactions.** Three completion policies, attempt accounting, and outcome evaluation
  — in the kernel, because whether a required question releases a slide is a fact about
  lessons and a second adapter must reach the same conclusion.
- **`ResolvedElement.reduced`** carries what an element looks like when motion is reduced,
  or null when it makes no difference. Both answers are emitted and neither is chosen, so
  the preference can be honoured by CSS on a server-rendered first frame — and `resolve`
  stays a pure function of `(slide, timeMs)`.
- `EffectDescriptor.reduced` lets an effect declare its own substitution. Optional; a
  moving effect without one still falls back to no motion.

Both additive. Nothing that worked before behaves differently.

**Known limits.** There is still no editor and no publishing pipeline, so the parity gate
between an editor preview and a learner player remains inert — there is nothing yet to
diverge from. The performance gate measures the player's own per-frame work and not
paint: happy-dom has no compositor, and a browser-based check is what would close that
gap. Automated accessibility checking covers roughly half of real defects; screen-reader
review is still required.
