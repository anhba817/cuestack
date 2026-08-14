# Feature Specification: Headless Kernel

**Feature Branch**: `002-headless-kernel`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Start wave 1"

Wave 1 of `docs/cuestack_framework_plan.md`: `@cuestack/core` becomes real. The kernel that
decides what a learner sees and when — timeline resolution, the playback clock, slide
advancement, the element and effect registries, and the adapter interfaces a host implements.
No rendering: this feature computes state, it does not draw it.

## User Scenarios & Testing *(mandatory)*

Wave 0's actors were contributors. Wave 1's are host-application developers, and behind them
the learners whose experience the kernel now determines. Nobody can *see* any of this yet —
the first pixels arrive in Wave 2 — but every timing guarantee a learner depends on is decided
here.

### User Story 1 - A slide's appearance at any moment is computable (Priority: P1)

A host-application developer needs to know what a slide looks like at a given moment: which
elements are visible, where, at what opacity, mid-which-effect. They ask the kernel for the
state at a time and get a complete answer — with no browser, no clock running, and no prior
playback history.

**Why this priority**: This one function is three things at once. It is the parity guarantee
(one engine, so editor preview and learner playback cannot diverge — Constitution V), it is
how seeking works (recompute, never replay), and it is the reason server rendering is possible
at all, because asking for the state at time zero needs nothing a server lacks. Every other
story in this feature and the next two waves depends on it.

**Independent Test**: Call it with a lesson fixture and a series of times, asserting the
returned state against expected values. Needs no clock, no DOM, and no other story.

**Acceptance Scenarios**:

1. **Given** a slide where an element becomes visible at 2000 ms, **When** the state is
   computed at 1999 ms and again at 2000 ms, **Then** the element is absent from the first
   result and present in the second.
2. **Given** an element with a 500 ms fade-in starting at 1000 ms, **When** the state is
   computed at 1250 ms, **Then** the element is present and reported as halfway through its
   entrance.
3. **Given** any slide and any two identical time values, **When** the state is computed
   twice, **Then** the two results are indistinguishable.
4. **Given** a slide played continuously to 5000 ms and the same slide asked directly for its
   state at 5000 ms, **When** the two results are compared, **Then** they are identical —
   arriving by a different route cannot produce a different answer.
5. **Given** a time before zero or beyond the slide's duration, **When** the state is
   computed, **Then** a valid state is returned rather than an error.
6. **Given** an element hidden by its author, **When** the state is computed at any time,
   **Then** the element is absent from the result.
7. **Given** an element carrying each of the eight MVP effects in turn, **When** the state is
   computed part-way through each, **Then** every one reports a visual contribution — no
   effect in the set is silently inert.
8. **Given** two effects on one element sharing a start time, **When** the state is computed
   repeatedly, **Then** they resolve in the same order every time, so a slide cannot look
   different on a second viewing.
9. **Given** an element with an emphasis and an exit effect overlapping, **When** the state is
   computed inside the overlap, **Then** each effect's contribution is computable and neither
   depends on the other having been evaluated first.

---

### User Story 2 - A slide advances by the rule its author chose (Priority: P2)

A learner reaches the end of a slide. It moves on when the author said it should: after a set
time, when they click, when the video finishes, or when they have answered the required
question — and never before, and never twice.

**Why this priority**: Progression is the difference between a lesson and a slideshow, and
it is where a bug is most visible and least forgivable: a slide that advances early loses
content the learner never saw, and one that advances twice skips a slide entirely.

**Independent Test**: Drive the advance controller with a synthetic clock and synthetic
completion signals, asserting exactly one advance per slide under each mode and under
combinations that fire simultaneously.

**Acceptance Scenarios**:

1. **Given** a slide set to advance after 8000 ms, **When** the clock passes 8000 ms, **Then**
   the slide advances exactly once.
2. **Given** a slide set to advance after 8000 ms with a required question unanswered, **When**
   the clock passes 8000 ms, **Then** the slide does not advance until the question is
   answered.
3. **Given** a slide set to advance when a video ends, **When** the video is paused, **Then**
   advancement is postponed rather than cancelled.
4. **Given** a slide whose duration expires at the same instant its controlling media ends and
   its required question completes, **When** all three conditions fire together, **Then** the
   slide advances once and not three times.
5. **Given** a slide set to advance on learner click, **When** the duration elapses, **Then**
   nothing happens until the learner acts.
6. **Given** a slide that has already advanced, **When** a late completion signal arrives for
   it, **Then** it is ignored.
7. **Given** a slide gated on a required question that disappears before it can be answered,
   **When** progression is evaluated, **Then** the impossibility is reported rather than the
   learner being left waiting with no explanation.
8. **Given** progression overridden for testing, **When** the same lesson is played normally,
   **Then** the override is not reachable — a test affordance cannot leak into playback.

---

### User Story 3 - Playback follows a clock the learner controls (Priority: P3)

A learner plays, pauses, and resumes a lesson, or switches tabs mid-slide and comes back. Time
in the lesson tracks what they did, not how long the page was open.

**Why this priority**: Without a controllable clock the resolver has nothing to drive it, so
this is close behind P1 in necessity. It ranks below advancement because a wrong clock is
usually noticed immediately, while a wrong advance rule can ship unnoticed.

**Independent Test**: Substitute a synthetic time source, issue play/pause/seek commands, and
assert the reported lesson time after each.

**Acceptance Scenarios**:

1. **Given** playback paused at 3000 ms, **When** ten seconds pass in the outside world,
   **Then** the lesson time is still 3000 ms.
2. **Given** playback running, **When** the document becomes hidden and later visible again,
   **Then** the lesson resumes from where it was rather than jumping forward by the time spent
   hidden.
3. **Given** any lesson time, **When** the learner seeks to it, **Then** the resulting visual
   state matches that time without any intervening effect appearing to replay.
4. **Given** the machine suspends and wakes hours later, **When** playback resumes, **Then**
   lesson time has not leapt forward by the sleep duration.
5. **Given** playback running, **When** lesson time is sampled repeatedly, **Then** it only
   ever increases.
6. **Given** playback part-way through a slide, **When** restart is issued, **Then** lesson
   time returns to zero and the resulting state matches the state computed directly at zero.

---

### User Story 4 - New content types can be added without touching the kernel (Priority: P4)

An extension author adds a new element type — a chart, a poll, a diagram — by registering it.
The canvas, the timeline, and the player accommodate it without modification.

**Why this priority**: The framework's stated goal is that new element and effect types are
addable without rewriting core machinery. That property is cheap to establish now and
expensive to retrofit, but it produces no learner-visible value until someone actually
extends the set.

**Independent Test**: Register a synthetic element type and a synthetic effect, then resolve a
slide using them, asserting they participate exactly as built-in types do.

**Acceptance Scenarios**:

1. **Given** a newly registered element type, **When** a slide using it is resolved, **Then**
   it participates in timing and layering identically to a built-in type.
2. **Given** a registration missing part of its required contract, **When** it is attempted,
   **Then** it is refused with a message naming what is absent.
3. **Given** a lesson referencing an unregistered *optional* element type, **When** it is
   resolved, **Then** the rest of the slide resolves and the unknown element is reported as
   unavailable rather than failing the slide.
4. **Given** a lesson referencing an unregistered *required interaction* type, **When** it is
   resolved, **Then** resolution reports a blocking problem, because silently skipping a
   question that gates progression would strand the learner.
5. **Given** a registered extension, **When** it is resolved, **Then** it receives only its
   own element and the lesson's theme values — not the lesson, and not anything about the
   learner.

---

### User Story 5 - A host can persist lessons through its own API (Priority: P5)

A host application saves a teacher's work to its own backend, loads it back, and records
learner events — without the framework running a server or dictating a storage shape.

**Why this priority**: Necessary before the editor can autosave in Wave 4, and it is what
makes "the framework ships no backend" a workable position rather than a limitation. Nothing
in this wave exercises it beyond a reference implementation.

**Independent Test**: Implement the interfaces against an in-memory store and exercise
load, save, conflict, and event paths.

**Acceptance Scenarios**:

1. **Given** a host implementation, **When** a lesson is saved and loaded back, **Then** the
   loaded lesson is equivalent to what was saved.
2. **Given** two edits to the same lesson from different sessions, **When** the second saves
   against a stale version, **Then** the save is refused as a conflict rather than
   overwriting the newer work.
3. **Given** no host implementation configured, **When** the framework is used, **Then** it
   works against an in-memory default rather than failing.
4. **Given** a learner interaction, **When** it is recorded, **Then** the event identifies the
   lesson version, slide, interaction, attempt, and outcome — and carries no learner
   identifier the host did not explicitly supply.

---

### Edge Cases

- An effect that extends past the end of its slide is resolved for the portion within the
  slide rather than truncated to nothing or allowed to run past.
- Two effects on one element sharing a start time resolve in a stable order every time, so a
  slide never looks different on a second viewing.
- An element with an empty effect list is visible for its whole window with no transformation.
- Seeking to a time inside an exit effect shows the element partly gone, not fully present and
  not fully absent.
- A slide whose duration is shorter than its content's timing still resolves; the mismatch is
  reported rather than silently clipping.
- Advancement conditions that can never be satisfied — a required question that disappears
  before it can be answered — are reported rather than leaving the learner waiting forever.
- Media that fails to load never leaves a media-gated slide waiting indefinitely.
- A clock jump large enough to imply the machine slept is treated as a pause, not as elapsed
  lesson time.
- Resolving a slide with several hundred elements stays within its time budget rather than
  degrading as element count grows.

## Requirements *(mandatory)*

### Functional Requirements

**Timeline resolution**

- **FR-001**: Given a slide and a time, the system MUST compute the complete visual state of
  that slide: which elements are present, their geometry, and their current effect progress.
- **FR-002**: Resolution MUST be a pure computation — same inputs, same output, no dependence
  on prior calls, ambient time, or randomness.
- **FR-003**: Resolution MUST NOT require a browser, a document, or a running clock.
- **FR-004**: Seeking MUST recompute state from the lesson definition rather than replaying
  the effects between the old time and the new one.
- **FR-005**: A time outside a slide's duration MUST produce a valid state, not an error.
- **FR-006**: Elements marked hidden by their author MUST be absent from the computed state,
  while remaining part of the lesson definition.
- **FR-007**: Layer order in the computed state MUST follow the author's chosen order,
  independent of the order elements appear in the definition.

**Effects**

- **FR-008**: The system MUST support the eight named entrance, emphasis, and exit effects of
  the MVP set.
- **FR-009**: Each effect MUST be expressible as a function from progress to visual change, so
  that its state at any instant is computable without having run the preceding instants.
- **FR-010**: Effects MUST resolve in a deterministic order when they share a start time.
- **FR-011**: An effect's contribution MUST be computable independently of whether any other
  effect on the same element is active.
- **FR-012**: The system MUST expose enough information for a consumer to substitute a reduced
  or instant alternative for a motion effect, without the kernel deciding whether to do so.

**Clock and transport**

- **FR-013**: Lesson time MUST derive from a monotonic source and MUST NOT go backwards during
  continuous playback.
- **FR-014**: The system MUST support play, pause, seek, and restart.
- **FR-015**: The time source MUST be substitutable, so that timing behaviour can be exercised
  without waiting in real time.
- **FR-016**: When the host document becomes hidden, lesson time MUST stop advancing; when it
  becomes visible again, it MUST continue from the stored position.
- **FR-017**: An implausibly large jump in the underlying time source MUST be treated as
  elapsed real-world time that did not happen in the lesson.

**Slide advancement**

- **FR-018**: The system MUST support advancement after a duration, on learner action, after
  selected media ends, and after a required interaction completes.
- **FR-019**: A slide instance MUST advance at most once, however many conditions are
  satisfied and however many times they fire.
- **FR-020**: An incomplete required interaction MUST override duration-based advancement.
- **FR-021**: Pausing controlling media MUST postpone advancement rather than cancel it.
- **FR-022**: A completion signal arriving for a slide that has already advanced MUST be
  ignored.
- **FR-023**: An advancement condition that cannot be satisfied MUST be reported rather than
  leaving progression stalled with no explanation.
- **FR-024**: The system MUST allow a consumer to override progression for testing without
  that override being reachable in normal playback.

**Registries and extension**

- **FR-025**: Element types and effect types MUST be added by registration, never by modifying
  the resolution logic.
- **FR-026**: A registration MUST be refused unless it supplies its complete contract, with
  the refusal naming what is missing.
- **FR-027**: An unregistered optional element type MUST degrade gracefully, leaving the rest
  of the slide usable.
- **FR-028**: An unregistered required interaction type MUST be reported as blocking.
- **FR-029**: A registered extension MUST receive only its own element and the lesson's theme
  values — never the wider lesson, and never anything describing the learner.

**Host adapters**

- **FR-030**: The system MUST define interfaces through which a host provides lesson storage,
  asset resolution, and event recording.
- **FR-031**: A save MUST carry a version marker and MUST be refusable as a conflict, so a
  newer version is never silently overwritten.
- **FR-032**: The system MUST provide a working in-memory implementation of every interface so
  it is usable with no host code.
- **FR-033**: Recorded events MUST identify the lesson version, slide, interaction, attempt,
  and outcome, and MUST NOT include a learner identifier the host did not supply.

**Verification**

- **FR-034**: Every business rule governing timing and progression MUST have a test named for
  that rule, so compliance is checkable by rule rather than by reading code.
- **FR-035**: Timing behaviour MUST be verifiable without real-time waiting.

### Key Entities

- **Render State**: The complete appearance of one slide at one instant — the set of visible
  elements with their resolved geometry, layer order, and effect progress. The single thing
  both an editor preview and a learner player consume.
- **Effect Descriptor**: An effect's identity plus a means of computing its visual
  contribution at a given progress value.
- **Element Registration**: A content type's declared contract — its data shape, how it is
  edited, how it is displayed, how it is configured, and how it is validated.
- **Transport**: The playback control surface: current lesson time, whether it is advancing,
  and the operations that change either.
- **Advance Decision**: The determination that a slide instance should now move on, made once
  per instance and attributable to the condition that caused it.
- **Host Adapters**: The three boundaries where lesson data leaves the framework — storage,
  assets, and events.

## Success Criteria *(mandatory)*

**Reference environment**: durations are measured on the project's standard CI runner
(4 vCPU, 16 GB), consistent with feature 001.

### Measurable Outcomes

- **SC-001**: Computing the state of a slide carrying 300 elements completes in under 10
  milliseconds, leaving the remainder of the 100 ms seek budget to whatever draws it.
- **SC-002**: For every slide in the test corpus and every millisecond boundary where
  something changes, playing to that time and seeking to it produce identical state — 100% of
  cases, no exceptions.
- **SC-003**: Two consecutive computations of the same slide at the same time produce
  byte-identical results across the whole corpus.
- **SC-004**: Every business rule governing timing and progression has at least one test named
  for it, and every one of them passes.
- **SC-005**: Under every combination of simultaneously-satisfied advancement conditions, a
  slide advances exactly once — verified exhaustively over the possible combinations.
- **SC-006**: The complete timing test suite runs in under 5 seconds, because no test waits in
  real time.
- **SC-007**: A synthetic element type and a synthetic effect can be added and used with no
  change to any file in the resolution path — demonstrated by a test that would fail if the
  resolver had to know about them.
- **SC-008**: A save against a stale version is refused in 100% of attempts, and the newer
  version is never modified.
- **SC-009**: The kernel remains usable with no user-interface framework and no host
  implementation present, demonstrated by an automated check.
- **SC-010**: Lesson time never decreases during continuous playback, verified over a long
  synthetic session including hidden-document periods and a simulated machine sleep.
- **SC-011**: Every effect in the MVP set is identifiable as motion or not, so a consumer can
  substitute a reduced alternative for 100% of motion effects without consulting a hard-coded
  list of its own.
- **SC-012**: An advancement rule that cannot ever be satisfied is reported in 100% of cases,
  rather than presenting as a lesson that has simply stopped.

## Assumptions

- **No rendering.** This feature computes state and never draws it. There is nothing to look
  at when it is done; the first visible slide is Wave 2.
- **Reduced motion is the consumer's decision.** The kernel exposes what an effect does and
  which effects are motion; whether to substitute a reduced alternative belongs to the
  adapter, because the honouring mechanism is a stylesheet concern and the preference cannot
  be read on a server.
- **Media is observed, not driven.** The kernel cannot touch a media element, so media
  position and completion arrive through an injected port that the adapter supplies. The
  kernel decides *what that means*; the adapter decides *how it is learned*.
- **The clock's time source is injected.** Real playback supplies a monotonic browser source;
  tests supply a synthetic one. The kernel does not read a clock directly.
- **Effect parameters stay within the eight MVP types.** New effects are additive registrations
  in a later wave, not a v1 concern.
- **Lesson definitions are already valid.** The kernel consumes manifests that feature 001's
  validation has accepted; it is not a second validator. Malformed input is a programming
  error, not a runtime case to handle gracefully.
- Interaction *rendering and answering* is Wave 3. This feature models a required
  interaction's completion state and its effect on progression, not its user interface.

## Dependencies

- **Feature 001** (`specs/001-framework-foundation/`) supplies the lesson format, its types,
  and its validation. The kernel consumes `@cuestack/schema` types and adds no runtime
  dependency of its own.
- **Constitution** — Principle II supplies the injectable-clock requirement and the rule-named
  test obligation; Principle V supplies the single-engine requirement that FR-001 through
  FR-004 exist to satisfy; Principle I supplies the registry-not-switch rule behind FR-025.
- **Product specification** `docs/Cuestack_Framework.md` §25.4 (timeline), §25.6
  (advancement), §29–30 (playback state and timing rules), and §26 (business rules).
- **Carried forward from feature 001**: `@cuestack/core`'s coverage threshold is present but
  disabled in the test configuration, waiting for this feature to give the package statements
  to cover. Re-enabling it belongs in this feature.

## Out of Scope

- Any rendering, in any environment — React components, DOM output, and server rendering are
  Wave 2.
- The editor, its canvas, and its timeline interface — Wave 4.
- Interaction user interfaces, media elements, transitions, and progress display — Wave 3.
- Teacher-facing validation warnings and jump-to-source navigation — Wave 5. This feature
  reports blocking problems it encounters while resolving; it does not assess instructional
  quality.
- A reference HTTP implementation of the host adapters — Wave 5. This feature defines the
  interfaces and ships only the in-memory implementation.
- Simple Sequence Mode's relative-to-absolute conversion — Wave 4, alongside the interface
  that offers it.
