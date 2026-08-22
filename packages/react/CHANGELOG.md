# @cuestack/react

## 0.1.0

### Minor Changes

- 364d74a: Initial release — Wave 0, the framework foundation.
  
  `@cuestack/schema` ships the lesson format: types inferred from validators, two-tier
  validation with located issues, and a forward-only migration chain. Its root entry is
  type-only and compiles to zero runtime bytes; validation lives behind `/validate` so the
  player never carries it.
  
  `@cuestack/core`, `@cuestack/react`, and `@cuestack/element` are published as stubs. They
  exist so the workspace graph, the export conditions, and the core/UI boundary are real and
  enforced from the first commit rather than retrofitted onto code that already violates them.
  The kernel arrives in Wave 1 and the React adapter in Wave 2.
- d4573e6: A learner can move through a lesson.
  
  Navigation controls that know when they may act: a slide gated by a required question or
  by media that has not finished refuses to advance, and says so, rather than appearing
  operable and doing nothing. `learnerMayLeave` states that rule once, in the kernel, so
  both adapters answer the same question the same way.
  
  Fixes: a learner who reviewed a lesson could not complete it again in either adapter, and
  the web component never reported a timed slide carrying a required question.
- ba7c410: The player finishes: questions answer, media shares the lesson's clock, and a lesson
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
- e0f5f16: `@cuestack/react`: the server-rendered, hydrating lesson player.
  
  A host renders a lesson by supplying it. The first slide arrives in the HTML
  document — real content, discoverable by a search engine and readable with
  JavaScript disabled — and then hydrates into playback without moving.
  
  - **Two entry points behind one name.** `react-server` resolves a hook-free
    static player; the default resolves the playing one. A Server Component and a
    browser get the component each can actually use.
  - **Scaling in CSS, not JavaScript.** Every visual value reaches the page as a
    CSS custom property and every dimension in container query units, so geometry
    is correct without measuring anything. That is what lets a server emit a
    layout for a viewport it cannot know, and why there is no layout shift when
    scripts run.
  - **All seven element types**, each with its accessibility obligation: alt text
    and reserved dimensions on images, caption tracks on video, transcripts on
    audio, real buttons, and questions as labelled radio groups. WCAG 2.2 AA is a
    merge gate from this release onward.
  - **Playback controls**, keyboard-operable, with targets that do not shrink with
    the stage.
  - **`@cuestack/react/styles.css`** — one stylesheet, entirely scoped beneath the
    player's stage, so a host's own styles are untouched.
  - Reduced motion is already honoured, in CSS, on the server-rendered first frame.
  
  `@cuestack/core`: `ResolvedElement` now carries the element's authored
  accessibility metadata, passed through untouched. A renderer receives only a
  `ResolvedElement`, so without it an image's alternative text was in the manifest
  and unreachable by the one component that needs it. Additive.
  
  **Known limits.** Questions render but cannot be answered. Media renders with
  native controls and is not synchronised to lesson time. Navigation buttons carry
  their action but do not act. There are no slide transitions. Asset ids are
  resolved by a host-supplied function; there is no publishing pipeline yet.

### Patch Changes

- Updated dependencies [d4573e6]
- Updated dependencies [57e429d]
- Updated dependencies [364d74a]
- Updated dependencies [d4573e6]
- Updated dependencies [ba7c410]
- Updated dependencies [d4573e6]
- Updated dependencies [e0f5f16]
- Updated dependencies [2df3723]
- Updated dependencies [d4573e6]
- Updated dependencies [d4573e6]
  - @cuestack/core@0.1.0
  - @cuestack/schema@0.1.0
