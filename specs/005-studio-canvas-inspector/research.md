# Phase 0 Research: Studio Canvas and Properties Inspector

**Date**: 2026-08-16 · **Feature**: `005-studio-canvas-inspector`

Eleven decisions. R-01 and R-02 are why this feature costs less than it looks like it should;
R-04 and R-05 are the two places the design had to give something up, and both are bounded.

---

## R-01 — The kernel does not change

**Decision.** `resolve(slide, timeMs)` is used exactly as the player uses it. No editor argument, no
mode flag, no new context field. Transforms read and write authored geometry in the manifest;
`RenderState` is consumed read-only.

**Rationale.** The tempting design is `resolve(slide, timeMs, { forEditor: true })`, because the
editor needs things the player does not. It turns out not to need them *from the resolver*.

`ResolvedElement.geometry` is documented in `packages/core/src/resolve/state.ts` as "Authored position
and size. Effects do NOT mutate this", and the comment on `transform` beside it reads: "an element
translated 40px by a slide-in is still *authored* where it was, and the editor needs to show the
authored value while the player needs the effective one." Wave 1 cut this seam before there was an
editor to use it. A drag handle therefore attaches to `geometry`, an effect's displacement stays in
`transform`, and the two never contend.

The cost of adding a flag anyway would not have been cosmetic. `resolve` is the single source of
render state and the reason parity is structural rather than aspirational. A parameter that changes
*which elements come back* creates, by construction, a state the editor can produce and the player
cannot — which is the definition of a parity divergence, installed in the one function that exists to
prevent them.

**Alternatives considered.**

- *`ResolveContext.includeInvisible`.* Rejected above. Worth noting the objection is not purity —
  the function stays pure either way. It is that `RenderState.elements` is documented as "visible
  elements only, already in paint order", several consumers rely on it, and a flag makes that comment
  conditionally false.
- *A second `resolveForEditing` export.* Two functions computing render state is the forked path
  Constitution V calls a severity-2 defect, with the fork moved up a level and given a nicer name.

---

## R-02 — Elements the resolver omits are drawn by the overlay as ghosts

**Decision.** The canvas computes `resolve(slide, authoringTime)` and renders it through
`@cuestack/react`'s `SlideView`. It separately diffs `slide.elements` against `state.elements`; for
every element the resolver left out — hidden (BR-010) or outside its time window — the **overlay**
draws a ghost: a dashed, labelled, selectable, focusable box at the element's authored geometry,
stating why it is not rendered ("not yet", "no longer", "hidden").

**Rationale.** FR-011 and FR-031 require both classes of element to be visible and editable while
authoring. FR-043 requires editor-only affordances to live outside the element renderers. A ghost
satisfies both at once, and it is the honest artifact: it does not pretend to show what the learner
sees, because the learner sees nothing there. Rendering the element properly instead — by resolving
it at a time inside its own window — would put a frame on screen that occurs at no single moment of
the lesson, which is a parity lie told in the one place teachers are being asked to trust.

The diff is cheap and needs nothing new: the editor already holds the slide, and `RenderState`
carries element ids.

There is a second-order benefit. A ghost is structurally incapable of reaching playback, because the
player has no overlay to draw it in. Compare the alternative where the renderer takes a `ghosted`
prop: that prop exists in the player's package, and the only thing keeping it out of playback is that
nobody passes it.

**Alternatives considered.**

- *Render out-of-window elements at reduced opacity through the real renderer.* Rejected: it requires
  the renderer to be given something the resolver did not produce, which is R-01's flag wearing a
  different hat.
- *Show only a layer list, with no on-canvas presence.* Rejected: FR-011 says "visible on the canvas",
  and selecting a late-entering element by hunting a sidebar is exactly the timeline-expertise tax
  §7.1 exists to refuse.

---

## R-03 — The editor is a separate package, and the gate proves it by absence

**Decision.** `@cuestack/studio` — a fourth published package depending on `@cuestack/react`,
`@cuestack/core`, `@cuestack/schema`, and `@cuestack/schema/validate`. A new gate,
`check-studio-isolation.mjs`, packs the player and its dependencies, installs them into an empty
directory **with studio absent from disk entirely**, and renders a lesson.

**Rationale.** The clarification answer asked for a machine-checked guarantee, and this repo already
owns the technique. `check-core-isolation.mjs` proves `@cuestack/core` needs no UI framework not by
grepping imports but by installing it alone and importing it; its header says the dependency-cruiser
rule proves core does not *import* React while the sandbox proves "the stronger, consumer-facing
claim". The same shape applies here, and the proof is stronger than a bundle-size assertion: a player
that renders when the editor does not exist on the filesystem cannot be shipping it.

The package boundary buys a second thing that a subpath cannot. The editor validates the draft after
every edit (FR-045), which means Zod. The README calls the `@cuestack/schema` / `/validate` split
load-bearing precisely so a learner's browser never carries a validation library. As a separate
package the editor can depend on `/validate` freely; as a subpath of `@cuestack/react` every such
import would be one bundler heuristic away from a lesson-load tax.

**Alternatives considered.**

- *`@cuestack/react/editor` subpath.* Rejected: no cheaper, and unprovable by the technique above.
  Tree-shaking is a property of the consumer's bundler, not of what we ship.
- *Keep the editor in `examples/`.* Rejected: it is a framework deliverable (ED-1, ED-2), and an
  editor nobody can install is not one.

---

## R-04 — A pure transform engine, with measurement quarantined at the input edge

**Decision.** `geometry/transform.ts`, `snap.ts`, and `align.ts` take and return logical units and
touch no DOM. A single module, `canvas/pointer.ts`, reads the stage's rendered size once per gesture
and converts screen deltas to logical ones. Keyboard nudges call the engine directly.

**Rationale.** This started as a purity argument and became a hard constraint when measured.
**happy-dom computes no layout**: a `<div>` with explicit `width: 800px` reports
`getBoundingClientRect()` of `{w: 0, h: 0}` and `offsetWidth` of `0`, verified in this repo's own
test environment. Any drag logic that derives geometry from a measured rect is therefore not merely
impure — it is **untestable here**, and would arrive either as a suite that mocks the browser's
layout engine or as a feature with no tests at all.

Splitting at the logical/screen boundary makes the interesting half testable with no DOM: given a
starting geometry, a delta, and a set of snap candidates, assert the resulting geometry. That is the
whole of FR-003, FR-005, FR-006, and FR-007, and none of it needs a browser. The pointer adapter that
remains is small enough to be reasoned about and is tested with an injected scale.

FR-009 is satisfied in the sense that matters and it is worth being precise about which. The
requirement is that a transform expressed in logical coordinates yields the same result at any
display size — a property of the engine, and the engine has no way to know the display size. What
`pointer.ts` measures is the *input*, once, in a browser, during a gesture. Nothing on the rendering
path measures anything, so the server-rendered first frame and hydration properties NX-2 bought are
untouched. A dependency-cruiser rule confines DOM-geometry reads to this one module so the
quarantine is enforced rather than intended.

**Alternatives considered.**

- *Derive the scale from CSS custom properties.* Rejected on inspection: `--cs-canvas-w` is the
  *logical* width (1600 for 16:9). The rendered width exists only in the layout, which is the entire
  design of `stage.css` — `100cqw` resolves in the browser and is never a number JavaScript holds.
- *`PointerEvent.movementX/Y`.* Same screen-pixel problem, plus it varies with pointer acceleration.
- *Mock layout in happy-dom.* Rejected: it makes the test suite assert against a fiction of our own
  authorship, and Constitution II's whole point is tests that fail for real reasons.

---

## R-05 — Text editing overlays a surface that borrows the stylesheet, not the component

**Decision.** Entering text-edit mode mounts a focusable, caret-bearing surface in the **overlay**,
positioned over the element's box and carrying the *same class name* the renderer uses
(`.cs-element-text`). The element renderer is not modified and receives no editor prop. On commit the
surface unmounts and the text reaches the draft through an ordinary edit.

**Rationale.** This is the tension the specification flagged for planning, and it resolves on a
property of this codebase rather than a general principle. `TextElement.tsx` is four lines and its
comment says so: "All typography resolves from theme properties in the stylesheet — there is no style
object here at all." Font family, size, line height, wrapping, and the small-size floor all live in
`.cs-element-text` in `stage.css`. An overlay node with that class, inside a box positioned by the
same `.cs-element` rules, renders text identically **without sharing a line of component code**.

So the thing FR-017 forbids — a second way of *rendering* the element's text — does not appear. There
is one styling authority and it is the stylesheet.

The honest limit, stated because it would otherwise be discovered: while editing, two DOM nodes carry
the text. The bound is that the surface exists only during an explicit edit mode (FR-016), lives
outside the renderer (FR-043), and cannot exist during playback because the overlay does not. The
test that keeps this true asserts that committed text renders identically to what the surface
displayed — if the two ever diverge, that test fails rather than a teacher noticing their heading
reflow on commit.

**Alternatives considered.**

- *`contentEditable` on the renderer behind a prop.* Rejected twice over: it puts an editor concern
  in the component Constitution V forbids forking, and it puts editor code in the player package,
  breaking FR-049 in the same change.
- *Edit text only in the inspector.* Rejected by the Q2 clarification and by FR-CAN-005.
- *A `<textarea>` rather than a contenteditable surface.* Kept open for the implementation; the
  decision here is where the surface lives and where its styling comes from, not which element it is.
  A textarea inherits the class just as well and is the more accessible default.

---

## R-06 — The inspector is plugin-driven, and the contract needs one more field kind

**Decision.** The inspector renders fields from `ElementPlugin.inspector`, with a component per
`InspectorField.kind` and no branch on element type. `InspectorField` gains a `list` kind in
`@cuestack/core`.

**Rationale.** `inspector` has been a required member of `ElementPlugin` since Wave 1 with no
consumer, so the question was never whether to use it but whether it is sufficient. It is not, in
exactly one place: the declared kinds are `text | number | boolean | select | asset | colour`, and a
question's payload carries an **options array** — a repeating group of `{ id, label }` with one marked
correct. No scalar kind describes it, and the seven MVP types include `question`.

FR-019 says what to do about that: "Where it cannot, the contract is extended rather than the
inspector special-casing the type." So `list` is added to the union in
`packages/core/src/elements/contract.ts`, describing a repeating group of sub-fields. The alternative
— an `if (element.type === 'question')` in the inspector — is precisely the switch statement
Constitution I calls a defect, and it would make the seventh type the one that proves the registry
does not work.

This is a core change, and it is worth being clear about its blast radius: `InspectorSpec` is
authoring metadata, consumed by nothing on the playback path, so it is additive to a type nothing
serializes. It is not a manifest change and triggers no `schemaVersion` bump (FR-047 holds).

**Alternatives considered.**

- *Let a plugin supply a React component for exotic fields.* Rejected for this feature: it would put
  React in `@cuestack/core`'s contract surface, which Constitution I forbids outright, and the studio
  registry (R-07's sibling, `ElementEditorRegistry`) is the right home if it is ever needed.
- *Ship the question type without option editing.* Rejected: a question whose options cannot be
  edited is a question type the editor does not support, and FR-CAN-001 lists it in the MVP set.

---

## R-07 — Draft state is a pure reducer, and there is no state library

**Decision.** `applyEdit(draft: LessonManifest, edit: Edit, ctx): LessonManifest`, pure, returning a
new manifest. React holds it with `useReducer`. No Zustand, no Immer.

**Rationale.** The framework plan's Open Design Questions table lists "Zustand + Immer patches" as the
default for editor state management, with the stated justification that "patches double as the
undo/redo journal and the autosave delta". The Q3 clarification removed the journal from this feature
and ED-5 owns autosave, so the justification is not present and the dependency would be adopted for a
benefit nothing here collects.

What a plain reducer buys instead is directly useful: `applyEdit` is testable with no React and no
DOM, and SC-016 — replay an edit sequence, demand a byte-identical manifest — becomes a fold over an
array. It is also the natural thing for ED-5 to wrap, since a patch producer needs a deterministic
state transition underneath it either way.

Recorded prominently because it contradicts a written default. Silent contradiction of a settled
decision is the drift the constitution's governance section calls a defect in the code.

**Alternatives considered.**

- *Adopt Zustand now to avoid a migration later.* Rejected: the migration is wrapping a pure function,
  which is cheaper than carrying an unused abstraction through a feature.
- *Mutate the draft in place.* Rejected: it defeats SC-016 and makes React's rendering dependent on
  identity changes that would not occur.

---

## R-08 — Identity comes from an injected source

**Decision.** `IdSource = () => string`, supplied to the editor session, defaulting to
`crypto.randomUUID()`. Tests inject a counter.

**Rationale.** Straight from the clarification, and it mirrors `TimeSource` in
`packages/core/src/ports/`. The schema's `identifier` is `z.string().min(1).max(128)` with no pattern,
so a UUID and a test's `el-1` are both valid and no format negotiation is needed.

The property this protects is SC-016. Without injection, every test that adds or duplicates an
element produces a different manifest, and the determinism and round-trip fixtures this repo relies
on cannot assert on output — the same reason Wave 1 made the clock injectable rather than reading
`performance.now()` directly.

**Alternatives considered.**

- *Derive ids from content (slide id plus index).* Rejected in the clarification, and correctly: it
  makes an id mean something, so reordering renames elements and any reference to them breaks.
- *A module-level counter.* Rejected: it is global mutable state, so tests leak into each other and
  test order becomes significant.

---

## R-09 — Read-only is enforced in the reducer, not in the user interface

**Decision.** The editor session carries `mode: 'edit' | 'read-only'`. `applyEdit` refuses every
mutating edit in read-only mode and returns the draft unchanged with a stated reason. The interface
additionally disables and explains the affordances, but that is presentation.

**Rationale.** SC-017 requires zero edits to reach the draft "across the full action surface …
including every keyboard shortcut". Enforcing at the UI means auditing every button, every shortcut,
every drag handle, and every inspector field, and being wrong the first time a new one is added.
Enforcing at the reducer means one check at the single point every mutation already passes through,
and a test that enumerates the `Edit` union and asserts each is refused — which stays correct when the
union grows.

Selection, inspection, and moving the authoring time are not edits and are unaffected, which is what
FR-051 asks for and is free, since none of them touch the draft.

**Alternatives considered.**

- *Disable the UI only.* Rejected above: the guarantee would be a claim about coverage of a surface
  rather than a property of the system.
- *A separate read-only component tree.* Rejected: a second tree is a second render path.

---

## R-10 — Drag feedback bypasses React, using the pattern already in the repo

**Decision.** During a drag, the gesture writes `--cs-x` and `--cs-y` directly on the element's DOM
node. React re-renders once, on commit. The mechanism is `FrameWriter`'s, reused rather than
reinvented.

**Rationale.** SC-001 puts input-to-feedback at 100 ms with 300 elements on a slide, and a React
reconciliation per `pointermove` does not have that budget to spare. This repo already solved the
identical problem for playback: `FrameWriter` is described as "the only imperative DOM writer in this
package … isolated deliberately", existing because "a reconciliation pass per frame per element would
put the 60fps budget out of reach".

The reuse is more than stylistic. `stage.css` positions every element from `--cs-x` / `--cs-y` divided
by the canvas dimensions, so writing those two properties *is* moving the element, in the same units
the manifest stores and with no conversion. The drag preview and the committed value are therefore the
same number, and a preview that disagrees with the commit — the classic drag bug, where the element
jumps on release — cannot arise.

**Alternatives considered.**

- *React state per pointermove.* Rejected on the budget above.
- *A CSS `transform: translate()` preview, committed to `x`/`y` on release.* Rejected: the preview and
  the stored value would be different quantities, reintroducing exactly the jump-on-release class of
  bug, and `--cs-tx` is already spoken for by effects.

---

## R-11 — Sanitization is true today by construction; the work is a lock, not a sanitizer

**Decision.** No sanitization library is added. `dangerouslySetInnerHTML` is banned by lint across the
workspace, and a test asserts that text carrying markup is rendered as text on both the canvas and the
player path.

**Rationale.** FR-046 and NFR-SEC-007 are already satisfied, and it is worth checking rather than
assuming: **`dangerouslySetInnerHTML` appears nowhere in `packages/`** (verified). Every renderer
passes text as a React child, which escapes it. The text payload is `z.string()`, a plain string — the
MVP element set carries no rich-text or HTML-bearing type.

So writing a sanitizer now would be adding a dependency to defend a door that is not open, and the
real risk is the *next* renderer, written under deadline, reaching for `innerHTML` to support a
formatting request. A lint rule fails that at review; a sanitizer somewhere in the tree would not.

The spec's framing sharpens correctly here: server-rendered markup ships inside the HTML document, so
the editor's new text-entry path is a new *source* of author-supplied strings, not a new *rendering*
of them. It joins a path that is already safe.

**Alternatives considered.**

- *Add DOMPurify now, ahead of rich text.* Rejected: unused dependencies in a security position are
  worse than none, because they suggest a review has happened.
- *Rely on review.* Rejected: Constitution I requires the boundary machine-enforced, and this is one.
- *Deferred, named.* When a rich-text element type arrives, this decision is reopened — that type
  introduces markup deliberately and needs a real sanitizer on both paths.
