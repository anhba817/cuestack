# @cuestack/core

## 0.1.0

### Minor Changes

- d4573e6: `@cuestack/element`: the lesson player as a custom element.
  
  A second adapter over the same kernel, usable from any page without a bundler or a
  framework — `<cuestack-lesson>` takes a manifest and plays it. Its existence is also the
  proof that the kernel is genuinely framework-agnostic rather than React-shaped.
  
  Also the authoring guide: how to write an element renderer, and what a plugin owes the
  player.
- 57e429d: The headless kernel: timeline resolution, playback clock, advance controller, and
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
- d4573e6: `@cuestack/adapter-http`: HTTP storage, asset, and analytics adapters for a host.
  
  A host that speaks HTTP can back a lesson without writing an adapter. Drafts and published
  versions persist over a documented endpoint contract, assets resolve through it, and
  analytics events reach it — with conflict detection, so two editors cannot silently
  overwrite one another.
  
  Also portable lesson packages: a lesson and its assets export and import as one unit,
  so a lesson can move between hosts without either end knowing the other.
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
- 2df3723: A lesson can now be authored rather than hand-written.
  
  Every manifest this project has ever rendered was TypeScript someone typed or a JSON fixture.
  `@cuestack/studio` is the first surface a teacher touches: a slide they can add to, arrange,
  describe, and scrub through.
  
  **`@cuestack/studio` — new package.**
  
  - **The canvas renders through the player.** `Stage` and `SlideView` from `@cuestack/react`, with
    the props the player passes and `resolve(slide, timeMs)` called with the same two arguments.
    Editor affordances live in an overlay beside that layer; the parity suite asserts the render
    layer is byte-identical with the overlay removed. The kernel did not change to accommodate any
    of it.
  - **Elements the resolver omits are drawn as ghosts.** Hidden elements and elements outside their
    time window are absent from `RenderState` by design — that design is BR-010 — so the overlay
    draws a selectable, labelled outline at the authored geometry and says *why* in words. A ghost
    cannot reach playback, because the player has no overlay.
  - **An authoring-time control**, so the canvas shows the slide at any moment rather than only at
    its start. It is one number per slide; ED-3's playhead must set the same value rather than
    introduce a second time model.
  - **The inspector is plugin-driven**, with zero branches on element type: a registered
    `ElementPlugin.inspector` wins, and the seven built-in types fall back to the editor registry.
    That fallback exists because the built-ins have no `ElementPlugin` and never have — a discovery
    this feature made rather than assumed.
  - **Read-only mode**, enforced once in the reducer and explained in the interface. The framework
    models no roles; a host maps its own onto the flag.
  - **The whole editor is keyboard-operable**, and every change announces itself with a subject —
    "text moved to 101, 100", never a bare number.
  
  **`@cuestack/core`.** Two additive changes, both to authoring metadata that no manifest serializes
  and no playback path reads, so neither carries a `schemaVersion` implication:
  
  - `InspectorField` gains a `list` kind. A question's options are a repeating group and no scalar
    kind described one; the alternative was a branch on the seventh element type, which is the
    switch statement Constitution I calls a defect.
  - `LessonEvent` gains `element_inserted` and an optional `elementType`. FR-AN-001 has always
    declared that the authoring application emits insertion events, and the union modelled playback
    only — so the requirement had nothing to emit.
  
  **`@cuestack/schema`.** `ELEMENT_TYPES` is exported from `/validate`, so the editor can assert that
  every type the format supports has a registration. A type in the schema with none is a type the
  Add menu silently omits, which a teacher discovers rather than a test. Exported from `/validate`
  and deliberately not from the root, which still compiles to zero runtime bytes.
  
  **What this does not do**, each for a stated reason: no persistence (ED-5), no undo — deletion is
  confirmed instead, and the confirmation should be *removed* when undo lands rather than kept
  beside it — no preview (ED-6), no timeline (ED-3), no advance-mode editing (BR-005/BR-006 need an
  element picker), and no asset library.
  
  The parity gate stays a placeholder. This feature builds the editor, but the gate compares
  *preview* to playback, and preview is ED-6. Marking it armed here would be the third time a gate
  in this project claimed more than it enforced.
- d4573e6: Timeline and Simple Sequence Mode.
  
  Two ways to arrange the same lesson, reading and writing one timeline: a track-based
  timeline for precise work, and a sequence view for authors who think in steps rather
  than in milliseconds. Neither stores anything the other cannot read.
- d4573e6: Validation and immutable publish.
  
  A lesson is checked before it ships, and problems are reported where they can be acted on
  rather than at load time. A published version never changes: editing a draft cannot alter
  what a learner already has.

### Patch Changes

- Updated dependencies [364d74a]
- Updated dependencies [2df3723]
- Updated dependencies [d4573e6]
  - @cuestack/schema@0.1.0
