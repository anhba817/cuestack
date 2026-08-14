# Feature Specification: Framework Foundation

**Feature Branch**: `001-framework-foundation`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Start Wave 0"

Wave 0 of `docs/cuestack_framework_plan.md`: the lesson format contract, the buildable workspace,
automated quality gates, and the format-migration mechanism. This is the foundation every
later wave depends on; it ships no learner-visible or teacher-visible interface.

## User Scenarios & Testing *(mandatory)*

The people served by this feature are the framework's own consumers: contributors building
Cuestack, and host-application developers integrating it. Teachers and learners are served
only indirectly, by the guarantees this wave establishes about their lesson data.

### User Story 1 - A lesson has one trustworthy definition (Priority: P1)

A host-application developer receives lesson data from a teacher's saved work and needs to
know, before doing anything with it, whether it is a valid lesson. They pass it to the
framework and get back either a typed lesson they can rely on, or a rejection that names
exactly which slide, element, and field is wrong and why.

**Why this priority**: This is the only part of Wave 0 that delivers standalone value — it is
publishable and usable on its own, without any renderer, editor, or player. It is also the
decision hardest to reverse, because after the first published lesson the format can only be
extended, never reshaped.

**Independent Test**: Fully testable by feeding a corpus of valid and deliberately malformed
lesson definitions to the validator and asserting the accept/reject outcome and the located
error for each. Delivers value with no other Wave 0 item present.

**Acceptance Scenarios**:

1. **Given** the reference lesson definition, **When** it is validated, **Then** it is accepted
   and every field is readable through a typed structure.
2. **Given** a lesson where an element ends before it starts, **When** it is validated, **Then**
   it is rejected with an error naming the slide, the element, and the offending field.
3. **Given** a lesson with a fractional or negative time value, **When** it is validated,
   **Then** it is rejected rather than silently rounded or clamped.
4. **Given** a valid lesson, **When** it is exported and re-imported, **Then** the result is
   equivalent to the original with no field lost or reordered in a meaningful way.
5. **Given** a lesson missing a field the format marks required, **When** it is validated,
   **Then** it is rejected naming the missing field; **and given** a lesson missing a field
   the format marks optional, **Then** it is accepted.
6. **Given** two lessons identical except for the aspect ratio they were authored at,
   **When** each is validated, **Then** element positions are recorded on the same
   display-independent scale and neither outcome depends on any viewport size.
7. **Given** a lesson containing a field the format does not define — for instance one
   carrying a learner identifier — **When** it is validated, **Then** the unknown field is
   rejected rather than silently accepted and carried along.

---

### User Story 2 - A contributor can build the project on first try (Priority: P2)

A developer new to the project clones it, runs one command, and gets a complete, type-checked
build of every package without hand-editing configuration, installing global tools, or
consulting a maintainer.

**Why this priority**: Highest value per effort after the format itself, and a technical
prerequisite for P1 to be delivered as a consumable package. It is ranked below P1 because a
working build with nothing in it delivers less than a format contract does.

**Independent Test**: Testable by building from a clean checkout on a machine with no
project-specific setup, and confirming a successful build and a correctly resolved package
for both server-side and client-side consumption.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the contributor runs the documented setup and build
   command, **Then** every package builds successfully with no manual intervention.
2. **Given** a built package, **When** it is consumed in a server-rendering context, **Then**
   the server-appropriate entry point is selected automatically without consumer configuration.
3. **Given** the core lesson logic package, **When** it is consumed in an environment with no
   user-interface framework installed, **Then** it loads and runs.

---

### User Story 3 - Quality rules are enforced without anyone remembering them (Priority: P3)

A contributor proposes a change. The project's agreed rules — type correctness, the
architectural boundary that keeps user-interface concerns out of the core, test coverage of
the lesson rules — are checked automatically, and a violation blocks the change with a message
naming the rule broken.

**Why this priority**: Protects P1 and P2 from erosion but produces nothing new on its own.
It is placed in Wave 0 rather than later because retrofitting the architectural boundary check
after code exists means deleting code rather than preventing it.

**Independent Test**: Testable by proposing deliberately non-compliant changes — a type error,
an import that crosses the forbidden boundary, a dropped test — and confirming each is
rejected with an identifying message.

**Acceptance Scenarios**:

1. **Given** a change that introduces a type error, **When** it is proposed, **Then** it is
   blocked before review.
2. **Given** a change where core lesson logic imports a user-interface framework, **When** it
   is proposed, **Then** it is blocked with a message naming the boundary rule.
3. **Given** a change that drops coverage of the lesson rules below the agreed floor, **When**
   it is proposed, **Then** it is blocked.
4. **Given** a check whose subject matter does not exist yet, **When** a change is proposed,
   **Then** the check passes rather than failing or being absent.

---

### User Story 4 - The format can change without breaking existing lessons (Priority: P4)

Months after the first lessons are saved, the format needs a new capability. Existing lessons
continue to open, and are carried forward to the current format automatically rather than
requiring teachers to rebuild them.

**Why this priority**: No value until the format actually changes, but the mechanism must
exist before the first change, because the project's governance requires every format change
to ship with its upgrade path in the same revision.

**Independent Test**: Testable with a synthetic older-format lesson and a registered upgrade
step, asserting the upgraded result matches the expected current-format lesson.

**Acceptance Scenarios**:

1. **Given** a lesson declaring an older supported format version, **When** it is opened,
   **Then** it is carried forward to the current version with no content lost.
2. **Given** a lesson declaring a format version newer than the software supports, **When** it
   is opened, **Then** it is refused with a clear explanation and is never partially loaded.
3. **Given** a lesson with no declared format version, **When** it is opened, **Then** it is
   refused rather than assumed to be current.
4. **Given** an older-format lesson, **When** it is carried forward, **Then** the upgrade
   returns a new lesson value and the original is left byte-identical to how it arrived.

---

### Edge Cases

- A lesson definition that is syntactically well-formed but semantically empty — no slides at
  all — is rejected, because a lesson with nothing in it cannot be played.
- A lesson referencing an element type the software does not recognize is reported as an
  unknown type naming the type, not as a generic parse failure.
- A time value expressed as a non-integer, a negative number, or a value beyond a sensible
  upper bound is rejected at the boundary rather than propagated.
- An upgrade chain with a missing intermediate step is detected and refused, rather than
  skipping the gap and producing a subtly wrong lesson.
- Two packages in the workspace forming a circular dependency is detected and blocked.
- A change to the lesson format proposed without a corresponding upgrade step is blocked.
- Validation of a very large lesson does not exhaust memory or hang; it completes or fails
  with a bounded error.

## Requirements *(mandatory)*

### Functional Requirements

**Lesson format contract**

- **FR-001**: The system MUST validate a lesson definition against a single published format
  and return either a typed, readable lesson or a rejection.
- **FR-002**: The system MUST reject any timing value that is not a non-negative whole number
  of milliseconds, any element whose end is not later than its start, and any effect whose
  duration is not greater than zero.
- **FR-003**: Every rejection MUST identify the location of the problem — the slide, the
  element, and the field — and state what was expected, without requiring the caller to parse
  the message to act on it.
- **FR-004**: The system MUST record element position and size in a coordinate system that is
  independent of the display size at which a lesson is viewed.
- **FR-005**: The system MUST express, in the format itself, which parts of a lesson are
  required and which are optional, so that two independent implementations reach the same
  accept/reject decision.
- **FR-006**: A lesson definition MUST round-trip: exporting an accepted lesson and importing
  the result MUST produce an equivalent lesson.
- **FR-007**: The system MUST include at least one complete reference lesson that exercises
  slides, elements, effects, timing, and advancement, and that reference MUST be validated by
  the same checks that run on user content.

**Format versioning**

- **FR-008**: Every lesson definition MUST declare the format version it was written against.
- **FR-009**: The system MUST carry a lesson written against any supported older version
  forward to the current version without loss of content.
- **FR-010**: The system MUST refuse a lesson declaring an unsupported or absent format
  version with an explanatory message, and MUST NOT load it partially.
- **FR-011**: Upgrades MUST be forward-only and MUST NOT modify the stored original.

**Workspace and consumption**

- **FR-012**: A contributor MUST be able to build every package from a clean checkout using a
  single documented command, with no manual configuration.
- **FR-013**: Each published package MUST expose distinct entry points for server-side and
  client-side consumption, selected automatically by the consuming application.
- **FR-014**: The core lesson logic MUST be usable in an environment where no user-interface
  framework is installed.

**Automated quality gates**

- **FR-015**: Every proposed change MUST be automatically checked for type correctness, the
  core/user-interface boundary rule, test success, and coverage of the lesson rules; any
  failure MUST block the change.
- **FR-016**: Each failing check MUST name the rule that was broken.
- **FR-017**: Checks whose subject matter does not yet exist MUST be present and passing, so
  that enabling them later is a minimal change rather than new infrastructure.
- **FR-018**: A change to the lesson format that does not include a corresponding upgrade step
  MUST be blocked.

**Data protection**

- **FR-019**: The lesson format MUST NOT provide any place to store learner identifiers or
  author credentials.

### Key Entities

- **Lesson**: The top-level authored learning experience. Carries identity, title, language,
  aspect ratio, theme reference, status, and ownership; contains ordered slides.
- **Lesson Version**: An immutable snapshot of a lesson's content at a point in time, carrying
  the format version it was written against.
- **Slide**: An ordered scene with a duration, a background, a transition, an advancement
  rule, and a set of elements.
- **Element**: A content object placed on a slide — text, image, shape, video, audio, button,
  or question — with position, size, layer order, visibility window, and effects.
- **Effect**: An entrance, emphasis, or exit behavior applied to an element, with a start
  time, a duration, an ordering, and an easing.
- **Interaction**: A question attached to an element — prompt, options, correct response,
  required/optional status, attempt limits, and feedback.
- **Asset**: A referenced media file with its type, dimensions, duration, accessibility text,
  and processing status.
- **Format Version**: The declared version of the lesson format, together with the ordered
  upgrade steps that carry a lesson from one version to the next.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Reference environment**: every duration below is measured on the project's standard CI
runner (4 vCPU, 16 GB). Times observed on other machines are indicative, not authoritative.
Durations exclude dependency download time, which depends on network conditions outside the
project's control.

- **SC-001**: A developer who has never seen the project can go from clone to a complete
  successful build in under 10 minutes, using one command and without asking anyone.
- **SC-002**: 100% of the deliberately malformed lessons in the test corpus are rejected, and
  every rejection names the slide, element, and field at fault.
- **SC-003**: The reference lesson survives export and re-import with zero difference in
  content.
- **SC-004**: Each of the format's four timing rules has at least one test proving an invalid
  case is rejected, identifiable by rule.
- **SC-005**: A contributor learns whether a proposed change passes or fails within 5 minutes
  of proposing it.
- **SC-006**: A deliberate attempt to change the lesson format without an upgrade step is
  blocked, demonstrated at least once as a test.
- **SC-007**: The core lesson logic loads and validates a lesson in an environment with no
  user-interface framework present, demonstrated by an automated check.
- **SC-008**: Two consecutive validations of the same lesson produce byte-identical results,
  establishing that validation has no hidden state.
- **SC-009**: No field in the format can hold a learner identifier or an author credential,
  and undefined fields are rejected rather than preserved — demonstrated by an automated
  check over the format definition itself.
- **SC-010**: Carrying a lesson forward from an older format version leaves the original
  input unmodified, verified on every upgrade step in the test corpus.

## Assumptions

Decisions already settled in `docs/cuestack_framework_plan.md` and
`.specify/memory/constitution.md`, recorded here because this specification depends on them:

- The framework runs no backend. Persistence, assets, and analytics are reached through
  adapter interfaces implemented by the host application; Wave 0 defines no storage.
- Field-level requirements are derived from the product specification's data model
  (`docs/Cuestack_Framework.md` §27). Where that document lists a field without stating
  whether it is required, this feature treats it as required unless the product specification
  marks the corresponding capability as "Should" or "Could" priority.
- The format's first published version is 1.0, matching the reference manifest in the product
  specification §28. No older versions exist yet, so the upgrade mechanism ships with its
  test-only synthetic case rather than a real migration.
- The coverage floor for the core and format packages is 90% line and branch, per the
  constitution. User-interface packages have no numeric floor in this or any wave.
- Wave 0 produces no user-visible interface. Teachers, learners, and reviewers cannot observe
  any of this feature directly; its success criteria are therefore expressed in terms of the
  developers it serves and the guarantees it establishes about lesson data.
- The workspace, package manager, build tooling, validation library, and module format were
  chosen in the plan's Open Design Questions and are not re-litigated here.

## Dependencies

- **Product specification** `docs/Cuestack_Framework.md` — sections 26 (business rules), 27
  (data model), and 28 (reference manifest) are the source for FR-001 through FR-011.
- **Constitution** `.specify/memory/constitution.md` — Principle I supplies the boundary rule
  in FR-014 and FR-015; Principle II supplies the coverage floors and the test-first
  obligation.
- **User Story 2 gates User Story 1's delivery**: the format contract can be specified and
  tested independently, but cannot be published as a consumable package until the workspace
  exists. Priorities here reflect value, not sequence; `docs/cuestack_framework_plan.md` holds the
  execution order.

## Out of Scope

Deferred to later waves, listed to bound this feature:

- Any rendering of a lesson, in any environment — the timeline resolver, effects, clock, and
  advancement logic are Wave 1.
- Server-side rendering and the React adapter — Wave 2.
- The editor, canvas, timeline interface, autosave, and undo — Wave 4.
- The validation *engine* that produces teacher-facing warnings and jump-to-source navigation
  — Wave 5. Wave 0 validates structural correctness only, not instructional quality.
- Publishing, immutable versions, and the portable export package with assets — Wave 5.
- Storage, asset, and analytics adapter interfaces — Wave 1 (EN-6).
