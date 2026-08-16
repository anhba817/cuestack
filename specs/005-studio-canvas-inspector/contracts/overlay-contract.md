# Contract: the overlay boundary

**Feature**: `005-studio-canvas-inspector` · **Modules**: `@cuestack/studio` → `canvas/`

Constitution V's most concrete requirement, written as a rule a test can check.

> Editor-only affordances — selection handles, snapping guides, hidden-element rendering — live in an
> editor overlay layer, never inside the element renderer, and MUST NOT reach playback.

## The layer split

The editing canvas is exactly two layers over one `Stage`:

```
<Stage lesson>                          from @cuestack/react, unmodified
  <SlideView state={resolve(slide, t)}  from @cuestack/react, unmodified
             renderers={builtinRenderers} />
  <Overlay ... />                       @cuestack/studio — everything editorial
</Stage>
```

**The render layer** is `@cuestack/react` used exactly as the player uses it. Same `Stage`, same
`SlideView`, same renderer registry, same `resolve()`. It receives no editor props and knows nothing
about selection, handles, or modes. If this layer needs a change to serve the editor, that change is a
parity defect and the answer is to move the need into the overlay.

**The overlay layer** holds, exhaustively:

| Affordance | Requirement |
|---|---|
| Selection indicators and focus rings | FR-001, FR-038 |
| Resize and rotate handles | FR-003 |
| Snap guides | FR-005 |
| Ghosts for hidden and out-of-window elements | FR-011, FR-031 |
| The text-edit surface | FR-015, research R-05 |
| Alignment, distribution, and layer controls | FR-006, FR-027 |
| The add menu, the authoring-time scrub, the delete confirmation | FR-013, FR-010, FR-033 |

## The rules

**1. Nothing in the overlay is addressed by the manifest.** Overlay geometry is computed from authored
geometry; it is never stored. There is no manifest field whose value is "selected".

**2. Nothing in the render layer takes an editor prop.** `SlideView`, `ElementFrame`, and every
`ElementRenderer` are called with the same arguments the player passes. Enforced by a dependency
rule: `@cuestack/react` must not import from `@cuestack/studio`, and the isolation gate proves the
player renders with studio absent from disk (FR-049).

**3. Ghosts are affordances, not renders.** A ghost draws an outline, a label, and a reason at the
authored geometry. It does not invoke the element's renderer. The player cannot grow a ghost because
the player has no overlay — which is a stronger guarantee than "we do not pass the ghost prop in
production" (research R-02).

**4. The text-edit surface borrows the stylesheet, not the component.** It carries the renderer's
class name so typography resolves from the same CSS rule, and shares no component code. The declared
limit: while editing, two DOM nodes carry the text. Bounded by the surface existing only in an explicit
edit mode, and by the test in the obligations below (research R-05, plan.md Complexity Tracking).

**5. Overlay chrome is sized in absolute units, stage content in container units.** The stylesheet
already draws this distinction and states why: playback controls and the gesture prompt are "chrome,
not stage content", sized absolutely because a control that shrinks with the stage becomes unusable
exactly where a large target matters most. Handles, guides, and menus follow that rule. `.cs-placeholder`
is the existing precedent for the other half — its dashed border is "an authoring affordance rather
than lesson content", deliberately not scaled.

**6. Overlay colours come from theme tokens with readable fallbacks.** The no-hardcoded-theme-values
gate is armed and must be extended to scan `packages/studio`; until it does, it passes by not looking.

## Test obligations

- **Rendered parity.** For a corpus of lessons, the render layer's DOM inside `.cs-stage` is identical
  with the overlay mounted and unmounted, at the same authoring time. Selection, hover, and handles
  change nothing about the elements themselves.
- **Player-vs-editor parity.** For every MVP element type, `resolve(slide, t)` rendered by the player
  and by the editing canvas produce identical element geometry, size, rotation, and paint order
  (SC-003, SC-004).
- **No editor prop crosses.** Discharged by the compiler rather than by a test: `SlideViewProps` is a
  closed type, so an extra member is a build error and gate 1 already fails on it. A runtime test
  here would assert what `pnpm typecheck` proves more strongly, and the useful check is the DOM
  comparison above, which catches an affordance leaking through a prop the type *does* permit.
- **Text-edit fidelity.** Text shown in the edit surface renders identically once committed — same
  computed class, same box (research R-05's bound).
- **Ghost isolation.** No ghost markup appears in a player render of the same manifest.
- **Accessibility.** axe reports zero violations on the canvas with a selection active, with a ghost
  present, with the text surface open, and with the delete confirmation open (SC-006).
