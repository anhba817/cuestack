# Feature Specification: A learner can move through a lesson

**Feature Branch**: `012-learner-navigation`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "Implement that button"

## Context

An author can place a **Continue** button on a slide. It renders correctly, it is
keyboard-operable, a screen reader announces it properly — and pressing it does nothing.

The framework has carried this since Wave 2. `ButtonElement.tsx` says so in its own header:
*"`open_url` works now. The navigation actions do not… the seam Wave 3 wires up."* Wave 3
shipped, then Wave 4, then Wave 5. Nothing wired it.

**The gap is wider than the button, and the wider half is worse.** A slide can declare
`advance: { mode: 'on_click' }` — continue when the learner asks. The kernel implements that
rule and tests it thoroughly. Nothing in either adapter ever tells the kernel a learner asked:
both pass `learnerAdvanced: false`, permanently. The player's controls offer play, pause, and
seek-within-a-slide; there is no *next slide*. So a learner on such a slide has nothing to
press, and no way forward.

**And the validator approves it.** `checkReachability` returns null for `on_click`, under a
test named *"reports nothing for the two rules that cannot be unsatisfiable"*. The premise is
sound — a learner can always click — and false in this framework, because there is nothing to
click. A teacher authors the slide, validation passes it, publishing accepts it, and every
learner stops there permanently with no problem reported, precisely because the kernel is
certain this mode cannot strand anyone.

This is the twelfth instance of the pattern this project keeps recording: a contract member
declared with no producer. It is the first that reaches a learner.

## Clarifications

### Session 2026-08-21

- Q: When a slide is set to continue on the learner's request but the author placed no button, how should a learner move on? → A: The author must place one; validation refuses a lesson without it, matching the rule `after_media_ends` and `after_interaction` already follow.
- Q: Should the web-component adapter now render buttons, given the reason it declined them was the defect this feature fixes? → A: Yes. `button` joins its covered set; it is the only declined type whose exclusion had no standing reason of its own.
- Q: When a learner presses Continue and the slide changes, where should keyboard focus go? → A: To the new slide's container. The player already announces the change; what was missing is placement, and an unmanaged focus falls to the document body.
- Q: If a slide that waits for the learner carries only a Back button, does that count as having a way forward? → A: No. Validation requires a `next_slide` control specifically; a slide whose only control goes backwards is still a dead end going forwards.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A learner presses Continue and the lesson continues (Priority: P1)

A teacher places a button on a slide and sets it to continue. A learner reaches the slide,
reads it, and presses the button when ready. The lesson moves to the next slide.

**Why this priority**: It is the whole of the reported defect, it is the most common thing a
teacher builds — Studio defaults a new button to `next_slide`, labelled "Continue" — and it
is the smallest slice that turns an inert control into a working one. Shippable alone.

**Independent Test**: Author a two-slide lesson with a `next_slide` button on the first.
Press it. The second slide shows.

**Acceptance Scenarios**:

1. **Given** a slide carrying a button whose action is `next_slide`, **When** a learner
   presses it, **Then** the lesson moves to the next slide.
2. **Given** the same button, **When** a learner reaches it by keyboard alone and presses
   Enter or Space, **Then** the same thing happens.
3. **Given** a button on the **last** slide, **When** a learner presses it, **Then** the
   lesson reports itself complete rather than moving nowhere or erroring.
4. **Given** a button whose action is `open_url`, **When** a learner presses it, **Then** it
   behaves exactly as it does today — this story changes nothing about the action that works.
5. **Given** a slide that continues only after a required question is answered, carrying a
   `next_slide` button, **When** a learner presses that button at any point, **Then** nothing
   moves and the control reports itself unavailable throughout. The gate holds.
5a. **Given** a slide that advances **after its duration** and carries a required question and a
   `next_slide` button, **When** a learner presses the button before answering, **Then** nothing
   moves. BR-005 outranks the clock and outranks the button; a control that skipped it would
   defeat a rule the kernel already enforces, from the one place the kernel is not consulted.
6. **Given** the same slide, **When** the learner answers, **Then** the slide advances by its
   own rule, as it does today — the button neither blocks that nor is needed for it, and does
   not briefly become operable on the way out.
7. **Given** the same slide in the editor's preview with advance gates released, **When** a
   teacher looks at the button, **Then** it still reports itself unavailable — the release moves
   the lesson, not the control.

---

### User Story 2 - A slide that waits for the learner can be left (Priority: P1)

A teacher sets a slide to continue *when the learner asks* rather than after a fixed time. A
learner finishes reading and moves on.

**Why this priority**: Also P1, and separately shippable, because it is the half that strands
people. A lesson with such a slide is unfinishable today, and nothing warns anybody — not the
validator, not the editor, not the player. A button is one way to ask; a learner who has no
button must still have a way.

**Independent Test**: Author a slide with `advance: { mode: 'on_click' }` carrying a
navigation control. A learner leaves it when they choose, and not before. Author the same
slide with no control, and the lesson is refused before it can reach anybody.

**Acceptance Scenarios**:

1. **Given** a slide that continues on the learner's request and carries a button, **When**
   the learner presses the button, **Then** the slide is left.
2. **Given** such a slide with **no** navigation control, **When** the lesson is checked,
   **Then** it is reported as a dead end and publishing refuses it — the author is told at
   authoring time rather than a learner discovering it at playback time.
3. **Given** such a slide, **When** its authored duration elapses, **Then** the lesson does
   **not** move on by itself — the learner was asked, and waiting is the point.
4. **Given** such a slide that *does* carry a control, **When** the lesson is checked, **Then**
   nothing is reported: the slide is satisfiable and the check must not cry wolf.

---

### User Story 3 - A learner can go back and repeat (Priority: P2)

A teacher places a button that returns to the previous slide, or replays the current one. A
learner who missed something uses it.

**Why this priority**: Lower than P1 because a lesson without it is still finishable, and the
format has allowed both actions since Wave 1 while neither has ever worked. Two of the four
authored actions are inert; this story is the other one.

**Independent Test**: Author buttons for `previous_slide` and `replay_slide`. Both move the
learner where their labels say.

**Acceptance Scenarios**:

1. **Given** a `previous_slide` button on the second slide, **When** a learner presses it,
   **Then** the first slide shows, from its beginning.
2. **Given** a `previous_slide` button on the **first** slide, **When** a learner presses it,
   **Then** nothing moves and nothing errors.
3. **Given** a `replay_slide` button, **When** a learner presses it, **Then** the current
   slide restarts, including its effects.
3a. **Given** a slide that waits for a required question, carrying Back and Replay buttons,
   **When** a learner presses either before answering, **Then** both work. Only `next_slide` is
   unavailable there; a learner in front of a question must still be able to review it.
4. **Given** a learner replays a slide they had already finished, **When** they reach the end
   again, **Then** the lesson reports completion again rather than staying silent.

---

### User Story 4 - A teacher is told when a slide cannot be left (Priority: P2)

A teacher builds a slide that waits for the learner and gives them no way to ask. Before
publishing, they are told.

**Why this priority**: The safety net for US2. It is separable because US2 can ship without
it, and it is worth having because the failure it catches is invisible at authoring time and
total at playback time.

**Independent Test**: Author a slide that waits for the learner and remove every way forward.
The validation report names the slide and says what is missing.

**Acceptance Scenarios**:

1. **Given** a slide that continues on the learner's request with no `next_slide` control,
   **When** the lesson is checked, **Then** the report names the slide and explains the
   problem in words a teacher can act on.
1a. **Given** such a slide whose only control is a Back button, **When** the lesson is checked,
   **Then** it is still reported, and the message says the controls present do not move the
   learner forward rather than saying there are none.
2. **Given** the same lesson, **When** a teacher attempts to publish it, **Then** publishing
   refuses, as it does for other dead ends.
3. **Given** a lesson where every such slide has a way forward, **When** it is checked,
   **Then** no such problem is reported.

---

### Edge Cases

- **A slide gated on something the player cannot draw.** `button` becomes covered in both
  adapters, but `question` does not — so a slide that advances `after_interaction` on a
  question is still a wall in the web component. A learner there must be told, not stranded;
  the existing unavailable-and-cannot-advance report already covers this and must keep
  covering it, with `button` removed from what it reports.
- **A button pressed while the lesson is paused.** Pressing a navigation control is the
  learner asking to move; it should not silently do nothing because the clock is stopped.
- **A `next_slide` button on a slide gated on media.** The same shape as the question case and
  the same answer: the control is unavailable until the media ends. The format allows the
  combination, so the behaviour cannot be left to whether an author avoids it.
- **A button pressed twice quickly, or held.** One press is one movement.
- **A button whose action is `open_url` with no URL.** Already possible in the format;
  behaviour must not regress.
- **`previous_slide` from the first slide, `next_slide` from the last.** Neither may move
  past the ends, and neither may error.
- **A slide reached by going back.** Its effects, timing, and any interaction state must
  behave as a fresh visit, consistent with how the kernel already keys decisions per visit.
- **A learner using a screen reader.** Movement between slides must be announced; a silent
  change of content is a learner who does not know anything happened.
- **Focus when a slide changes by itself.** The same placement question applies to a slide
  that advances on its own while a learner has focus somewhere on it — the answer must not be
  specific to having pressed a button.
- **Focus when a slide is replayed.** The slide does not change, but its content restarts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A learner MUST be able to tell the lesson they are ready to move on, and that
  request MUST reach the rule that decides whether a slide is over.
- **FR-002**: A slide that continues on the learner's request MUST NOT continue on its own
  when its authored duration elapses.
- **FR-003**: An authored button whose action is `next_slide`, `previous_slide`, or
  `replay_slide` MUST perform that action when a learner presses it.
- **FR-003a**: **A `next_slide` control is available exactly when the lesson would let the
  learner leave the slide, and at no other time.** It MUST NOT move a learner past any condition
  the slide declares for leaving it, and MUST report itself unavailable and do nothing whenever
  such a condition is unmet.
  This is stated as one rule rather than a list of cases **because the list kept being wrong**.
  Earlier drafts enumerated it mode by mode and missed, in turn: that the format permits a
  Continue button on a gated slide at all; that "unavailable until the gate is satisfied"
  describes a state lasting one frame; and — the one that matters most — that a **required
  question blocks leaving on every advance mode, not just the gated ones**. That last is BR-005,
  a business rule this framework already enforces in its kernel, and an enumeration that omitted
  it would have shipped a Continue button skipping required questions on timed slides.
  Two conditions are known today and the rule is not limited to them: a required interaction not
  yet completed (BR-005), and an advance mode that declares its own gate.
- **FR-003d**: The framework MUST answer "may the learner leave this slide if they ask?" in **one
  place**, as a question that can be asked without changing anything. Today it cannot be asked at
  all: the rule lives inside the advance controller's `evaluate`, which records that a slide has
  decided — so asking it speculatively **consumes the decision and the slide never advances**.
  The alternative is each adapter reimplementing the rule, which puts a business rule in three
  places and guarantees they diverge. Neither is acceptable, so the kernel MUST expose the
  question. **This requirement exists because the previous wording invited the broken route**: a
  rule described as "derived from what the kernel permits" reads as an instruction to ask the
  kernel, and the obvious way to ask is the one that breaks.
- **FR-003c**: `previous_slide` and `replay_slide` MUST remain available on a gated slide.
  Neither carries a learner *past* anything — both move away from the gate — and a gated slide
  is where a learner most wants them: to re-read what came before, or to repeat the material
  they are being questioned about. A rule written as "navigation is unavailable on a gated
  slide" would trap a learner in front of a question with no way to review it, which is a worse
  failure than the one FR-003a prevents.
- **FR-003b**: A control's availability MUST describe the lesson, not the tools looking at it.
  The editor's preview can release advance gates so a teacher need not answer every question
  while checking a lesson; that release moves the *lesson*, and MUST NOT make a control report
  itself differently. A teacher previewing sees what a learner sees, which is the point of
  preview.
- **FR-004**: `open_url` MUST continue to behave exactly as it does today.
- **FR-005**: Every navigation control MUST be operable by keyboard alone, and MUST announce
  itself and its effect to assistive technology.
- **FR-006**: A slide that continues on the learner's request MUST carry a control whose
  action moves the learner **forward** — `next_slide`. Back and replay do not satisfy it: a
  slide whose only control goes backwards is still a dead end going forwards, and a rule
  written as "carries a navigation control" would pass a lesson nobody can finish. The
  framework MUST NOT supply the control on the slide's behalf: the manifest is the source of
  truth, and a player-supplied affordance would be absent for any host that embeds the player
  without its optional controls.
- **FR-007**: Movement to a different slide MUST be announced to assistive technology. The
  player already does this for slides that advance on their own; a slide the learner asked to
  leave MUST be announced the same way, through the same mechanism rather than a second one.
- **FR-007a**: When a slide change removes the control a learner was focused on, focus MUST
  move to the incoming slide's container rather than being lost. An unmanaged focus falls to
  the document body: the announcement is still heard, and the learner is no longer anywhere.
- **FR-008**: A navigation action that cannot move MUST do nothing, without error, and MUST
  NOT present itself as operable when it is not. Three cases and no more: back from the first
  slide, forward from the last, and `next_slide` on a slide that declares a gate (FR-003a).
  Every other combination of action and advance mode stays available — see FR-003c.
- **FR-009**: Pressing a navigation control MUST move the learner exactly once per press.
- **FR-010**: Reaching the end of a lesson MUST be reported each time it happens, including
  after a learner has gone back and played to the end again.
- **FR-011**: A slide that continues on the learner's request and carries no `next_slide`
  control MUST be reported as a dead end by validation, and MUST be refused by publishing —
  the same treatment, and for the same reason, as a slide that waits for media it does not
  contain. This changes a rule the validation engine states confidently today.
- **FR-011a**: The report MUST distinguish a slide with no controls at all from one whose
  controls all point backwards. The second is the easier mistake to make and the harder to see,
  and a message naming only "no way to continue" would leave an author looking at a button.
- **FR-011b**: An author who places a `next_slide` control on a slide that declares a gate MUST
  be told it can never be operated there. Not an error — the slide is satisfiable through its
  gate and is not a dead end — but a warning, because after this feature such a control is
  permanently unavailable and nothing at authoring time would say why. **This is the feature's
  own defect one level up**: a control that does nothing and nobody is told. The framework's
  validation already carries warning-severity findings for authoring mistakes that are not dead
  ends, so this needs no new mechanism.
- **FR-012**: The framework MUST NOT hand a renderer the transport, the lesson, the slide, or
  the current time. A renderer that can reach the lesson becomes one that does, and third-party
  renderers then break whenever the lesson shape changes. Whatever route carries the learner's
  intent MUST be as narrow as the one questions already use.
- **FR-013**: Both adapters MUST render buttons and MUST let a learner navigate with them.
  `button` joins the web-component adapter's covered set, and the four places that state what
  that adapter does not do — its package description, its README, its covered set, and its
  behaviour — MUST agree afterwards.
- **FR-013a**: The remaining differences between the adapters MUST stay reported rather than
  silent. `video`, `audio`, and `question` are still declined, and each still has a reason of
  its own: media ports and playback synchronisation for the first two, interaction state and
  gating for the third.
- **FR-014**: The behaviour MUST hold in the editor's preview as it does in the player, since
  preview and playback are the same renderer.

### Key Entities

- **Learner intent**: the fact that a learner has asked to move on. Distinct from time
  elapsing and from an interaction being completed, which the framework already models. It is
  momentary — it describes a press, not a state to be stored.
- **Navigation action**: what an authored button does — continue, go back, replay, or open a
  URL. Already part of the lesson format; unchanged by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can complete a lesson whose slides wait for them, using only the
  controls the lesson presents.
- **SC-002**: 100% of the navigation actions the lesson format allows work in **both**
  adapters. None is silently inert, and none is reported unavailable — buttons are covered
  everywhere after this feature.
- **SC-003**: A lesson that cannot be finished is reported before publication rather than
  discovered by a learner.
- **SC-004**: Every navigation control is reachable and operable by keyboard alone, and the
  learner-facing surface reports no new accessibility violations.
- **SC-005**: A learner using a screen reader is told when the slide changes, and a learner
  navigating by keyboard is left somewhere on the new slide rather than at the top of the page.
- **SC-006**: Going back and playing forward again produces the same lesson the second time,
  including its effects and its completion.
- **SC-007**: A renderer still receives no access to the lesson, the slide, the transport, or
  the time — verified structurally, not by review.
- **SC-008**: What a learner sees and can do is the same in the editor's preview as in the
  player.
- **SC-009**: The reported agreement between the two adapters covers navigation, and any
  difference between them is a stated scope decision rather than an accident.

## Assumptions

- **The lesson format does not change.** All four actions and the `on_click` advance mode
  already exist in the schema and have since Wave 1. This feature makes them work; it adds no
  variant and needs no migration.
- **The kernel's rule is correct and stays as it is.** `on_click` advance is implemented and
  tested in `@cuestack/core`. What is missing is a producer for the signal it consumes, not a
  change to the rule.
- **`checkReachability`'s treatment of `on_click` will need revisiting.** It currently reports
  nothing, on the premise that a learner can always click. FR-011 makes that premise
  conditional on a way forward existing, which is a change to a rule the validation engine
  states confidently today.
- **The web-component adapter's covered set widens by exactly one.** `button` was excluded
  *because* navigation was unreachable in both adapters, and that reason expires here — leaving
  it out would define the covered set partly by an expired excuse, and would make `covered.ts`'s
  stated reason false on the day this ships. It would also make every slide that waits for the
  learner a dead end there, since FR-006 requires such slides to carry a control the adapter
  would decline to draw. A button renders a label and dispatches intent; it needs no new ports.
  See Clarifications.
- **The player's controls are not the answer, and that was decided rather than assumed.**
  `PlaybackControls` is an opt-in child a host may never render, so an affordance placed there
  would be a guarantee with a hole in it. Nothing prevents a host from offering its own
  navigation; the framework simply does not rely on it. See Clarifications.
- **No new persistence.** Learner intent is momentary. Nothing here is stored, and nothing
  here carries anything about the learner.
