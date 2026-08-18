# Feature Specification: Preview Harness

**Feature Branch**: `007-preview-harness`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Start ED-6"

Wave 4 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md), third tranche:
ED-6, the preview harness. ED-5 (undo/redo, autosave) and QA-5 (parity harness) remain after it.

This is the feature the product's central promise rests on. §6.3 says it in one line —
**"what you preview is what the learner receives"** — and §17.3 names the moment of truth: "the
teacher must trust that the preview accurately represents the learner experience." Every wave so
far has protected that promise structurally, by keeping one resolver and one transport. None has
let a teacher *check* it.

It is also the item that arms QA-5. `gate:parity` has printed "placeholder" since Wave 1 with an
honest reason each time: it compares preview to playback, and there was no preview to compare. Both
halves now exist.

## Clarifications

### Session 2026-08-18

- Q: When a teacher skips past a gate that would block them — a required question, a video that must finish — should that skip apply just to the one slide they are stuck on, or stay switched on for the rest of the preview? → A: A switch for the preview: turned on once, it lets every gate through until the preview closes, with a persistent indicator saying so.
- Q: When the preview shows a lesson containing images, video, or audio, should it fetch those files the same way the learner's player will, or is showing placeholders acceptable? → A: The same resolver the player uses. Real assets, and a failing one shows the player's own recoverable error state rather than a stand-in.
- Q: When a preview plays all the way to the end of the lesson, what should the teacher see? → A: The player's own completion state, and the preview stays open until the teacher closes it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A teacher watches their lesson as a learner would (Priority: P1)

The teacher presses Preview. The editing chrome goes away and the lesson plays — the same renderer,
the same clock, the same effects a learner will get. They watch, they close it, and they are back
where they were.

**Why this priority**: It is the smallest thing that makes the promise checkable, and every other
story here is a refinement of where the preview starts or what it lets the teacher do. It is also
the whole of §6.3: a preview that runs the player is parity by construction rather than by
comparison.

**Independent Test**: Open a lesson in the editor, start a preview, confirm the lesson plays with
no editing affordances visible, close it, and confirm the editor is where it was left.

**Acceptance Scenarios**:

1. **Given** a lesson open in the editor, **When** the teacher starts a preview, **Then** the
   lesson plays through the same engine the learner's player uses.
2. **Given** a preview, **When** the teacher looks at it, **Then** no selection handle, snap guide,
   ghost, track, or inspector field is visible.
3. **Given** a preview, **When** it renders, **Then** nothing about the editor's own state — which
   element is selected, what the time scale is — reaches it.
4. **Given** a preview, **When** the teacher closes it, **Then** the editor returns to the slide,
   selection, and authoring time it had before.
5. **Given** an unsaved draft, **When** the teacher previews, **Then** the preview shows the draft
   as it stands, not a last-saved version.
6. **Given** a slide carrying an image, a video, or audio, **When** the preview renders it, **Then**
   the real asset is fetched the way the learner's player would fetch it — not a stand-in.
7. **Given** an asset that fails to load, **When** the preview renders, **Then** it shows the same
   recoverable error state a learner would see, rather than hiding the failure behind a placeholder.
8. **Given** a preview, **When** the teacher uses only a keyboard, **Then** they can start it,
   operate it, and close it.
9. **Given** a preview, **When** it is open, **Then** focus moves into it and returns to the
   control that opened it when it closes.

---

### User Story 2 - A teacher checks the moment they are working on (Priority: P2)

The teacher is timing a fade at four seconds into slide three. They do not want to watch two
minutes of lesson to see it. They preview from the current time, watch the fade, and go back.

**Why this priority**: §17.3's "time-consuming restart" is the named friction, and it is the
difference between a preview a teacher uses constantly and one they use twice. It depends on US1
existing and nothing else depends on it.

**Independent Test**: Put the playhead at a known moment on a known slide, preview from there, and
confirm the preview begins at that moment on that slide rather than at the lesson's start.

**Acceptance Scenarios**:

1. **Given** a slide and an authoring time, **When** the teacher previews from the current
   position, **Then** playback begins at that moment on that slide.
2. **Given** any slide, **When** the teacher previews from the current slide, **Then** playback
   begins at that slide's start.
3. **Given** any position, **When** the teacher previews from the beginning, **Then** playback
   begins at the lesson's first slide at zero.
4. **Given** a preview started mid-lesson, **When** it runs past the end of that slide, **Then** it
   advances as the lesson says it should rather than stopping because it started late.
5. **Given** a preview started at a moment, **When** the teacher restarts it, **Then** it returns to
   the moment the preview started from, not to the lesson's beginning.

---

### User Story 3 - A teacher drives the preview (Priority: P3)

Play, pause, scrub, jump to the next slide or back to the previous one, restart, close.

**Why this priority**: A preview that can only be watched from the beginning is a video. These
controls are what make it a *test*. It ranks below starting position because a teacher who can
start where they need to can already check most things.

**Independent Test**: With a preview open, use each control and confirm it does what it says.

**Acceptance Scenarios**:

1. **Given** a playing preview, **When** the teacher pauses, **Then** it holds that moment.
2. **Given** a paused preview, **When** the teacher scrubs, **Then** the lesson shows the moment
   under the control.
3. **Given** a preview on any slide but the last, **When** the teacher goes to the next slide,
   **Then** it plays from that slide's start.
4. **Given** a preview on any slide but the first, **When** the teacher goes to the previous slide,
   **Then** it plays from that slide's start.
5. **Given** the last slide, **When** the teacher looks for "next", **Then** it is unavailable and
   says so rather than doing nothing.
6. **Given** the last slide, **When** it finishes, **Then** the preview shows the same completion
   state a learner would see and stays open until the teacher closes it.
7. **Given** a finished preview, **When** the teacher restarts it, **Then** it plays again from
   where the preview began.
8. **Given** a required question the teacher has answered, **When** they restart the preview,
   **Then** the question is unanswered again and gates the slide as it would for a learner meeting
   it for the first time.
9. **Given** any control, **When** the teacher reaches it by keyboard, **Then** it is operable and
   announces what it does.

---

### User Story 4 - A teacher tests a lesson that would otherwise trap them (Priority: P4)

The slide waits for a video to end, or for a required question to be answered correctly. The
teacher is checking the timing of the slide *after* it. They turn on "ignore gates", move through
the lesson freely, and the switch dies with the preview.

One switch rather than one skip per gate. A teacher testing slide nine of a gated lesson would
otherwise pay eight separate skips to get there, which is the friction that makes a feature go
unused — and the risk it introduces, forgetting the switch is on, is exactly what the persistent
indicator exists to prevent.

**Why this priority**: FR-ADV-011 exists because without it a teacher testing slide nine has to
answer eight questions correctly first, every time. It is also the feature that makes a *dead-end*
lesson diagnosable — a state the framework has been able to author since Wave 3 and has reported
only to the learner.

**Independent Test**: Preview a slide gated by a required question, override the gate, confirm the
lesson advances, close the preview, and confirm the lesson is unchanged.

**Acceptance Scenarios**:

1. **Given** a slide gated by a required interaction, **When** the teacher turns on the override,
   **Then** the preview advances.
2. **Given** a slide that advances on a click no player can yet deliver, **When** the override is
   on, **Then** the preview advances — the override is what keeps such a slide from being a dead
   end for the teacher testing the one after it.
3. **Given** a slide gated by media that has not ended, **When** the override is on, **Then** the
   preview advances.
4. **Given** the override turned on once, **When** the teacher reaches a second and a third gated
   slide, **Then** each advances without being asked again.
5. **Given** the override on, **When** the teacher turns it off mid-preview, **Then** every gate
   applies again from that moment.
6. **Given** the override on, **When** the teacher looks anywhere in the preview, **Then** it says
   gates are being ignored — a teacher who forgets will conclude the lesson works when what worked
   was the switch.
7. **Given** the override on, **When** the preview closes, **Then** the switch is gone: reopening
   the preview starts with gates applying, and nothing about it is stored.
8. **Given** a lesson that cannot be completed at all, **When** the teacher previews it, **Then**
   they are told which slide strands the learner and why.

---

### User Story 5 - The preview says what a learner would see, at what size (Priority: P5)

The teacher switches the preview between desktop, tablet, and mobile sizes and confirms the slide
holds together at each.

**Why this priority**: §7 lists device presets among the preview's affordances and the framework
already scales the logical canvas proportionally (FR-CAN-018), so this is mostly *exercising* a
property the engine has rather than building one. It is last because a teacher can learn most of
what they need at one size.

**What a preset can and cannot show.** Because the canvas fixes the lesson's aspect ratio and every
dimension beneath it scales with the canvas, a smaller preview is the same picture at a smaller
size — same layout, same relative type, nothing reflowed. The one thing that does change is that
type stops shrinking at the player's legibility floor, so below a certain size it becomes
proportionally larger than authored and can outgrow the box it was placed in. That is the whole
teacher-visible content of this story, and the story is only worth building because it is real.

**Independent Test**: Preview at each preset and confirm the lesson renders at the expected size
with no element repositioned in the manifest, and that at tablet and mobile the type held at the
legibility floor is visibly larger than the authored proportion.

**Acceptance Scenarios**:

1. **Given** a preview, **When** the teacher chooses a preset, **Then** the lesson renders at that
   size, keeping its own aspect ratio.
2. **Given** the tablet or mobile preset, **When** the lesson renders, **Then** type that would fall
   below the player's legibility floor is held at it, and a teacher can see whether text still fits
   the box it was authored in.
3. **Given** any preset, **When** the lesson renders, **Then** no stored geometry changes — the
   canvas scales, the lesson does not.
4. **Given** a preset, **When** the teacher closes and reopens the preview, **Then** the choice is
   not carried into the manifest.

---

### Edge Cases

- Previewing a one-slide lesson. Next and previous are both unavailable and must say so rather than
  appearing to work.
- Previewing from a time past the current slide's duration. The authoring time is clamped per slide,
  so this cannot arise from the playhead — asserted rather than assumed.
- Previewing a slide with no elements. Legal, and the preview must show an empty stage rather than
  an error.
- Previewing a lesson whose first slide is empty at time zero. The reference lesson is exactly this,
  and it is how a rendering bug hid for a whole wave.
- A lesson whose final slide never ends — gated on a click no player delivers. With the override on
  the preview reaches the completion state; with it off it does not, and that is the lesson's own
  behaviour rather than the preview's failure.
- A host with real analytics wired in. The preview emits none of the learner's events — not on open,
  not on a slide, not at the end, and least of all under the override (FR-031).
- Going **back** to a slide whose question the teacher already answered. The answer stands and the
  slide does not gate again — that is what a learner navigating within one run would experience, and
  it is deliberately not what restart does (FR-032). Restart means a fresh run; previous and next
  are movement within the run in progress.
- Closing the preview while it is playing. The clock stops; nothing keeps running behind the editor.
- **Opening** the preview while the editor is playing. The editor's own clock stops first, at the
  moment the preview opened. Two clocks over one slide would be two answers to what time it is, and
  the authoring time FR-006 promises to restore would have moved while the teacher was watching.
- Editing while a preview is open. Out of scope — the preview is modal — but it must be impossible
  rather than undefined, which is FR-030: the editor behind is unreachable, not merely covered.
- A lesson with a slide that advances on click. Navigation buttons still render their action without
  acting, so a click cannot advance the slide — the preview gets past it through US4's override,
  which is the same mechanism a media gate or a required question needs. Making buttons *act* is a
  player capability and stays out of scope; what this feature owes is that no slide can trap a
  teacher testing the one after it.
- A required question answered *incorrectly* in preview. The lesson's own rule applies; the preview
  does not soften it except through the explicit override.
- Previewing at the performance fixture's scale. Starting a preview is a mount, not a re-render, and
  must not take longer than the editor took to become interactive.
- An asset that cannot be resolved. The preview shows what a learner would see, which is the
  player's recoverable error state — and that is the *point*: a teacher discovering a broken asset
  in preview is the failure working as designed.
- Reduced motion. A teacher who has asked their own system for less motion sees the reduced
  substitution in preview — which is correct, and must not be mistaken for the lesson being wrong.

## Requirements *(mandatory)*

### One engine (US1)

- **FR-001**: The preview MUST use the same renderer and timing engine as the learner's player
  (FR-PLY-001, Constitution V). It MUST NOT introduce a second rendering path, a second clock, or a
  second implementation of any effect.
- **FR-002**: The preview MUST show the draft as it currently stands, including unsaved changes.
- **FR-003**: The preview MUST resolve assets through the same host-supplied function the player
  uses, so a teacher sees the real image and hears the real audio. An asset that fails MUST show the
  player's own recoverable error state (FR-PLY-011, FR-PLY-012) rather than a stand-in — a preview
  that hid the failure would make a broken slide look deliberate here and broken in production.
- **FR-004**: No editor-only affordance MUST appear in the preview — no selection indicator, handle,
  snap guide, ghost, track, playhead, or inspector (FR-PLY-016, BR-010).
- **FR-005**: No editor state MUST reach the preview: selection, time scale, open view, and the
  authoring time are not lesson data (FR-PLY-016).
- **FR-006**: Closing the preview MUST return the editor to the slide, selection, and authoring time
  it held before.
- **FR-007**: The preview MUST be operable by keyboard throughout, and MUST take focus when it opens
  and return it when it closes (NFR-ACC-002).

### Where it starts (US2)

- **FR-008**: The teacher MUST be able to preview from the beginning of the lesson (FR-PLY-002).
- **FR-009**: The teacher MUST be able to preview from the current slide (FR-PLY-003).
- **FR-010**: The teacher MUST be able to preview from the current timeline position (FR-PLY-004).
- **FR-011**: A preview started at a position MUST continue through the lesson from there, obeying
  each slide's own advance rule.
- **FR-012**: Restarting a preview MUST return to the position the preview began at, not to the
  lesson's beginning — a teacher checking a moment wants that moment again.
- **FR-032**: Restarting a preview MUST also return the *lesson* to its starting state: questions
  unanswered, gates re-armed, nothing carried over from the run just finished. A restart that kept
  the teacher's answers would replay a lesson in which every gate is already satisfied — and
  "does that question actually stop it?" is one of the two reasons a teacher restarts at all. This
  is FR-020's rule applied to a different control: turning the override off restores every gate
  immediately, and so does starting again.

### Driving it (US3)

- **FR-013**: The preview MUST provide play, pause, seek, previous slide, next slide, restart, and
  close (FR-PLY-005).
- **FR-014**: Previous and next MUST be unavailable at the ends of the lesson, and MUST say why
  rather than being inert.
- **FR-015**: Reaching the end of the lesson MUST show the same completion state a learner would see
  (FR-PLY-014), and the preview MUST stay open until the teacher closes it. Closing on the teacher's
  behalf would make the ending the one part of the lesson a preview refuses to show — and what a
  lesson says after its final slide is a thing teachers get wrong and cannot otherwise check.
- **FR-016**: Every control MUST be keyboard-operable with an accessible name, and MUST show a
  visible focus indicator (NFR-ACC-002, NFR-ACC-003).

### Testing a gated lesson (US4)

- **FR-017**: The preview MUST offer a single override the teacher turns on and off, which lets
  **every** gate through while it is on — a required interaction, media that has not ended, or a
  click no player can yet deliver (FR-ADV-011). No slide may trap a teacher testing the one after
  it, and reaching a late slide MUST NOT cost one action per gate along the way.
- **FR-018**: The override MUST last only for the preview. It MUST start off every time a preview
  opens, and nothing about it is written to the lesson (FR-PLY-016).
- **FR-019**: While the override is on the preview MUST say so continuously, not once. A teacher who
  forgets a switch they set several slides ago will conclude the lesson works when what worked was
  the switch — and the longer a switch lasts, the more that matters.
- **FR-020**: Turning the override off MUST restore every gate immediately, so a teacher can skip to
  a late slide and then test it under the lesson's real rules.
- **FR-021**: A lesson that cannot be completed MUST be reported to the teacher, naming the slide and
  the reason. The kernel already detects this and has reported it only to the learner.

### Size (US5)

- **FR-022**: The preview SHOULD offer desktop, tablet, and mobile viewport presets (FR-PLY-006).
- **FR-023**: Changing the preset MUST change only the rendered **size**. No stored geometry
  changes, because geometry is in logical coordinates (FR-CAN-017, FR-CAN-018). Not the
  *proportion*: a lesson's aspect ratio is fixed by its canvas, so a preset makes the lesson smaller
  and never a different shape.
- **FR-024**: At the tablet and mobile presets the preview MUST show the lesson at a size where the
  player's minimum type size takes effect, because that is the only thing a preset can reveal. Every
  dimension scales with the canvas, so a smaller preview is otherwise pixel-identical to a larger
  one — except that type stops shrinking at a legibility floor and becomes proportionally larger
  than authored. A teacher's real question is whether the slide still holds together at that point,
  and this is what lets them answer it.

### Across all stories

- **FR-025**: The preview MUST NOT require a change to the lesson format.
- **FR-026**: The preview MUST NOT be able to modify the draft. It is a viewer; editing is the
  editor's.
- **FR-027**: The preview MUST remain within the defined timing tolerance of published playback for
  non-streaming elements (FR-PLY-018).
- **FR-028**: Every registered element and effect MUST render the same in preview as in playback,
  and this MUST be verified automatically rather than asserted (FR-FWK-013). This is what arms the
  parity gate.
- **FR-029**: In read-only mode the preview MUST remain available. Reviewing a lesson is reading it,
  and a reviewer who cannot preview cannot review (FR-COL-001).
- **FR-030**: While a preview is open the editor behind it MUST be unreachable — not merely covered.
  A teacher who moves focus out of the preview would land on an editing control whose keys act
  immediately, and the edit would be invisible, because the preview holds the draft as it stood when
  it opened. The spec has recorded from the first draft that editing while previewing must be
  *impossible rather than undefined*; this is the requirement that makes it so.
- **FR-031**: A preview MUST NOT emit the learner's analytics events. Opening, playing, skimming, or
  overriding through a lesson is a teacher checking their work, and a host reading its own telemetry
  MUST NOT be told a lesson was started or a slide completed because of it. This matters most under
  the override, which would otherwise report completions no learner earned. The events the player
  emits are deliberately designed and deliberately anonymous; the preview must not be what makes
  them untrue.

### Key Entities

- **Preview session**: where playback started, whether an override is in effect, and which viewport
  preset is chosen. Editor state, never serialized.
- **Start point**: a slide and a moment. Derived from the editor's current position at the instant
  the preview opens; not stored, and not updated as the preview runs.
- **Progression override**: one switch, off by default, which lets every gate through while it is
  on. Exists only while the preview is open, and is announced continuously for as long as it lasts.
- **Viewport preset**: a width the stage is rendered at. The lesson keeps its own aspect ratio and
  scales down; what changes is whether type reaches the player's legibility floor. Changes what is
  drawn, never what is stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every registered element and effect type, the render state in preview and in
  playback is identical at the same moment — zero divergence, verified automatically. This is the
  parity gate, armed.
- **SC-002**: A teacher can go from editing to watching the current moment in one action.
- **SC-003**: Preview and published playback stay within 100 ms of each other for non-streaming
  elements (FR-PLY-018, §9).
- **SC-004**: Zero editor-only affordances appear in preview, verified by rendering the preview and
  finding no editor markup at all.
- **SC-005**: Zero preview state — start point, override, viewport preset — appears in a saved
  manifest.
- **SC-006**: 100% of the actions in User Stories 1 through 5 are performable using a keyboard
  alone.
- **SC-007**: Automated accessibility checks report zero violations on the preview and its controls,
  and every interactive control has an accessible name.
- **SC-008**: A lesson gated at several slides can be tested past all of them with **one** action,
  and the lesson afterwards is byte-identical to the lesson before.
- **SC-009**: A preview opens within the editor's own interactive budget at 50 slides and 300
  elements — it is a mount, and it must not cost more than the editor did.
- **SC-010**: Closing a preview leaves the editor's slide, selection, and authoring time unchanged,
  verified by comparing before and after.
- **SC-011**: A lesson that strands the learner is identified to the *teacher*, naming the slide.
- **SC-013**: A preview played to the end shows the lesson's completion state, and the teacher —
  not the preview — decides when it closes.
- **SC-012**: The parity gate fails when preview and playback are made to diverge — verified by a
  negative control, because a gate that has never been observed failing is not known to be a gate.

## Assumptions

- **The player is reused wholesale, not reimplemented.** `LessonPlayerClient` already accepts a
  starting slide index, real ports, and an `onReady` callback carrying the transport — which is how
  a preview seeks to a starting moment without the player needing to know what a preview is. If this
  proves false, the finding is that the player's props are the wrong shape, and fixing them is
  better than growing a second player.
- **Parity is structural before it is tested.** One resolver, one transport, one effect
  implementation — the property SC-001 verifies is one the architecture already has. The gate exists
  to catch the day someone breaks it, not to establish it now.
- **The editor already holds everything the start point needs.** The session knows the slide and the
  authoring time; nothing new is stored to support previewing from a position.
- **Overriding progression is a *player* concern the editor asks for.** The advance controller
  decides whether a slide may advance; a preview needs to ask it to say yes. Where that permission
  lives is a design question for planning, not a scope question.
- **The host supplies the asset resolver, and the preview inherits it.** Asset ids are resolved by a
  host-supplied function — that has been true since Wave 3 and is BR-018's unfinished business for
  Wave 5. The preview does not resolve assets differently; it is handed the same function the
  editor and the player already receive.
- **Undo is still out of scope.** ED-5 owns it. The preview writes nothing, so it needs none.
- **Persistence is still out of scope.** The preview reads the in-memory draft.
- **The editor targets desktop at 1280 px and wider**, per the constitution's authoring target. The
  viewport presets change the *preview's* size, not the editor's.
- **`prefers-reduced-motion` is the teacher's own setting**, and the preview honours it as the
  player would. A teacher who has asked for less motion sees the reduced substitution, which is
  correct and is worth saying because it looks like a bug.

## Out of scope

- Undo/redo, autosave, and the offline queue (ED-5).
- Editing while previewing. The preview is modal; a teacher closes it to change something.
- Slide management and the slide navigator.
- Publication and the publish-time validation gate (PB-1). A dead-end lesson is *reported* here;
  blocking a publish is Wave 5's.
- Sharing a preview link, or previewing as a named learner. Wave 5's collaboration items.
- Recording or exporting a preview.
- Device *emulation* beyond size — no touch simulation, no user-agent spoofing. The presets change
  how much room the stage has, which is what FR-CAN-018 makes meaningful.

## Dependencies

- **RC-1, the React player** — supplies the renderer, the transport, and the controls this reuses.
  Satisfied.
- **ED-1 through ED-4, the editor** — supply the draft, the current slide, and the authoring time a
  preview starts from. Satisfied.
- **EN-2, the transport** — supplies the clock and the seek a start point needs. Satisfied.
- **EN-3, the advance controller** — supplies the progression rules an override has to ask past, and
  the reachability report FR-018 surfaces. Satisfied.
- **QA-5** depends on *this*: it is the parity harness, and it cannot exist until a preview does.

## If this feature has to be cut

US5, the viewport presets, is the cut line. It is a `Should` in the source requirements rather than
a `Must`, it exercises a property the engine already has rather than adding one, and nothing else
depends on it. Losing it costs a teacher the ability to check a mobile layout before publishing —
real, and the least of what is here.

US4 is the next to consider and a harder loss: without it, testing slide nine of a gated lesson
means answering eight questions first, every time. It would make the preview something teachers use
twice.

US1 through US3 are the feature.

## Obligations this feature discharges

- **The parity gate stops being a placeholder.** It has printed "placeholder" since Wave 1 with an
  honest reason each time — there was no editor, then no preview. Both halves now exist, and FR-025
  is what arms it.
- **A dead-end lesson becomes visible to its author.** Wave 3 made it reportable to the learner and
  recorded that reporting it to the *author* was Wave 5's validation engine. A preview is an earlier
  and better place to notice, and it does not replace the publication gate.

## Obligations this feature does not discharge

- Navigation buttons render their action but do not act, so `on_click` advance remains unreachable.
  This feature does not fix that; it makes it *survivable*, because US4's override moves past any
  gate including this one. Previewing the reference lesson therefore reaches its last slide and
  needs the override to leave it — a worse experience than a working button and a better one than a
  dead end, and it is worth saying which of the two this is.
- `ElementPlugin.validate` still has no consumer. PB-1 owes it one.
- The two confirmations standing in for undo remain. ED-5 owes their removal.
- The theme-values gate still cannot see CSS, so colour literals in stylesheets remain
  convention-enforced project-wide.
