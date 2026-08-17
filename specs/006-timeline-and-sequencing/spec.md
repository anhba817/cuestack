# Feature Specification: Timeline and Simple Sequence Mode

**Feature Branch**: `006-timeline-and-sequencing`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Start ED-3 and ED-4"

Wave 4 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md), second
tranche: ED-3 (timeline UI — tracks, playhead, drag) and ED-4 (Simple Sequence Mode ↔ timeline).
ED-5 (undo/redo, autosave), ED-6 (preview harness), and QA-5 (parity harness) remain.

Feature 005 gave a teacher a slide they can compose: elements added, arranged, described, and
managed. What it did not give them is **time**. An element's `startMs` and `endMs` are two numbers
in a properties panel, effects cannot be created at all, and the only way to see a later moment is
a single scrub control that ED-3 was always going to replace.

This is the feature the product's differentiator rests on. §6.2 promises "simple sequencing and
advanced timing" and §6.1 promises timing a teacher can understand; both are claims about this
surface. It is also where the framework's own eight effects finally become reachable — they have
been implemented, tested, and unusable by a teacher since Wave 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A teacher sees when everything on the slide happens (Priority: P1)

A teacher looks below the canvas and sees a track for every element on the slide, each drawn as a
bar spanning the time that element is on screen. A ruler runs across the top with a playhead on it.
Moving the playhead moves the canvas: at any moment the canvas shows what a learner would see then.

**Why this priority**: It is the smallest thing that makes time visible, and every other story here
changes something a teacher must first be able to see. It also discharges an obligation feature 005
opened deliberately: the authoring-time scrub was a single control writing a value the playhead
would also write, and two controls writing one number is a parity hazard the moment both exist.

**Independent Test**: Open a slide whose elements appear at different moments, confirm each has a
track positioned and sized to its timing, move the playhead, and confirm the canvas shows the
state a learner would see at that moment. Requires no dragging and no sequencing.

**Acceptance Scenarios**:

1. **Given** a slide with elements, **When** the timeline renders, **Then** each element has one
   track whose bar starts and ends at that element's authored times.
2. **Given** the timeline, **When** the teacher moves the playhead, **Then** the canvas renders the
   slide at that moment and the two never disagree about the time.
3. **Given** the timeline ruler, **When** the teacher clicks or drags along it, **Then** the
   playhead moves to that moment.
4. **Given** an element the resolver omits at the current moment — hidden, or outside its window —
   **When** the teacher looks at the timeline, **Then** it still has a track, because it still has
   timing to author.
5. **Given** a slide with many elements, **When** the teacher changes the time scale, **Then** the
   tracks rescale and the playhead stays at the same moment.
6. **Given** the timeline, **When** the teacher uses only a keyboard, **Then** they can move the
   playhead, move between tracks, and read the current time.
7. **Given** the timeline and the canvas, **When** either changes the moment, **Then** there is one
   authoring time and no second control disagreeing with it.
8. **Given** the timeline, **When** the teacher presses play, **Then** the playhead advances on a
   real clock and the canvas keeps step with it.
9. **Given** a slide playing, **When** the teacher presses pause, **Then** the playhead stops where
   it is and the canvas holds that moment.
10. **Given** a slide playing, **When** the teacher presses restart, **Then** the playhead returns to
    the slide's beginning and plays from there.
11. **Given** a slide playing, **When** the teacher drags the playhead, **Then** the drag commands
    the clock rather than fighting it, and playback resumes from where they left it.
12. **Given** a slide playing, **When** the document is hidden, **Then** playback pauses, as it
    already does for a learner (BR-013).

---

### User Story 2 - A teacher changes when things happen by dragging (Priority: P2)

The teacher drags a bar to move an element later, drags its left handle to make it appear sooner,
and drags its right handle to keep it on screen longer. The numbers in the properties panel follow.

**Why this priority**: It is the reason a timeline is worth building rather than a pair of number
fields — §6.2's "timing understandable without timeline expertise" is a claim about direct
manipulation. It depends on US1 existing and nothing else depends on it.

**Independent Test**: Drag a bar and both handles, confirm the element's stored times change to
match, and confirm the same values appear in the inspector.

**Acceptance Scenarios**:

1. **Given** a track bar, **When** the teacher drags it, **Then** the element's start and end move
   together and its duration is unchanged.
2. **Given** a track bar's leading handle, **When** the teacher drags it, **Then** the element's
   start changes and its end does not.
3. **Given** a track bar's trailing handle, **When** the teacher drags it, **Then** the element's
   end changes and its start does not.
4. **Given** any drag, **When** it would make an element end at or before it starts, **Then** the
   drag stops at the shortest the format permits rather than writing a lesson the player refuses.
5. **Given** any drag, **When** it completes, **Then** the stored values are non-negative integer
   milliseconds.
6. **Given** a drag near another element's start or end, **When** it comes within the snap
   threshold, **Then** it aligns to that moment exactly, as the canvas already does with position.
7. **Given** a locked element, **When** the teacher drags its bar, **Then** nothing changes and the
   editor says why.
8. **Given** timing changed on the timeline, **When** the teacher looks at the inspector, **Then**
   it shows the same values — one source of truth, two views of it.

---

### User Story 3 - A teacher makes something appear, move, and leave (Priority: P3)

The teacher adds a fade to an element so it arrives rather than blinking into existence, sets how
long it takes, and adds a second effect that emphasises it later. The effects appear on the
element's track at the moments they run.

**Why this priority**: The framework has shipped eight effects since Wave 1 — appear, fade, slide,
zoom, pulse, highlight, dim, disappear — every one implemented, tested, and **unreachable by a
teacher**. Until this story, `Element.effects` is a field only a hand-written manifest can populate.
It sits below the timeline itself because an effect is authored against time, and time has to be
visible first.

**Independent Test**: Add a fade to an element, set its duration, play or scrub through it, and
confirm the element fades. Then add a second effect and confirm both run in chronological order.

**Acceptance Scenarios**:

1. **Given** a selected element, **When** the teacher adds an effect, **Then** it is added with a
   phase, a start, and a duration that make it immediately valid and visible on the track.
2. **Given** an effect, **When** the teacher changes its duration, **Then** the change is stored and
   the canvas shows it at the current moment.
3. **Given** an effect with parameters, **When** the teacher changes one, **Then** the effect's
   appearance changes accordingly.
4. **Given** an effect, **When** the teacher removes it, **Then** the element keeps its own timing
   and only the effect is gone.
5. **Given** two effects on one element with different start times, **When** they run, **Then** they
   run in chronological order.
6. **Given** two effects on one element with the same start time, **When** they run, **Then** the
   order is deterministic and the same every time.
7. **Given** an effect whose duration would be zero or negative, **When** the teacher tries to set
   it, **Then** it is refused with a reason, because a duration must be positive.
8. **Given** an effect that moves the element, **When** a learner has asked for reduced motion,
   **Then** the reduced alternative the framework already computes is what plays.

---

### User Story 4 - A teacher sequences without touching the timeline (Priority: P4)

The teacher does not want to think in milliseconds. They say this thing happens *with* the previous
one, that one happens *after* it, and the third two seconds after that. The timeline fills in.

"Thing" is an **event** — an element appearing, or an effect running. A teacher revealing a list one
line at a time is sequencing effects, not elements, and that is the case this mode exists for.

**Why this priority**: §7.1 — "simple first, precision on demand" — and Goal 2, making timing
understandable. It is the mode most teachers will use, and it is fourth because it is a view onto
timing that has to exist and be visible first.

**Independent Test**: Set three elements to With Previous, After Previous, and After Previous with a
delay; confirm the absolute times the timeline shows; switch to the timeline and confirm they are
unchanged.

**Acceptance Scenarios**:

1. **Given** an event, **When** the teacher sets it to start With Previous, **Then** it starts at
   the same moment as the event before it.
2. **Given** an event, **When** the teacher sets it to start After Previous, **Then** it starts when
   the event before it ends.
3. **Given** an event set to After Previous, **When** the teacher adds a delay, **Then** it starts
   that long after the previous event ends.
4. **Given** any sequence, **When** it is applied, **Then** every event has absolute times, and
   nothing about the sequence is stored beyond those times.
5. **Given** a sequence, **When** the teacher switches to the timeline, **Then** every generated
   value is preserved exactly.
6. **Given** timing edited on the timeline into something no simple relationship describes, **When**
   the teacher returns to the sequence view, **Then** that event is shown as Custom rather than
   silently reinterpreted.
7. **Given** a Custom event, **When** the teacher chooses to make it simple again, **Then** they are
   told what timing precision would change and must confirm before it is applied.
8. **Given** the first event on a slide, **When** the sequence view renders, **Then** it has no
   previous event and is shown as starting at the slide's beginning.
9. **Given** an element with two effects, **When** the teacher sequences them, **Then** the effects
   are events in the same ordered list as the elements, so a list can be revealed one line at a
   time without opening the timeline.

---

### User Story 5 - The slide and what is on it stay consistent (Priority: P5)

An element runs past the end of its slide. The teacher is told, on the timeline, where the overrun
is — and offered a way to extend the slide to fit rather than being left to work out the number.

**Why this priority**: BR-017 has been unenforceable since Wave 0 and feature 005 deliberately left
it that way — it recorded that the editor must not silently clamp, and that the warning belonged to
validation. A timeline is the first surface that can *show* an overrun rather than describe it.

**Independent Test**: Author an element ending after the slide's duration, confirm the timeline
identifies it, use the offered action, and confirm the slide extends to contain it.

**Acceptance Scenarios**:

1. **Given** an element or effect ending after the slide's duration, **When** the timeline renders,
   **Then** the overrun is identified and attributed to the element it belongs to.
2. **Given** an identified overrun, **When** the teacher chooses to extend the slide, **Then** the
   duration grows to contain the latest element or effect.
3. **Given** a slide's duration reduced below an existing end, **When** the change is applied,
   **Then** the authored values are left intact and the overrun is reported.
4. **Given** an overrun, **When** the teacher looks at it, **Then** the message states the problem,
   the affected element, and what they can do about it.
5. **Given** no overrun, **When** the timeline renders, **Then** it says nothing about durations.

---

### Edge Cases

- A slide of zero elements. The timeline has a ruler, a playhead, and no tracks, and must not look
  broken — a teacher's first slide is empty.
- A slide of zero duration. Legal — the format allows it, and a slide that advances on a click has no
  reason to carry a duration. The ruler has no width to draw, and every element on the slide ends
  after it, so the overrun report must describe the slide once rather than each element in turn.
- An element whose window is a single millisecond. Its bar must remain visible and grabbable at any
  time scale; a bar too small to hit is a bar that cannot be edited.
- An element starting at zero and ending at the slide's duration. Both handles sit on the boundary
  and must still be distinguishable from the ruler's ends.
- Dragging a bar to a negative start. Timing values are non-negative, so the drag stops at zero
  rather than writing a value the format rejects.
- Two effects on one element that overlap in time. Legal, and the timeline must show both rather
  than collapsing them.
- An effect starting after the element it belongs to has already gone. Authorable, and the timeline
  says so — the effect would never run.
- A slide of 300 elements at the performance fixture's density. The timeline scrolls and stays
  responsive; a track list that must all be laid out at once is a track list that is unusable
  exactly where a lesson is most complex.
- Simple Sequence over an element whose previous sibling is hidden. Hidden affects playback, not
  authoring order, so the relationship is to the previous element in order regardless.
- A sequence where the previous element has no end — every element has an end in this format, so
  this cannot arise; asserted rather than assumed.
- Reordering elements while a sequence is applied. Relationships are to whatever is previous, so a
  reorder can change what the sequence view *shows* — but it changes no stored timing. Only applying
  a sequence writes times. And the effect is narrower than it first appears: events are ordered by
  their start time first and by stacking order only as a tie-break, so reordering three elements that
  start at different moments changes nothing at all. It matters when two events start together.
- Changing the time scale mid-drag. The drag continues against the moment it started from, not the
  pixel it started from.

## Requirements *(mandatory)*

### The timeline, and one authoring time (US1)

- **FR-001**: The editor MUST provide a timeline for the selected slide (FR-TIM-001).
- **FR-002**: Every element on the slide MUST have exactly one track, positioned and sized to that
  element's authored start and end (FR-TIM-002).
- **FR-003**: An element the resolver omits at the current moment — hidden, or outside its window —
  MUST still have a track, because it still has timing to author.
- **FR-004**: The timeline MUST display a playhead, and moving it MUST change the moment the canvas
  renders (FR-TIM-005).
- **FR-005**: The teacher MUST be able to seek by clicking or dragging on the ruler (FR-TIM-006).
- **FR-006**: There MUST be exactly one authoring time. The timeline replaces feature 005's scrub
  rather than sitting beside it, discharging the obligation that feature recorded.
- **FR-007**: The timeline MUST support changing the time scale, and the playhead MUST stay at the
  same moment across a change (FR-TIM-008).
- **FR-008**: The timeline MUST provide controls for the current time, and MUST convey the current
  moment to assistive technology with a subject rather than as a bare number.
- **FR-009**: The timeline MUST be keyboard-operable: moving the playhead, moving between tracks,
  and reading the current time (FR-CAN-012, NFR-ACC-002).
- **FR-010**: The timeline MUST provide play, pause, and restart controls that run a real clock
  (FR-TIM-007). Playback MUST derive from the framework's existing monotonic transport rather than
  from a second timing mechanism, and MUST pause when the document is hidden as playback already
  does (FR-TIM-019, BR-013).
- **FR-011**: There MUST be exactly one clock in the editor. The playhead reflects it while playing
  and commands it while seeking; a paused playhead and a dragged playhead set the same value.

### Changing timing by dragging (US2)

- **FR-012**: Dragging a track bar MUST move an element's start and end together, leaving its
  duration unchanged (FR-TIM-004).
- **FR-013**: Dragging a bar's leading or trailing handle MUST change that end alone (FR-TIM-003).
- **FR-014**: A drag MUST NOT produce timing the lesson format rejects: ends stay after starts, and
  values stay non-negative integer milliseconds (FR-TIM-009, FR-TIM-015, BR-001, BR-002, BR-003).
- **FR-015**: A drag MUST snap to other elements' starts and ends within a stated threshold, landing
  on the moment exactly, as the canvas already does with position.
- **FR-016**: A locked element MUST NOT be re-timed by dragging, and the editor MUST say why
  (BR-011).
- **FR-017**: Timing changed on the timeline and timing changed in the inspector MUST be the same
  values — two views, one source of truth (FR-SEQ-005's principle, applied here).

### Effects become authorable (US3)

- **FR-018**: The teacher MUST be able to add an effect to an element, choosing from the effects the
  framework registers rather than from a list this feature maintains (FR-TIM-010, FR-TIM-011,
  Constitution I).
- **FR-019**: A newly added effect MUST be immediately valid — a phase, a start, and a positive
  duration — and MUST be visible on the element's track.
- **FR-020**: The teacher MUST be able to change an effect's duration and its supported parameters
  (FR-TIM-012), and which parameters those are MUST come from the effect's registration.
- **FR-021**: The teacher MUST be able to remove an effect, leaving the element's own timing intact.
- **FR-022**: Effects on one element MUST run in chronological order, and MUST have a deterministic
  order when two share a start time (FR-TIM-013, FR-TIM-014).
- **FR-023**: An effect duration of zero or less MUST be refused with a reason (FR-TIM-015, BR-004).
- **FR-024**: The reduced-motion alternative the framework already computes MUST continue to apply
  to any effect authored here — the editor adds effects, it does not add a second motion path
  (BR-015).
- **FR-025**: Effects MUST be fully authorable here — added, configured, and removed. Nothing in the
  product can currently create one, so anything less leaves all eight registered effects
  unreachable by a teacher and `Element.effects` a field only a hand-written manifest can populate.
- **FR-026**: The set of effects offered, and which parameters each accepts, MUST come from the
  effect registry rather than from a list this feature maintains. A per-effect branch is the switch
  statement Constitution I calls a defect (FR-FWK-003, FR-FWK-004).

### Simple Sequence Mode (US4)

- **FR-027**: The editor MUST provide a sequence view as a simpler alternative to the timeline
  (FR-SEQ-001).
- **FR-028**: The teacher MUST be able to set an event to start With Previous, After Previous, or
  After Previous with a delay (FR-SEQ-002, FR-SEQ-003, FR-SEQ-004).
- **FR-029**: A sequence MUST resolve to absolute timing values, and **MUST NOT introduce any
  storage of its own**. Both views read and write the same timeline data (FR-SEQ-005, BR-016,
  Constitution III).
- **FR-030**: Switching from the sequence view to the timeline MUST preserve every generated value
  exactly (FR-SEQ-006).
- **FR-031**: An event whose timing no simple relationship describes MUST be shown as Custom
  rather than silently reinterpreted, and what counts as simple MUST be stated (FR-SEQ-007).
- **FR-032**: Returning a Custom event to a simple relationship MUST state what timing precision
  would change and MUST require confirmation before applying it (FR-SEQ-008).
- **FR-033**: The first event in order has no previous event and MUST be shown as starting at the
  slide's beginning.
- **FR-034**: Reordering elements MUST re-classify the sequence view, because relationships are to
  whatever is previous — and an element carries its effects with it. It MUST NOT rewrite any stored
  timing: reordering is a stacking change, and a stacking change that silently altered when things
  happen would be a destructive edit with no undo behind it (ED-5 owns undo). Times change when the
  teacher applies a sequence, and only then.
- **FR-035**: Simple Sequence MUST order **events**, where an event is an element appearing or an
  effect running. FR-SEQ-002 and FR-SEQ-003 say "element", but UC-02 is titled *Create a
  Chronological Effect Sequence*, and a teacher wanting a list to reveal one line at a time is the
  canonical case §7.1 exists to serve. Sequencing elements alone would leave that requiring the
  timeline — the expertise the mode exists to avoid demanding.
- **FR-036**: A relationship MUST be expressible between any two adjacent events, whether they are
  two elements, two effects on one element, or an element and an effect.

### The slide and its contents (US5)

- **FR-037**: An element or effect ending after the slide's duration MUST be identified and
  attributed to the element it belongs to (FR-TIM-016).
- **FR-038**: The teacher MUST be offered a way to extend the slide to contain the latest element or
  effect (FR-TIM-017).
- **FR-039**: Reducing a slide's duration below an existing end MUST leave the authored values
  intact and report the overrun. Nothing is silently clamped or truncated (BR-017, and feature 005's
  FR-052 carried forward).
- **FR-040**: An overrun message MUST state the problem, the affected element, and the recommended
  action (NFR-USA-004).

### Across all stories

- **FR-041**: Every change MUST leave the draft valid against the lesson format, so the editor
  cannot construct a lesson the player would refuse.
- **FR-042**: Every change MUST pass through the editor's existing single mutation path, so
  read-only refusal and post-edit validation continue to hold without restatement (FR-051 of
  feature 005).
- **FR-043**: The timeline MUST render through the same resolution the player uses. It MUST NOT
  introduce a second computation of what is on screen at a moment (Constitution V).
- **FR-044**: Timeline state that is not part of the lesson — the time scale, scroll position, which
  view is open, and the authoring time — MUST NOT be written into the manifest.
- **FR-045**: The editor MUST NOT require a change to the lesson format. `Element.effects` and every
  timing field already exist; if that proves false, the change ships with a `schemaVersion` bump and
  a migration in the same revision (Constitution I, FR-FWK-005).
- **FR-046**: Every surface this feature adds MUST be keyboard-operable with accessible names,
  roles, and states, and MUST show a visible focus indicator (NFR-ACC-002, NFR-ACC-003).
- **FR-047**: In read-only mode every action that would change the draft MUST be unavailable and say
  why, while seeking and reading remain available.

### Key Entities

- **Track**: one element's timing, drawn. Derived from the element, never stored.
- **Playhead**: the authoring time, drawn on the ruler. The same single value the canvas renders at
  — not a second one.
- **Time scale**: how much time a unit of width represents. Editor state, never serialized.
- **Effect**: already part of the lesson format — a type, a phase, a start, a duration, an explicit
  order, and optional easing and parameters. This feature makes it authorable; it does not define it.
- **Event**: the unit a sequence orders — an element appearing, or an effect running. Derived by
  reading the slide, never stored. It exists because a teacher revealing a list one line at a time
  is sequencing effects, and a mode that could only order elements would send them to the timeline
  for the commonest case it exists to serve.
- **Sequence relationship**: With Previous, After Previous, After Previous with a delay, or Custom.
  **Derived from absolute times, never stored** — the constitution forbids mode-specific storage.
- **Transport**: the clock playback runs on. Already built (Wave 1) and already the player's; the
  editor drives the same one rather than a second.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every element on a slide, the track's start and end match the element's authored
  values exactly — zero divergence across the parity fixtures.
- **SC-002**: The canvas and the timeline never disagree about the current moment; there is one
  authoring time and one control writing it.
- **SC-003**: Moving the playhead renders the correct state within 100 ms at 50 slides and 300
  elements — it is a seek (NFR-PERF-003).
- **SC-004**: Dragging a bar or handle produces visible feedback within 100 ms at the same density
  (NFR-PERF-002).
- **SC-005**: No timeline or sequence action can produce a manifest that fails validation, verified
  by validating after every edit across a generated sequence.
- **SC-006**: All eight registered effects can be applied to an element from the editor, and each
  one visibly changes what the canvas renders at a moment within its window.
- **SC-007**: A sequence of With Previous and After Previous relationships resolves to absolute
  times, and switching to the timeline changes zero values.
- **SC-008**: Zero sequence-specific fields appear in a saved manifest, verified by comparing a
  manifest before and after applying a sequence and then reading it back.
- **SC-009**: 100% of the actions in User Stories 1 through 5 are performable using a keyboard
  alone.
- **SC-010**: Automated accessibility checks report zero violations on the timeline, the sequence
  view, and the effect controls, and every interactive control has an accessible name.
- **SC-011**: An element or effect ending past the slide's duration is identified 100% of the time,
  and the offered action extends the slide to contain the latest one exactly.
- **SC-012**: The timeline stays responsive at 50 slides and 300 elements, with tracks scrollable
  rather than all laid out at once.
- **SC-013**: BR-016 and BR-017 each have at least one test named for their rule ID, covering the
  behaviour this feature adds (Constitution II).
- **SC-014**: Zero editor-only fields — time scale, scroll, open view, authoring time — appear in a
  saved manifest.
- **SC-015**: Playing a slide advances the playhead on the same clock the player uses, and pausing,
  seeking, and hiding the document behave as they already do during playback — verified against the
  transport rather than against a second timing mechanism.
- **SC-016**: A list of elements revealed one line at a time can be authored entirely in the
  sequence view, without opening the timeline. This is UC-02, and it is the case that decides
  whether the mode serves the teacher §7.1 describes.

## Assumptions

- **The lesson format already carries everything this feature edits.** `Element.effects` exists with
  a type, phase, `startMs`, `durationMs`, explicit `order`, easing, and parameters; element timing is
  `startMs` and `endMs`; slide duration is `durationMs`. No `schemaVersion` bump is expected, and
  FR-042 states what happens if that turns out to be wrong.
- **Simple Sequence stores nothing, because the constitution forbids it.** "Simple Sequence Mode and
  Timeline Mode MUST read and write the same timeline data. Mode-specific storage MUST NOT be
  introduced." A relationship is therefore *derived* from absolute times, and Custom is a derived
  classification rather than a stored flag. This settles the largest design question in ED-4 before
  it is asked.
- **What counts as "simple" is defined, not intuited.** An element is With Previous when it starts at
  the same moment as the previous element, After Previous when it starts at the previous element's
  end, and After Previous with a delay when it starts at a fixed offset after that end. Anything else
  is Custom. FR-029 requires this stated because otherwise it is untestable.
- **The kernel already detects overruns.** `resolve()` emits problems for effects and elements that
  extend beyond the slide, and nothing has ever consumed them. US5 is largely a consumer for a
  mechanism that exists — the same shape as feature 005 finding `ElementPlugin.inspector` unused.
- **Effect parameters come from the effect's registration**, as inspector fields come from an
  element type's. A per-effect branch in the timeline would be the switch statement Constitution I
  calls a defect.
- **Undo is still out of scope.** ED-5 owns it. Destructive actions here — removing an effect — are
  confirmed on the same terms feature 005 set, and the confirmation is expected to be removed when
  real undo lands rather than kept beside it.
- **Persistence is still out of scope.** Edits change an in-memory draft; ED-5 wires storage.
- **Preview is still out of scope.** Rendering the slide at a moment is not previewing from a start
  point; ED-6 owns that, and it is what arms the parity gate.
- **The editor targets desktop at 1280 px and wider**, per the constitution's authoring target.
- **Playback reuses the existing transport rather than introducing a clock.** `createTransport` has
  been in `@cuestack/core` since Wave 1 with play, pause, seek, and visibility handling, and
  FR-TIM-019 requires a single monotonic clock rather than independent animation delays. The editor
  becomes a second consumer of it, which is also the honest reading of what ED-6 will need — the two
  must not end up with separate clocks, and this feature is where that is decided.
- **Effects are authored against the slide's clock, not the element's.** `Effect.startMs` is
  documented in the format as relative to slide time, so an effect's position on a track is directly
  comparable with the element's own bar and no conversion is involved.

## Out of scope

- Undo/redo, autosave, and the offline queue (ED-5).
- Preview from start, slide, or time (ED-6), and the editor↔player parity harness (QA-5).
- The slide's advance mode, which feature 005 also deferred: BR-005 and BR-006 give it cross-field
  rules and an element picker.
- Slide management and the slide navigator — this timeline is for the selected slide (FR-TIM-001).
- Synchronising an element's visibility with media playback (FR-TIM-018). The media port and its
  reconciliation rule exist from Wave 3; authoring a cue against them is a distinct surface.
- Publication-time validation and the jump-to-problem list (PB-1). This feature identifies overruns
  *on the timeline*; blocking a publish is Wave 5's.
- New effect types. The eight registered ones become authorable; adding a ninth is a plugin.
- Multi-select timing edits. Dragging re-times one element at a time.
- Playing *across* slides. Playback runs the selected slide; advancing from one slide to the next is
  the player's behaviour and belongs to preview (ED-6).

## Dependencies

- **ED-1/ED-2, the canvas and inspector** — supply the session, the single mutation path, the
  element registry, and the authoring time this feature takes over. Satisfied.
- **EN-1, the resolver** — supplies the state the timeline renders through and the overrun problems
  US5 reports. Satisfied.
- **EN-4, the effect registry and the eight MVP effects** — supplies what US3 makes reachable.
  Satisfied.
- **EN-2, the transport** — supplies a monotonic clock if FR-010 resolves toward real playback.
  Satisfied.
- **The lesson schema** — supplies every field this feature writes. Satisfied.

## If this feature has to be cut

US4 with effects is the cut line, and it is stated here rather than discovered under pressure.
Sequencing *elements* alone is a smaller mode that still serves the simple case, and the effect half
is what roughly doubles it. Cutting it would leave UC-02 unserved and SC-016 unmet, so it is a real
loss rather than a free saving — but it is the loss that costs least, and it is severable because
nothing else depends on it.

The order of what remains, cheapest to lose last: US5 (overrun identification) depends on nothing
and could follow; US3 (effects) is the largest single addition but is what makes the framework's own
effect library reachable at all; US1 and US2 are the feature.

## Obligations this feature discharges

- **The authoring-time scrub becomes the playhead.** Feature 005 recorded that two controls writing
  one value is acceptable for one feature and a parity hazard if it outlives ED-3. FR-006 closes it.
- **BR-017 becomes enforceable.** Feature 005 required that nothing be silently clamped and left the
  warning to PB-1; US5 gives it a surface, and PB-1 keeps the publication gate.

## Obligations this feature does not discharge

- Navigation buttons render their action but do not act, so `on_click` advance remains unreachable.
- Asset identifiers are resolved by a host-supplied function; BR-018's publishing rule is Wave 5.
- `ElementPlugin.validate` still has no consumer. PB-1 owes it one.
- The delete confirmation remains in place of undo. ED-5 owes its removal, not a companion to it.
- The theme-values gate still cannot see CSS, so colour literals in stylesheets remain
  convention-enforced project-wide.
