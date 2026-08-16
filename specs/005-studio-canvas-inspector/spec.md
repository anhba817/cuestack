# Feature Specification: Studio Canvas and Properties Inspector

**Feature Branch**: `005-studio-canvas-inspector`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Start wave 4 ED1 + ED2"

Wave 4 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md), first
tranche: ED-1 (canvas — move, resize, rotate, snap, layers) and ED-2 (properties inspector,
plugin-driven). ED-3 (timeline UI), ED-4 (Simple Sequence Mode), ED-5 (undo/redo, autosave,
offline queue), ED-6 (preview harness), and QA-5 (parity harness) are the rest of the wave and
are **not** in this feature.

Waves 0–3 built a lesson that plays. Nothing in the repository can *author* one — every manifest
this project has ever rendered was hand-written TypeScript or a JSON fixture. This feature is the
first surface a teacher touches: a slide they can put something on, arrange, describe, and scrub
through.

It is also the moment the framework's central promise stops being a claim about code structure and
becomes something a person can check. Constitution V says there is exactly one renderer shared by
editor and player. Until now there has been only one consumer, so the rule cost nothing to keep.
From here it has two, and the parity gate (QA-5) that has been an inert placeholder since Wave 0
finally has something to compare — though arming it is ED-6's job, not this feature's.

## Clarifications

### Session 2026-08-16

- Q: Should a learner playing a lesson be guaranteed to download none of the editor's code, and should that guarantee be machine-checked rather than trusted? → A: Yes — editor code is separated from player code, and a blocking CI gate proves the player's payload contains none of it
- Q: How should the editor produce the identity for a newly added, duplicated, or pasted element? → A: An injectable id source, defaulting to a random generator — tests supply a deterministic one, mirroring the existing injectable clock
- Q: Should the canvas and inspector support a read-only mode, given that the product defines Reviewer and Viewer roles who may open a lesson but must not change it? → A: A read-only mode: selection and inspection work, every mutation is unavailable and says why; mapping roles to that mode is the host's job
- Q: When nothing is selected and the inspector shows slide settings, which of the slide's properties should be editable in this feature? → A: Name, duration, background, transition, and slide accessibility — everything except the advance mode, which defers to ED-3/ED-4
- Q: Should the snap threshold and the arrow-key nudge steps be fixed amounts in logical canvas units, or should they track what the teacher sees on screen? → A: Fixed logical units as named constants with documented bounds — snap within 8, nudge 1, nudge 10 with a modifier; nothing is measured

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A teacher composes a slide (Priority: P1)

A teacher opens a slide, adds an element from a menu, and types into it directly on the canvas.
They drag it where they want it, pull a handle to resize it, and another to rotate it. As they
drag, guides appear when the element lines up with a neighbour or with the centre of the canvas,
and the element settles onto that alignment rather than one pixel off it. With several elements
selected, they can align the set to an edge or distribute it evenly. A control lets them move the
slide's authoring time, so they can see the slide as it will look at any moment rather than only at
its start.

**Why this priority**: It is the first moment of truth in the product journey (§17.1) and the
lowest floor the feature can have. Everything else in Wave 4 assumes a selection exists; there is
no inspector without something to inspect, no timeline track without an element to track, and no
preview without a slide someone composed. It is also the story that carries the geometry contract
— if the editor and the player disagree about where an element is, nothing built on top of it can
be trusted.

**Independent Test**: Start from an empty slide, add three elements, type into one, drag, resize
and rotate another, scrub the authoring time, then render the resulting manifest through the
learner player and confirm every element lands at the authored position and appears at the
authored moment. Requires no inspector, no layer controls, and no keyboard support.

**Acceptance Scenarios**:

1. **Given** an empty slide, **When** the teacher adds an element from the Add menu, **Then** an
   element of that type is placed on the slide and is immediately valid, selected, and visible.
2. **Given** a slide with elements, **When** the teacher clicks one, **Then** it becomes the
   selection and is visibly indicated without altering how the element itself renders.
3. **Given** a selected element whose type supports on-canvas text, **When** the teacher enters
   text-edit mode and types, **Then** the element's text changes and the change is committed when
   they leave edit mode.
4. **Given** a selected element, **When** the teacher drags it, **Then** it follows the pointer and
   its stored position updates in logical canvas coordinates, independent of the display size.
5. **Given** a selected element, **When** the teacher drags a resize handle, **Then** the element's
   width and height change and remain positive.
6. **Given** a selected element, **When** the teacher drags the rotation handle, **Then** the
   element's rotation changes and its stored position is unaffected.
7. **Given** an element being dragged near another element's edge or the canvas centre, **When** it
   comes within the snap threshold, **Then** a guide is shown and releasing the drag aligns the two
   exactly.
8. **Given** several elements selected, **When** the teacher applies an alignment command, **Then**
   every element in the selection is aligned to the same edge or axis.
9. **Given** three or more elements selected, **When** the teacher applies a distribution command,
   **Then** the spacing between adjacent elements is made equal.
10. **Given** a slide whose elements enter at different times, **When** the teacher moves the
    authoring time, **Then** the canvas shows the slide as the learner would see it at that time.
11. **Given** the authoring time is outside an element's time window, **When** the teacher looks at
    the canvas, **Then** that element is still shown distinctly and can still be selected and
    edited.
12. **Given** a locked element, **When** the teacher attempts to move, resize, rotate, or edit its
    text, **Then** the element does not change, and it still renders normally (BR-011).
13. **Given** any transform, **When** it completes, **Then** the resulting geometry satisfies the
    manifest's constraints and the canvas never holds a manifest that would fail validation.

---

### User Story 2 - A teacher changes the selected element's settings (Priority: P2)

Having selected something, the teacher looks to the side of the screen and finds the settings that
belong to *that* thing: text for a text element, alt text and a caption for an image, captions and
a poster and a volume for a video, options and an answer for a question. Changing a field changes
the element. Nothing on the panel is a setting for an element type they did not select.

**Why this priority**: A canvas without an inspector can position an image but cannot describe it,
which means it can produce a lesson that fails accessibility requirements the framework claims to
hold (NFR-ACC-006, FR-CAN-014). It is also where the plugin contract earns its keep: `inspector`
has been a required member of `ElementPlugin` since Wave 1 and has never had a consumer, so
whether the contract is sufficient is currently unknown.

**Independent Test**: Select each of the seven MVP element types in turn and confirm the panel
shows that type's fields and no other type's; change one field of each and confirm the manifest
reflects it. Requires no dragging — selection can be made programmatically.

**Acceptance Scenarios**:

1. **Given** an element is selected, **When** the inspector renders, **Then** it shows the fields
   that element type declares and no fields belonging to another type.
2. **Given** a field is changed, **When** the change is committed, **Then** the element in the
   draft manifest carries the new value and no other element is altered.
3. **Given** an image element is selected, **When** the teacher opens the inspector, **Then** alt
   text is present as a field and reachable without opening an advanced section.
4. **Given** a field is given a value the element type rejects, **When** the teacher commits it,
   **Then** the problem, the affected element, and the recommended action are stated, and the draft
   is not left holding the rejected value (NFR-USA-004).
5. **Given** a selected element whose type has no registered plugin, **When** the inspector
   renders, **Then** it says the type is unrecognised and offers the settings common to every
   element rather than showing an empty panel.
6. **Given** nothing is selected, **When** the inspector renders, **Then** it shows the settings
   for the slide rather than a blank panel.
7. **Given** several elements are selected, **When** the inspector renders, **Then** it shows the
   settings the selected elements have in common and indicates where their values differ.
8. **Given** an element's timing is changed in the inspector, **When** the change is committed,
   **Then** the canvas reflects it at the current authoring time.
9. **Given** any inspector field, **When** it renders, **Then** it has an accessible name, its
   current value is programmatically determinable, and it is reachable by keyboard.

---

### User Story 3 - A teacher manages the elements on a slide (Priority: P3)

The teacher brings an element in front of another, hides one they are not ready to show a learner,
locks one they keep nudging by accident, duplicates one they want a second copy of, and deletes one
they no longer want — being asked to confirm first, because there is no way back yet.

**Why this priority**: These are the operations a slide accumulates the need for rather than starts
with. A teacher can compose a working slide without any of them; they cannot compose a *second*
slide comfortably without most of them. Lock and hide additionally carry business rules that the
player already honours but that nothing has ever been able to set.

**Independent Test**: On a slide with overlapping elements, reorder them and confirm the render
order changes; hide one and confirm it is absent from playback but present in the draft; lock one
and confirm it resists transforms; duplicate one; delete one and confirm the deletion cannot happen
without an explicit confirmation.

**Acceptance Scenarios**:

1. **Given** overlapping elements, **When** the teacher moves one forward or backward, **Then** the
   render order changes accordingly in both the editor and the player.
2. **Given** an element is hidden in the editor, **When** the lesson is played or previewed,
   **Then** the element does not render, and it remains present in the draft (BR-010).
3. **Given** an element is hidden, **When** the teacher looks at the canvas, **Then** they can see
   that it exists and that it is hidden, and can select and unhide it.
4. **Given** an element is locked, **When** the teacher selects it, **Then** selection succeeds and
   transforms do not (BR-011).
5. **Given** a selected element, **When** the teacher duplicates it, **Then** a new element with a
   distinct identity and the same properties is added to the slide and offset so it is visibly a
   second element.
6. **Given** a selected element, **When** the teacher deletes it, **Then** they are asked to
   confirm, the prompt names what will be deleted, and nothing is removed unless they confirm
   (NFR-USA-003, NFR-USA-004).
7. **Given** several elements are selected, **When** the teacher deletes them, **Then** they are
   asked to confirm once, and the prompt states how many elements will be removed.
8. **Given** an element is copied, **When** the teacher pastes, **Then** an element with the same
   properties and a distinct identity is added to the current slide.

---

### User Story 4 - A teacher authors without a mouse (Priority: P4)

A teacher moves through the elements on a slide with the keyboard, selects one, nudges it into
place with arrow keys, types into it, moves the authoring time, opens the inspector, changes a
field, and deletes an element — using no pointing device at any point.

**Why this priority**: Priority here orders verification, not scheduling. Constitution III states
that accessibility is never a follow-up ticket, and FR-CAN-012 requires keyboard movement and
shortcuts outright, so each surface ships keyboard-operable in the change that introduces it. The
story is separate so that it is separately *checkable* — a keyboard pass that is only ever a clause
inside another story's acceptance criteria is a pass nobody runs.

**Independent Test**: Perform the full compose-describe-manage flow with pointer events disabled,
and confirm every action in User Stories 1–3 is reachable.

**Acceptance Scenarios**:

1. **Given** a slide with elements, **When** the teacher uses the keyboard, **Then** they can move
   the selection between elements in a predictable order and the current selection is announced.
2. **Given** a selected element, **When** the teacher presses an arrow key, **Then** the element
   moves by 1 logical unit, and by 10 logical units with a modifier.
3. **Given** a selected element, **When** the teacher uses the keyboard, **Then** they can add,
   resize, reorder, lock, hide, duplicate, and delete elements, and enter and leave text-edit mode.
4. **Given** the teacher is editing text, **When** they type a character that is also a shortcut,
   **Then** the character is inserted and the shortcut does not fire.
5. **Given** the authoring-time control, **When** the teacher operates it by keyboard, **Then** the
   time changes and its current value is announced.
6. **Given** the inspector, **When** the teacher tabs into it, **Then** every field is reachable,
   operable, and labelled, and focus order follows the visible order.
7. **Given** the delete confirmation, **When** it appears, **Then** it takes focus, is operable and
   dismissible by keyboard, and returns focus sensibly when it closes.
8. **Given** any keyboard action, **When** it changes the draft, **Then** the change is announced
   in a way a screen reader conveys without requiring the teacher to see the canvas.
9. **Given** focus is anywhere in the editor, **When** the teacher looks for it, **Then** a visible
   focus indicator shows where it is.

---

### Edge Cases

- An element is dragged so that part or all of it leaves the canvas bounds. The teacher may have
  meant it — an element can legitimately start off-stage and slide in — so it is permitted, and the
  editor indicates it rather than preventing it.
- An element is resized towards zero. Width and height must stay positive; the transform stops at
  the minimum rather than producing a manifest the schema rejects.
- Snapping and rotation interact: a rotated element's visual bounds are not its stored geometry.
  The spec requires that snapping remain predictable for rotated elements and that it never write a
  geometry the teacher did not ask for.
- The authoring time is moved to a moment where no element is visible. The canvas must not appear
  broken or empty — out-of-window elements are still shown distinctly and remain selectable.
- An element is added while the authoring time is partway through the slide. Its timing must be
  predictable and it must be visible immediately, or insertion appears to have failed.
- A slide's duration is cut below the end of an element that already exists on it — now reachable,
  because duration is editable here. The authoring-time control's range moves with the duration and
  the element's authored values are left alone; the warning this warrants is BR-017 and belongs to
  validation (PB-1). Silently clamping the element would destroy authored work to satisfy a rule
  nothing yet enforces.
- Distribution is requested for fewer than three elements, or alignment for one. The command is
  unavailable rather than silently doing nothing.
- A selection spans locked and unlocked elements. The transform applies to the unlocked members and
  the editor says why the others did not move.
- Two elements carry the same layer order. Render order must remain deterministic and identical in
  editor and player.
- A slide holds the performance fixture's density — 300 elements across 50 slides. Selection and
  drag feedback stay within the 100 ms interaction budget, and moving the authoring time stays
  within the 100 ms seek budget.
- Text is being edited on the canvas when the selection changes, the authoring time moves, or the
  element is deleted. The in-flight text must not be written to a different element or lost without
  being committed.
- The inspector is showing a field while the element behind it is deleted. An in-flight edit must
  not be written to a different element.
- A field's value is changed to something valid for the schema but meaningless for the type — an
  empty button label, a question with no correct option. The editor accepts it and does not corrupt
  it; reporting it is the validation engine's job (PB-1), for the same reason BR-017's warning is
  (FR-052). The mechanism already exists and is deliberately left unwired here: `ElementPlugin`
  carries a `validate` member returning exactly these semantic issues, and this feature gives it no
  consumer. Wiring it would mean shipping half a validation engine — surfacing issues with no
  jump-to-problem, no severity policy, and no publication gate to enforce them.
- Text typed on the canvas contains markup. It is sanitized before it is rendered, on the editor
  path as well as the player path.

## Requirements *(mandatory)*

### Canvas, selection, and authoring time (US1)

- **FR-001**: The editor MUST let a teacher select an element on the canvas, and MUST indicate the
  selection without changing how that element renders.
- **FR-002**: The editor MUST support selecting more than one element, and MUST support clearing
  the selection.
- **FR-003**: The editor MUST let a teacher move, resize, and rotate a selected element
  (FR-CAN-004). Moving MUST apply to the whole selection, which moves as a unit and keeps the
  spacing between its members. Resizing and rotating apply to a single element; transforming a
  multiple selection as one shape is group behaviour (FR-CAN-019) and is out of scope.
- **FR-004**: Element geometry MUST be read and written in logical canvas coordinates, independent
  of the display size at which the canvas is shown (FR-CAN-017).
- **FR-005**: The editor MUST provide snapping guides during a transform, aligning to other
  elements' edges and centres and to the canvas's edges and centre (FR-CAN-007). An edge MUST snap
  when it comes within 8 logical units of a candidate, expressed as a named constant with its
  bounds documented, and the threshold MUST NOT depend on the size at which the canvas is displayed.
- **FR-006**: The editor MUST provide alignment commands for a multiple selection, and distribution
  commands for selections of three or more (FR-CAN-007).
- **FR-007**: A transform MUST NOT produce geometry that the lesson format rejects — widths and
  heights stay positive, and timing values are untouched by geometry operations.
- **FR-008**: A locked element MUST be selectable and MUST NOT be transformable or text-editable
  (BR-011).
- **FR-009**: The editor MUST NOT require measuring the rendered canvas to compute stored geometry;
  a transform expressed in logical coordinates MUST yield the same result at any display size.
- **FR-010**: The editor MUST provide a control that sets the current slide's authoring time, and
  the canvas MUST render the slide at that time through the same resolution the player uses. The
  authoring time defaults to the slide's start.
- **FR-011**: An element whose time window does not contain the authoring time MUST remain visible
  on the canvas in a distinct editor-only treatment, and MUST remain selectable and editable.
- **FR-012**: The authoring time MUST be per-slide editor state. It MUST NOT be written to the
  manifest and MUST NOT influence playback.

### Adding and editing content (US1)

- **FR-013**: The editor MUST let a teacher add any of the MVP element types to the current slide
  through an Add menu (FR-CAN-002, FR-CAN-001).
- **FR-014**: A newly added element MUST be immediately valid — distinct identity, geometry within
  the canvas, positive size, layer order, and a time window — and MUST be visible at the authoring
  time at which it was added.
- **FR-015**: The editor MUST let a teacher edit text directly on the canvas for element types that
  declare an on-canvas text surface, and which types those are MUST come from the type's
  registration rather than from a branch inside the canvas (FR-CAN-005, Constitution I).
- **FR-016**: Entering and leaving text-edit mode MUST be explicit, and while a teacher is editing
  text the canvas's keyboard shortcuts MUST NOT fire.
- **FR-017**: On-canvas text editing MUST NOT introduce a second way of rendering that element's
  text. The editing affordance is additive and MUST be absent during playback.

### Properties inspector (US2)

- **FR-018**: The inspector MUST present the settings appropriate to the current selection, and
  MUST source an element type's fields from that type's registered plugin rather than from a
  per-type branch inside the inspector (FR-CAN-006, FR-FWK-002, Constitution I).
- **FR-019**: The inspector MUST support the field kinds the plugin contract declares, and a plugin
  MUST be able to describe its full settings surface using them. Where it cannot, the contract is
  extended rather than the inspector special-casing the type.
- **FR-020**: Committing a field change MUST update the element in the draft manifest, and MUST
  leave every other element unchanged.
- **FR-021**: The inspector MUST expose alt text for image elements and captions where the element
  type supports them (FR-CAN-014, FR-CAN-015, FR-CAN-016, NFR-ACC-006).
- **FR-022**: The inspector MUST expose the settings common to every element type — position, size,
  rotation, layer order, lock, hide, and timing — alongside the type's own fields.
- **FR-023**: A rejected value MUST produce a message stating the problem, the affected element, and
  the recommended action, and MUST NOT be written to the draft (NFR-USA-004).
- **FR-024**: With nothing selected the inspector MUST show the slide's name, duration, background,
  transition, and accessibility metadata, and MUST NOT expose the slide's advance mode — that
  defers to ED-3/ED-4 along with the cross-field rules BR-005 and BR-006 place on it. With several
  elements selected the inspector MUST show their common settings and indicate differing values.
- **FR-025**: A plugin supplying inspector fields MUST receive only its own element's data and the
  theme, never the lesson, the slide, or its siblings (FR-FWK-011).
- **FR-026**: An element whose type has no registered plugin MUST still be selectable and MUST show
  the common settings, with its type reported as unrecognised (FR-FWK-007).

### Layers and element lifecycle (US3)

- **FR-027**: The editor MUST let a teacher move an element forward or backward in layer order, and
  render order MUST be identical in the editor and the player (FR-CAN-008).
- **FR-028**: Render order MUST be deterministic when two elements share the same layer order.
- **FR-029**: The editor MUST let a teacher lock and unlock an element, and hide and unhide it
  (FR-CAN-009).
- **FR-030**: A hidden element MUST remain in the draft and MUST NOT render in preview or playback
  (BR-010).
- **FR-031**: A hidden element MUST be visible *as hidden* on the editing canvas, and MUST be
  selectable there.
- **FR-032**: The editor MUST let a teacher duplicate, copy, paste, and delete elements, and a
  duplicated or pasted element MUST receive an identity distinct from its source (FR-CAN-010).
- **FR-033**: Deleting MUST require an explicit confirmation that names what will be removed, and a
  multiple selection MUST be confirmed once rather than per element (NFR-USA-003, NFR-USA-004,
  Constitution III).

### Keyboard and accessibility (US4)

- **FR-034**: Every action in FR-001 through FR-033 MUST be reachable using a keyboard alone
  (FR-CAN-012).
- **FR-035**: Arrow keys MUST nudge the selected element by 1 logical unit, and by 10 logical units
  with a modifier. Both MUST be named constants, and neither MUST depend on the size at which the
  canvas is displayed.
- **FR-036**: The editor MUST provide the conventional shortcuts for copy, paste, duplicate, and
  delete (FR-CAN-012, NFR-USA-006).
- **FR-037**: The authoring-time control MUST be keyboard-operable and MUST convey its current value
  to assistive technology.
- **FR-038**: Every interactive control on the canvas and in the inspector MUST have an accessible
  name, role, and state, and MUST show a visible focus indicator (NFR-ACC-003).
- **FR-039**: The delete confirmation MUST take focus when it opens, MUST be operable and
  dismissible by keyboard, and MUST return focus predictably when it closes.
- **FR-040**: A change made by keyboard MUST be conveyed to assistive technology, including the
  current selection and the result of a transform.
- **FR-041**: Selection and focus MUST move in an order a teacher can predict from what they see.

### Parity and the manifest (all stories)

- **FR-042**: The canvas MUST render elements through the same renderer and the same resolution the
  learner player uses, and MUST NOT pass the resolver anything that changes *which* elements come
  back. A second render path MUST NOT be introduced (Constitution V, FR-PLY-001).
- **FR-043**: Editor-only affordances — selection indicators, handles, snap guides, text-editing
  affordances, and the rendering of hidden and out-of-window elements — MUST live in a layer outside
  the element renderers and MUST NOT reach playback (FR-PLY-016, Constitution V).
- **FR-044**: Editor state that is not part of the lesson — the selection, hover, snap guides, the
  authoring time, and text-edit mode — MUST NOT be written into the manifest and MUST NOT influence
  playback (Constitution V, spec §7.3).
- **FR-045**: Every edit MUST leave the draft manifest valid against the lesson format, so that the
  editor cannot construct a lesson the player would refuse.
- **FR-046**: Text supplied through any authoring surface — the canvas or the inspector — MUST be
  sanitized before it is rendered, on the editor path as well as the player path (NFR-SEC-007).
- **FR-047**: The editor MUST NOT require a change to the lesson format. Every property this
  feature edits already exists in the manifest; if that proves false, the change ships with a
  `schemaVersion` bump and a migration in the same revision (Constitution I, FR-FWK-005).
- **FR-048**: The editor MUST emit the authoring events the framework declares for element
  insertion, and those events MUST carry no personally identifying information (FR-AN-001,
  FR-AN-004).
- **FR-049**: Editor code MUST be separated from player code such that a learner's player payload
  contains none of it, and the separation MUST be enforced by a blocking automated check rather
  than by convention or by relying on a bundler to remove it.
- **FR-050**: Element identities for added, duplicated, and pasted elements MUST come from an
  injectable source, so that a test can make the editor deterministic without changing how it
  behaves. The default source MUST produce identities that do not collide within a lesson
  (Constitution II).
- **FR-051**: The editor MUST support a read-only mode in which selecting an element, reading its
  settings, moving the authoring time, and copying all remain available, and in which every action
  that would change the draft is unavailable and states why. Copying is permitted because it changes
  nothing; pasting is not. Which users get that mode is the host's decision; the framework MUST NOT
  model roles (§19, §21).
- **FR-052**: Reducing a slide's duration below the end of an existing element or effect MUST NOT
  silently clamp, truncate, or discard the authored values. The warning this warrants is BR-017 and
  belongs to validation (PB-1); until that exists the editor leaves the values intact.

### Key Entities

- **Selection**: which elements the teacher is currently acting on. Editor state, never serialized.
  Ordered, may be empty, may hold one or many.
- **Draft**: the lesson manifest being edited. The single source of truth for everything that
  reaches a learner; the editor holds no parallel model of element state.
- **Authoring time**: the moment within the current slide at which the canvas renders. Editor
  state, per-slide, never serialized. The same quantity ED-3's playhead will set — there is one
  authoring time, not two.
- **Transform**: a proposed change to an element's geometry — position, size, or rotation —
  expressed in logical coordinates, applied only if it yields a valid manifest.
- **Snap guide**: a transient alignment relationship between the element being transformed and
  another element or the canvas. Editor state, never serialized.
- **Inspector specification**: the set of fields an element type declares for editing, supplied by
  the type's registered plugin. Already part of the plugin contract; this feature is its first
  consumer.
- **Edit**: a single change to the draft — a transform, a field change, a reorder, an insertion, or
  a deletion. This feature applies edits; it deliberately keeps no history of them, which is why
  deletion is confirmed rather than reversible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Selecting, moving, or resizing an element produces visible feedback within 100 ms of
  the input (NFR-PERF-002).
- **SC-002**: The editor becomes interactive within 3 seconds for a lesson of 50 slides and 300
  elements, media excluded (NFR-PERF-001).
- **SC-003**: For every MVP element type, geometry authored on the canvas renders at an identical
  position, size, and rotation in the learner player — zero divergence, checked as a fixture rather
  than by eye.
- **SC-004**: For any slide and any time within it, the state the canvas shows at that authoring
  time matches the state the player shows at the same time — zero divergence across the parity
  fixtures.
- **SC-005**: 100% of the actions in User Stories 1 through 3 are performable using a keyboard
  alone.
- **SC-006**: Automated accessibility checks report zero violations on the canvas, the inspector,
  and the delete confirmation, and every interactive control has an accessible name.
- **SC-007**: Zero editor-only fields appear in a saved manifest, verified by comparing a manifest
  before and after an editing session that changes only the selection, the hover, and the authoring
  time.
- **SC-008**: From an empty slide, adding an element, entering its text, sizing it, and giving it alt
  text takes **no more than eight discrete interactions**, and no step requires opening a submenu, a
  settings dialog, or documentation. This is a countable proxy for NFR-USA-001's "without formal
  training": a first-use timing study is not something this project can run, and a success criterion
  nothing can check is decoration. The proxy is weaker than the thing it stands for — it measures the
  shortest path, not whether a teacher finds it — and is chosen because it is the strongest claim
  this project can actually verify.
- **SC-009**: An edge within 8 logical units of a candidate snaps, an edge beyond it does not, and
  when a snap is applied the two aligned edges differ by zero logical units. The same drag produces
  the same stored geometry at every display size.
- **SC-010**: 100% of the seven MVP element types present their settings through their registered
  plugin, with zero per-type branches in the inspector.
- **SC-011**: 100% of the seven MVP element types can be added from the Add menu, and every added
  element passes validation at the moment it is added.
- **SC-012**: No edit performed through the canvas or inspector can produce a manifest that fails
  validation — verified by validating the draft after every edit across a generated sequence of
  edits.
- **SC-013**: No element is ever removed without an explicit confirmation — zero unconfirmed
  deletions across the deletion test suite.
- **SC-014**: BR-010 and BR-011 each have a rule-named test covering the *editor* behaviour this
  feature adds — a hidden element stays selectable on the canvas while remaining absent from
  playback, and a locked element resists transforms while remaining unlockable. Rule-named tests for
  the kernel's half of both rules already exist, and this criterion is deliberately **not** satisfied
  by them (Constitution II).
- **SC-015**: A learner's player payload contains zero editor code, verified by an automated check
  that fails the build rather than by inspection.
- **SC-016**: The same sequence of edits, replayed against the same starting manifest with the same
  injected identity source, produces a byte-identical manifest.
- **SC-017**: In read-only mode, zero edits reach the draft across the full action surface of User
  Stories 1 through 3, including every keyboard shortcut.
- **SC-018**: Moving the authoring time renders the slide's correct state within 100 ms — the same
  budget the constitution sets for a seek, because that is what it is (NFR-PERF-003).

## Assumptions

- **The lesson format already carries everything this feature edits.** `rotation`, `zIndex`,
  `locked`, `hidden`, `style`, and `accessibility` are present on every element variant in the
  schema today, so no `schemaVersion` bump is expected. FR-047 states what happens if that turns
  out to be wrong.
- **The plugin contract's `inspector` member is the source of the field list.** It has existed
  since Wave 1 with no consumer. This feature assumes it is adequate and expects to find out where
  it is not; extending it is in scope, replacing it is not.
- **A newly added element spans the slide's full duration.** It is therefore visible immediately
  whatever the authoring time, which keeps insertion from appearing to fail. A teacher who wants a
  later entrance sets it afterwards, in the inspector now and on the timeline once ED-3 lands.
- **The authoring-time control is a single scrub, not a timeline.** It sets one number. It shows no
  tracks, no per-element bars, and nothing draggable in time. ED-3 replaces the control with the
  real playhead and MUST NOT introduce a second time model beside it.
- **Undo and redo are out of scope.** Deletion is made safe by confirmation, which is the cheaper
  of the two things Constitution III accepts. This is understood to be temporary: FR-CAN-011 and
  ED-5 bring real undo, and the confirmation is expected to be removed then rather than kept
  alongside it.
- **Persistence is not in scope.** Edits change an in-memory draft. Autosave, the offline queue,
  and conflict handling are ED-5. The storage adapter interface they will use already exists.
- **Preview is not in scope.** Rendering a slide on the editing canvas at an authoring time is not
  the same as previewing from a start point, a slide, or a time; that is ED-6, and it is what arms
  the parity gate.
- **The asset library is not in scope.** An inspector field that refers to an asset accepts an
  asset identifier. Uploading and browsing assets (FR-CAN-013) arrives later.
- **The editor targets desktop at 1280 px and wider**, per the constitution's authoring target. A
  touch-first authoring experience is not attempted.
- **Accessibility applies to the authoring surface too.** WCAG 2.2 AA is a merge gate for
  learner-facing UI specifically, but FR-CAN-012 requires keyboard authoring on its own terms, so
  this feature holds the editor to keyboard operability, accessible naming, and visible focus
  without claiming the full learner-facing gate applies.
- **Single-teacher editing.** Concurrent editing of the same draft is explicitly out of MVP scope
  (§19) and is not modelled here.
- **Roles belong to the host, read-only belongs to the editor.** The framework ships no notion of
  Owner, Editor, Reviewer, or Viewer — authentication and authorisation are outside its scope by
  settled decision. It ships the one thing a Reviewer actually needs from it: a mode that renders
  and inspects without editing.

## Out of scope

- Timeline tracks, per-element timing bars, and dragging events in time (ED-3). The authoring-time
  scrub is in scope; nothing that visualises timeline *structure* is.
- Simple Sequence Mode and its conversion to absolute time (ED-4).
- The slide's advance mode, and the element picker and cross-field rules (BR-005, BR-006) that
  editing it requires (ED-3/ED-4).
- Undo/redo history, autosave, and the offline queue (ED-5).
- Preview from start, slide, or time (ED-6), and the editor↔player parity harness (QA-5).
- Asset upload and the asset library (FR-CAN-013).
- The slash-command insertion menu (FR-CAN-003, *Should* priority).
- Persistent element groups and reusable saved groups (FR-CAN-019, FR-CAN-020).
- Slide management — add, duplicate, delete, reorder — and the slide navigator.
- Lesson metadata, validation reporting, and publishing (PB-1, PB-2), including BR-017's warning
  when a slide's duration is cut below an existing event's end, and **semantic validation through
  `ElementPlugin.validate`** — values a type's schema accepts but its meaning does not.
- Real-time collaboration and conflict resolution.

## Dependencies

- **EN-5, the element registry and plugin contract** — supplies `inspector`, and is the reason the
  inspector can be plugin-driven rather than a switch statement. Satisfied.
- **RC-1/RC-2, the React renderers** — supply the single renderer the canvas must reuse. Satisfied.
- **NX-2, CSS-driven logical-canvas scaling** — supplies the coordinate system in which transforms
  are expressed, and the reason FR-009 is achievable. Satisfied.
- **EN-1, the resolver** — supplies the resolution the canvas renders through, at the authoring
  time rather than only at zero. Satisfied.
- **The lesson schema** — supplies every property this feature edits. Satisfied.

## Obligations this feature does not discharge

Carried forward from Wave 3 and unchanged by this feature:

- Navigation buttons render their action but do not act, so `on_click` advance remains unreachable.
- Asset identifiers are resolved by a host-supplied function; BR-018's publishing rule is Wave 5.
- A dead-end lesson is authorable and is reported to the learner but not to the author. This
  feature makes such a lesson *easier* to author, which strengthens rather than weakens the case
  for PB-1.

Opened by this feature:

- **`ElementPlugin.validate` still has no consumer.** This feature gave `inspector` its first one
  after three waves of being a required member nobody called; `validate` remains in exactly that
  position, and PB-1 is the item that owes it one. Recorded here so the next wave does not have to
  rediscover it, which is how this one found `inspector`.

- **Deletion is confirmed rather than reversible**, which satisfies Constitution III at the lower
  of the two bars it sets. ED-5 owes the replacement, and owes removing the prompt rather than
  leaving a lesson-authoring tool that both confirms and undoes every deletion.
- **The authoring-time scrub is a second control that sets a time the playhead will also set.**
  ED-3 owes the merge. Two controls writing one value is acceptable for one feature and is a parity
  hazard if it outlives ED-3.
