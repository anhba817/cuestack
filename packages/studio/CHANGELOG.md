# @cuestack/studio

## 0.1.0

### Minor Changes

- d4573e6: The preview harness: the editor renders a lesson with the player, not with a copy of it.
  
  One renderer, one timing engine, one implementation of each effect — so what an author
  sees while editing is what a learner gets, by construction rather than by discipline.
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
- d4573e6: Undo, autosave, and recovery.
  
  Every destructive action is reversible, work is saved without being asked, and a session
  interrupted mid-edit comes back rather than starting over.
- d4573e6: Validation and immutable publish.
  
  A lesson is checked before it ships, and problems are reported where they can be acted on
  rather than at load time. A published version never changes: editing a draft cannot alter
  what a learner already has.

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
  - @cuestack/react@0.1.0
