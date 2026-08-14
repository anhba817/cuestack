# Feature Specification: Player Completion

**Feature Branch**: `004-player-completion`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Start wave 3"

Wave 3 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md): PL-1
(interactions and gating), PL-2 (media sync, gesture gate, media-end advance), PL-3
(transitions, progress, completion, errors), PL-4 (reduced motion), QA-3 (acceptance
scenarios), QA-4 (playback budgets).

Wave 2 produced a lesson that renders and plays. This wave makes it a lesson a learner can
*complete*: questions that answer, media that keeps time with the slide, an ending that says so,
and motion that respects a stated preference.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A learner answers a question and the lesson responds (Priority: P1)

A learner reaches a question, chooses an answer, and is told whether it was right. If the
question was required, the lesson waited for them; once answered, it moves on.

**Why this priority**: A lesson whose questions cannot be answered is not a lesson. It is the
single largest gap between what Wave 2 ships and what the product claims to be, and every other
story in this wave is an improvement to something that already works. This one makes something
work that does not.

**Independent Test**: Load a lesson containing a required question, let the timer expire, confirm
the lesson has not advanced, answer, and confirm feedback appears and the lesson proceeds. This
is MVP Acceptance Scenario B and can be checked with no media, no transitions, and no reduced
motion.

**Acceptance Scenarios**:

1. **Given** a slide with a required question, **When** the slide's duration elapses and no
   answer has been given, **Then** the lesson stays on the slide.
2. **Given** the learner then answers, **When** the answer is submitted, **Then** feedback is
   shown and the lesson advances according to the configured policy.
3. **Given** a question configured to allow retries with a maximum number of attempts, **When**
   the learner answers incorrectly, **Then** they may try again until the attempts are exhausted,
   and the remaining attempts are stated.
4. **Given** a question with no retries configured, **When** the learner answers, **Then** the
   answer is final and the controls no longer accept input while still announcing the outcome.
5. **Given** an optional question, **When** the slide's duration elapses unanswered, **Then** the
   lesson advances without waiting.
6. **Given** any question, **When** the learner uses only a keyboard, **Then** they can select an
   answer, submit it, and hear the result announced.
7. **Given** the learner answers and then seeks backwards to before the question appeared,
   **When** they return to the question, **Then** their answer is still recorded rather than
   silently discarded.
8. **Given** a learner answers, **When** the answer is recorded, **Then** a structured event is
   emitted describing the response without identifying the learner.

---

### User Story 2 - Media and the lesson keep the same time (Priority: P2)

A slide contains a video. Captions appear when the narrator says the words. The slide does not
move on while the video is still playing, and pausing the video pauses the slide with it.

**Why this priority**: Second because timing is the product's whole proposition and media is the
one element type that has a clock of its own. Two clocks in one lesson is the defect this wave
exists to prevent, and it is invisible until a learner notices a caption arriving a second late.
Below interactions only because a mistimed caption is a flawed lesson and an unanswerable
question is not a lesson.

**Independent Test**: Load a slide set to advance after a video ends, observe that it does not
advance while the video plays, pause the video and observe advancement postponed, then seek the
video to its end and observe exactly one advancement. MVP Acceptance Scenario C.

**Acceptance Scenarios**:

1. **Given** a slide set to advance after a selected video ends, **When** the video is still
   playing, **Then** the slide does not advance.
2. **Given** the same slide, **When** the video is paused, **Then** advancement is postponed
   rather than proceeding on the timer.
3. **Given** the same slide, **When** the video reaches its end, **Then** the lesson advances
   exactly once, even if the end is reported more than once.
4. **Given** an element whose visibility is tied to media playback, **When** the media reaches
   the element's cue time, **Then** the element appears within the stated timing tolerance.
5. **Given** a lesson containing media that would play with sound, **When** it loads without any
   learner action, **Then** playback does not begin and the learner is told how to start it.
6. **Given** the learner has made that initial action, **When** playback begins, **Then** audible
   media plays and the requirement is not asked again for the rest of the lesson.
7. **Given** a slide whose advancement depends on media that fails to load, **When** the failure
   occurs, **Then** the learner is not stranded: the lesson reports the problem and offers a way
   to continue.
8. **Given** the lesson is paused, **When** the learner resumes, **Then** media resumes from
   where it stopped rather than from the beginning.
9. **Given** a slide with playing media, **When** the learner seeks the lesson, **Then** the media
   moves to the corresponding position rather than continuing from where it was.
10. **Given** the learner seeks to a position the media cannot yet play, **When** the seek is
    refused or delayed, **Then** the lesson does not stall and does not silently show a position
    the media is not at.
11. **Given** the learner moves the media with its own native controls, **When** they do, **Then**
    the lesson follows rather than fighting them back to where it thought they were.

---

### User Story 3 - The lesson tells the learner where they are and when they are done (Priority: P3)

Slides change with a visible transition rather than a jump. The learner can see how far through
they are, and when the last slide ends they are told the lesson is complete.

**Why this priority**: These are the things whose absence makes a working player feel unfinished.
A learner who cannot tell whether a lesson has ended will sit waiting; one who cannot see their
position cannot judge whether to continue now or later. Ranked below media because a lesson with
no progress bar still teaches, and a lesson with desynchronised media teaches the wrong thing.

**Independent Test**: Play a lesson from the first slide to past the last, and confirm each slide
change is animated for the authored duration, the progress indicator advances, and a completion
state appears after the final slide.

**Acceptance Scenarios**:

1. **Given** a slide with an authored transition and duration, **When** the lesson advances to it,
   **Then** the transition plays for that duration before the new slide is settled.
2. **Given** a slide with no authored transition, **When** the lesson advances, **Then** the
   change is immediate and nothing animates.
3. **Given** progress display is enabled, **When** the lesson plays, **Then** the learner can see
   their position within the lesson and it advances as slides do.
4. **Given** progress display is not enabled, **When** the lesson plays, **Then** no progress
   indicator is shown and the lesson is otherwise unchanged.
5. **Given** the learner reaches the end of the final slide, **When** it completes, **Then** a
   completion state is shown and announced.
6. **Given** the learner is on the completion state, **When** they choose to review, **Then** they
   can return to the lesson rather than being trapped at the end.
7. **Given** a decorative asset fails to load, **When** the slide plays, **Then** the rest of the
   slide plays normally and the failure does not interrupt the lesson.
8. **Given** a learner seeks or navigates during a transition, **When** the input arrives, **Then**
   the transition resolves without leaving two slides visible.

---

### User Story 4 - A learner who has asked for less motion gets less motion (Priority: P4)

A learner with reduced motion enabled sees the same lesson, in the same order, with movement
replaced by something calmer. Nothing that carried meaning is lost.

**Why this priority**: Fourth by sequencing rather than by importance — it is a MUST and an
accessibility obligation, and a blunt version of it already works: Wave 2's stylesheet neutralises
transforms under a reduced-motion preference on the server-rendered first frame, with no script.
What remains is substituting *per effect* so a slide-in becomes a fade rather than an
instantaneous appearance, which is a refinement of something already correct rather than a gap.

**Independent Test**: Play the corpus with a reduced-motion preference set and confirm every
moving effect resolves to its reduced alternative, that element order and timing are unchanged,
and that no element becomes invisible or unreachable.

**Acceptance Scenarios**:

1. **Given** a reduced-motion preference, **When** a slide or zoom effect would play, **Then** a
   reduced or instant alternative plays instead.
2. **Given** a reduced-motion preference, **When** the lesson plays, **Then** the order in which
   content appears and the times at which it appears are unchanged.
3. **Given** a reduced-motion preference, **When** an effect is substituted, **Then** no
   information conveyed by the original motion is lost.
4. **Given** a reduced-motion preference, **When** a slide transition would play, **Then** it is
   replaced rather than merely shortened.
5. **Given** a reduced-motion preference, **When** the first frame is rendered before any script
   runs, **Then** the preference is already honoured.
6. **Given** the preference changes mid-lesson, **When** it changes, **Then** the lesson responds
   without restarting or losing the learner's place.

---

### User Story 5 - The lesson survives things going wrong (Priority: P5)

An asset fails, a network drops, a slide is misconfigured. The learner sees what happened and can
carry on where carrying on is possible.

**Why this priority**: Last because every story above must exist for this one to have anything to
protect, and because the kernel already reports these conditions — Wave 1 produces blocking and
non-blocking problems that no consumer has yet presented to anyone. This story is largely about
showing what is already known.

**Independent Test**: Play lessons seeded with each failure the kernel can report — a failed
required asset, an unsatisfiable advance rule, an unregistered required interaction — and confirm
each produces a stated, recoverable condition rather than a blank stage or a silent stall.

**Acceptance Scenarios**:

1. **Given** an asset that is required for the slide to make sense fails to load, **When** the
   slide plays, **Then** the learner is shown a recoverable error state naming what is missing.
2. **Given** the same state, **When** the learner retries, **Then** the asset is requested again
   without restarting the lesson.
3. **Given** a slide whose advance rule cannot ever be satisfied, **When** the lesson reaches it,
   **Then** the learner is told and offered a way forward rather than waiting indefinitely.
4. **Given** any error state, **When** it appears, **Then** it is announced to assistive technology
   and reachable by keyboard.
5. **Given** any error state, **When** it appears, **Then** it describes the problem in the
   learner's terms and exposes no authoring detail or internal identifier.

---

### Edge Cases

- A required question that disappears before it is answered, because its end time precedes the
  answer. The format permits authoring this; BR-011 makes it a validation concern, and the player
  must not deadlock on it.
- Two required questions on one slide, one answered and one not.
- A question whose maximum attempts is exhausted with no correct answer, on a slide that gates
  advancement on being correct.
- Seeking backwards past a question that gated advancement, then forwards again.
- Media that is seeked by the learner using its own native controls rather than the lesson's.
- Media whose duration in the manifest disagrees with the actual file.
- A slide set to advance after media ends where the media is muted, or has zero duration.
- A transition duration longer than the slide it is transitioning to.
- The final slide gating on a required question that is never answered — is the lesson completable?
- A lesson of one slide: what does progress show, and what does completion mean?
- Reduced motion enabled together with an effect that has no meaningful reduced alternative.
- The document becoming hidden during a transition, or during the gesture prompt.

## Requirements *(mandatory)*

Each requirement traces to the framework specification in `docs/Cuestack_Framework.md`.

Requirements are **grouped by topic, not numbered down the page**: FR-034 to FR-037 arrived when
the media-directionality question was answered, and sit with the media and parity requirements
they belong to rather than at the end. An ID here is a stable key, and renumbering to make the
page read in order would silently move what other documents point at.

### Interactions (US1)

- **FR-001**: A learner MUST be able to answer single-answer multiple-choice and true-or-false
  questions (FR-INT-001).
- **FR-002**: The system MUST present the authored prompt, options, and feedback for a question
  (FR-INT-003, FR-INT-007).
- **FR-003**: A required interaction MUST prevent automatic slide advancement until it is complete
  (FR-INT-009, BR-005).
- **FR-004**: The system MUST honour the authored retry setting and maximum number of attempts,
  and MUST make the learner's remaining attempts apparent (FR-INT-005, FR-INT-006).
- **FR-005**: The system MUST determine completion of an interaction according to its authored
  completion policy rather than by a fixed rule.
- **FR-006**: A learner's response MUST emit a structured interaction event carrying no learner
  identifier (FR-INT-012, NFR-PRV-002).
- **FR-007**: Every interaction control MUST be operable by keyboard, and its state, feedback, and
  outcome MUST be communicated to assistive technology (FR-INT-013, FR-INT-014).
- **FR-008**: A recorded answer MUST survive seeking within the lesson and revisiting the slide
  within the same session.
- **FR-009**: The system MUST NOT reveal a correct answer before the learner's response is final.
- **FR-010**: The system MUST NOT advance more than once for the same slide state, whatever
  combination of timer, interaction, and media reports completion (BR-007).

### Media (US2)

- **FR-011**: The system MUST support advancing a slide after a selected media element ends
  (FR-ADV-003), and MUST NOT advance while that media is playing or paused.
- **FR-012**: The system MUST treat a repeated media-end report as one event (BR-007, Scenario C).
- **FR-013**: The system MUST support synchronising an element's visibility with media playback
  position (FR-TIM-018).
- **FR-014**: Playback that includes audible media MUST require an initial learner action, and the
  system MUST state what that action is (FR-PLY-007, BR-014).
- **FR-015**: Once that action has been taken, the system MUST NOT require it again for the
  remainder of the lesson.
- **FR-016**: Pausing or resuming the lesson MUST pause or resume its media, and resuming MUST
  continue from the stopped position rather than restarting.
- **FR-017**: When media that a slide's advancement depends on fails, the system MUST report the
  condition and offer a way to continue rather than stalling (FR-PLY-011).
- **FR-018**: The system MUST pause the visual timeline when the document becomes hidden and
  resume from the same position when it becomes active (FR-PLY-008, FR-PLY-009).
- **FR-034**: Seeking the lesson MUST move its media to the corresponding position. The lesson
  commands its media as well as observing it.
- **FR-035**: When media cannot honour a commanded position — the range is not yet playable, or
  the platform refuses — the system MUST NOT stall, and MUST NOT display a position the media is
  not actually at.
- **FR-036**: When a learner moves media using its own native controls, the lesson MUST follow the
  media rather than returning it to the lesson's previous position.

### Transitions, progress, and completion (US3)

- **FR-019**: The system MUST play the authored slide transition type for the authored duration
  (FR-SLD-007).
- **FR-020**: The system MUST display lesson progress when progress display is enabled, and MUST
  omit it otherwise (FR-PLY-013).
- **FR-021**: The system MUST display and announce a completion state after the final slide
  (FR-PLY-014).
- **FR-022**: A learner on the completion state MUST be able to return to the lesson.
- **FR-023**: Failure of a decorative asset MUST NOT prevent the remainder of the slide from
  playing (FR-PLY-012).
- **FR-024**: The system MUST NOT expose authoring-only state or metadata to a learner
  (FR-PLY-016).

### Reduced motion (US4)

- **FR-025**: When a reduced-motion preference is active, the system MUST replace non-essential
  movement with a reduced or instant alternative (BR-015, FR-PLY-017).
- **FR-026**: Substitution MUST preserve the order in which content appears and the times at
  which it appears (Scenario F).
- **FR-027**: Substitution MUST NOT remove information the original motion conveyed, and MUST NOT
  make an element invisible or unreachable.
- **FR-028**: The reduced-motion preference MUST be honoured on the first rendered frame, before
  any script has run.

### Errors (US5)

- **FR-029**: The system MUST present a recoverable error state when an asset required for the
  slide fails to load, and MUST allow retrying it without restarting the lesson (FR-PLY-011).
- **FR-030**: The system MUST present every blocking condition the timing engine reports, in
  terms a learner can act on, and MUST NOT expose internal identifiers or authoring detail.
- **FR-031**: Every error state MUST be announced to assistive technology and reachable by
  keyboard.

### Parity and determinism (all stories)

- **FR-032**: The visible result of arriving at a moment by playing MUST equal the result of
  seeking to it, for the same recorded interaction state (Constitution V).
- **FR-033**: The system MUST NOT introduce a second source of time. Media position, interaction
  state, and transition progress MUST all be expressed against the one timing engine
  (FR-PLY-001).
- **FR-037**: Where the lesson and a media element disagree about position, the system MUST
  resolve the disagreement by one stated rule, applied everywhere, rather than per call site.
  Two clocks are unavoidable once media is involved; two *policies* for reconciling them are not.

### Key Entities

- **Interaction response**: What a learner answered, when, whether it was correct, and how many
  attempts it took. Held for the session; carries no learner identity.
- **Interaction outcome**: Whether an interaction counts as complete, derived from its response
  and its authored completion policy. This is what gating reads.
- **Media link**: The two-way relationship between the lesson and one media element — the
  element's reported position, playing state, and whether it has ended, together with the
  positions and play/pause the lesson has commanded, and which of the two most recently moved.
- **Transition state**: Which slide is leaving, which is arriving, and how far through the change
  is.
- **Playback condition**: A named problem the learner is shown — a failed asset, an unsatisfiable
  advance rule, media that will never end — with whether it can be retried.
- **Progress**: The learner's position in the lesson, expressed in slides completed and total.
- **Motion preference**: Whether reduced motion is active, and what each authored effect resolves
  to when it is.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can answer every question type the MVP supports, using only a keyboard,
  and hear the outcome announced — verified against every question in the corpus.
- **SC-002**: A required question holds the lesson indefinitely and releases it on completion:
  MVP Acceptance Scenario B passes end to end.
- **SC-003**: MVP Acceptance Scenario C passes end to end, including that a duplicated media-end
  report advances exactly one slide.
- **SC-004**: MVP Acceptance Scenario A passes end to end: the authored sequence executes in
  order and within the timing tolerance.
- **SC-005**: MVP Acceptance Scenario F passes: with reduced motion active, every moving effect
  resolves to an alternative, and content order and timing are unchanged.
- **SC-006**: An element synchronised to media appears within the stated timing tolerance of its
  cue, measured against the media's reported position rather than wall-clock time.
- **SC-007**: Playback holds 60 frames per second on reference hardware for the corpus's heaviest
  slide, and remains usable at 30 (NFR-PERF-004). Measured by a repeatable fixture, not by
  observation.
- **SC-008**: Seeking updates the visible slide state within 100 milliseconds, including when
  media and interactions are present (NFR-PERF-003).
- **SC-009**: The rendered result of seeking to any moment equals that of playing to it, for every
  corpus slide and every recorded interaction state — the Wave 2 parity sweep extended to cover
  interaction and media state.
- **SC-010**: No lesson in the corpus can reach a state where the learner can neither progress nor
  be told why.
- **SC-011**: Every learner-facing state added by this wave — feedback, gesture prompt, progress,
  completion, and every error — passes automated WCAG 2.2 AA checking with no violations
  (Constitution III).
- **SC-012**: No learner identifier appears in any emitted interaction event, demonstrated by an
  automated check over the event payloads rather than by inspection.
- **SC-013**: Audible media never plays before a learner action, demonstrated across the corpus.
- **SC-014**: Seeking the lesson to any moment on a media slide leaves the media within the
  stated timing tolerance of that moment, and a seek the media cannot honour leaves the lesson
  responsive with its displayed position honest about where the media actually is.

## Assumptions

- **Answers persist per slide, not per visit, within a session.** A learner who answered a gating
  question correctly and then navigated back should not have to answer it again to pass the same
  gate, and attempts should not be consumed by navigation. Resuming a *partially completed
  lesson* across sessions is FR-PLY-015, a "Should", and is out of scope here.
- **Lesson completion means reaching the end of the final slide.** Per-interaction completion is
  governed by each interaction's authored policy; there is no separate lesson-level pass mark in
  the format, and inventing one would be a product decision rather than an implementation.
- **Progress display is enabled by the host, not by the manifest.** FR-PLY-013 says "where enabled
  by the teacher or organization", and the format carries no such field. Adding one is a format
  change requiring a migration, and the organisation-policy half is BR-012 in Wave 5. A host-level
  option satisfies the requirement now without freezing a format decision early.
- **"Audible" means media with a non-zero volume that is not muted.** A silent video needs no
  gesture, and treating it as though it did would block lessons unnecessarily.
- **The reduced-motion preference is read from the platform.** There is no in-lesson toggle; the
  learner has already stated this preference at the system level and asking again is worse than
  honouring it.
- **The timing tolerance is the one already defined** for non-streaming elements (FR-PLY-018,
  NFR-ACC-001), not a new figure introduced here.
- **QA-3 covers MVP Acceptance Scenarios A, B, C, and F only.** D (save recovery) needs the editor
  and its offline queue; E (published-version isolation) needs the publishing pipeline. Both are
  later waves, so claiming "A–F" in this wave would be false.
- **The existing element renderers are extended, not replaced.** Wave 2's question renderer
  becomes answerable; its media renderers gain synchronisation. No new element type appears.
- **The kernel remains the only source of time and render state.** Interaction and media state
  become additional *inputs* to it rather than state held inside it, so seeking stays a
  recomputation and parity stays structural.

## Out of scope

- Resuming a partially completed lesson across sessions (FR-PLY-015, "Should").
- Preloading the next slide and its assets (FR-PLY-010). A MUST that no wave currently claims;
  recorded here because it was noticed, not because it belongs to this one.
- Interaction types beyond single-answer multiple choice and true-or-false (FR-INT-002, "Should").
- Points, scoring, and shuffling answer options (FR-INT-008, "Should").
- Viewport presets and the editor-side preview controls (FR-PLY-006, FR-PLY-002..004) — these
  belong to the editor in Wave 4.
- Any authoring-side validation of these rules (BR-011, BR-017) — the validation engine is Wave 5.
- Organisation-level policy over progress or accessibility (BR-012) — Wave 5.

## Dependencies

- `@cuestack/schema` already carries everything this wave reads: interaction definitions with
  attempts, feedback, and completion policy; `after_media_ends` and `after_interaction` advance
  modes; and slide transitions with type and duration. No format change is expected.
- `@cuestack/core` already reports the blocking conditions US5 presents
  (`ADVANCE_UNSATISFIABLE`, `ADVANCE_MEDIA_FAILED`, `UNKNOWN_REQUIRED_INTERACTION`) and already
  guards single-fire advancement per slide instance. This wave presents them; it does not invent
  them.
- **The media port becomes bidirectional in this wave.** Until now the lesson could observe media
  and not command it, which `specs/002-headless-kernel/research.md` R-04 recorded as the change
  this would require: a design amendment, not an extension. It is being made deliberately, and it
  is the largest risk in this wave.

  The framework's MUST requirements only run one way — media reports its position and the lesson
  reacts (FR-TIM-018, FR-ADV-003) — so this goes beyond them. It is nonetheless necessary,
  because Wave 2 already shipped a seek control: leaving media uncommandable would mean that
  control visibly desynchronises the lesson from its video on any slide that has one, which is
  worse than not having shipped it. Wave 4's editor timeline needs media seeking regardless, so
  deferring would postpone the work rather than avoid it.

  What the amendment brings with it is a reconciliation problem, and FR-037 exists because of it:
  two clocks are now unavoidable, and the one thing that must not happen is two different rules
  for deciding which of them is right.
