# Feature Specification: Validation and Immutable Publish

**Feature Branch**: `009-validation-and-publish`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Start wave 5 PB-1 PB-2"

Wave 5 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md), first tranche:
**PB-1** (validation engine) and **PB-2** (immutable publish). They are specified together because
PB-2 depends on PB-1 and the dependency is the interesting part — "errors block publication" is one
sentence that only means something once both halves exist.

This is where a lesson stops being the author's and becomes the learner's. Everything before it has
been reversible: undo takes back a change, a draft can be restored from history, a preview shows
what a learner *would* get. Publishing is the first thing this framework does that cannot be taken
back, and BR-008 says so plainly — "a published lesson version shall remain immutable."

It also settles three debts the project has been carrying:

- **`ElementPlugin.validate` has no consumer.** Declared in Wave 1, and the ninth member of the
  pattern this project keeps finding: the kernel is built ahead of its consumers, so the reliable
  way to review one of its contracts is to try to use it. The plan names PB-1 as the item that owes
  it one. Its own header already states the stake: "one missing `validate` passes publication checks
  it should fail."
- **A dead-end lesson is authorable, and only the learner is told.** A required `on_correct`
  question with one attempt can be written, reached, and reported — to the person stuck at it. An
  editor makes such a lesson *easier* to author, which strengthens the case rather than weakening it.
- **Four business rules have no rule-named test**, and this feature owns three of them: BR-008
  (published versions are immutable), BR-009 (draft edits do not alter a published version), and
  BR-018 (published playback references authorized assets). BR-012 — accessibility metadata enforced
  as an error or a warning by policy — is the fourth, and it is a validation rule. `check:rules` has
  read 14 of 18 since Wave 1; this feature is what takes it to 18.

## Clarifications

### Session 2026-08-19

- Q: When a teacher presses Publish with edits that haven't been saved yet, what should be published? → A: Save first, then publish what was saved. One action from the teacher's side; if the save fails, publishing does not happen and they are told why.
- Q: Should validation check that every referenced image, video, and audio file actually exists, or is that checked only at the moment of publishing? → A: Both, at different strengths. Validation reports a missing asset as a warning through a separate pass that the pure core does not depend on; publishing re-checks and refuses on an error.
- Q: How should the framework find out whether this person is allowed to publish or withdraw a lesson? → A: By trying. Publishing and withdrawing may come back refused for permission, exactly as a save already may, and the teacher is told. The framework holds no roles and makes no decisions about who may do what.
- Q: When a lesson has an image with no alt text or a video with no captions, should that stop a teacher publishing, or warn them? → A: A warning by default, an error where the host's policy says so. Reported every time; blocking only where an organisation has decided it should block.
- Q: When a teacher withdraws a lesson and a class is part-way through it, what should those learners see? → A: The framework reports that no version is available and stops offering it; what happens to a learner already inside one is the host's call, and the framework gives it what it needs to decide.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A teacher finds out what is wrong before anyone else does (Priority: P1)

The teacher asks whether the lesson is ready. They get a list: what is wrong, which slide and which
element it is on, and what to do about it — with errors separated from warnings, so they can tell
what must be fixed from what merely could be. Choosing an issue takes them to it.

**Why this priority**: It is the whole of PB-1 and it is useful with no publishing at all. An author
who can find the dead end, the overrun, and the unlabelled image before a learner does has most of
the value of this feature, and every other story here depends on it.

**Independent Test**: Open a lesson with several deliberate problems, ask for validation, and confirm
each is reported with its slide, its element where it has one, and a severity. Choose one and confirm
the editor goes to it.

**Acceptance Scenarios**:

1. **Given** a lesson with problems, **When** the teacher validates it, **Then** every problem is
   reported in one pass — not the first, and not one per attempt.
2. **Given** a reported issue, **When** the teacher reads it, **Then** it states the problem, the
   affected object, and the recommended action.
3. **Given** a reported issue on an element, **When** the teacher reads it, **Then** it names the
   slide and the element.
4. **Given** a reported issue, **When** the teacher chooses it, **Then** the editor navigates to its
   source — the slide, and the element selected where there is one.
5. **Given** a lesson with both kinds of problem, **When** it is validated, **Then** errors and
   warnings are distinguished, and the teacher can tell which will stop them publishing.
6. **Given** a question requiring a correct answer with a single attempt and no way past it,
   **When** the lesson is validated, **Then** the dead end is reported to the *author*.
7. **Given** an element extending past its slide's duration, **When** the lesson is validated,
   **Then** it is reported — by the same rule the timeline already shows, not a second copy of it.
8. **Given** a lesson with no problems at all, **When** it is validated, **Then** it says so plainly
   rather than showing an empty list.
9. **Given** the same lesson validated twice, **When** the results are compared, **Then** they are
   identical, in the same order.
10. **Given** a lesson referencing an image that no longer exists, **When** the teacher validates it,
    **Then** the missing image is reported as a warning, naming which element refers to it.
11. **Given** a caller that cannot wait on the host, **When** it validates, **Then** it gets every
    issue except the asset warnings, rather than nothing.

---

### User Story 2 - A lesson with errors cannot be published (Priority: P2)

The teacher presses Publish. If anything is an error, publishing does not happen and they are shown
what stopped it. Warnings do not stop them — a lesson can be imperfect and still be worth giving to
a class.

**Why this priority**: It is the sentence that makes US1 more than a report. Without it, validation
is advice; with it, it is a gate.

**Independent Test**: Attempt to publish a lesson carrying an error and confirm nothing is published
and the errors are shown. Fix them, leaving a warning, and confirm publishing succeeds.

**Acceptance Scenarios**:

1. **Given** a lesson with at least one error, **When** the teacher publishes, **Then** nothing is
   published and the errors are shown.
2. **Given** a lesson with warnings and no errors, **When** the teacher publishes, **Then** it is
   published.
3. **Given** a lesson validated a while ago and edited since, **When** the teacher publishes,
   **Then** it is validated again first — an earlier result is not trusted.
4. **Given** a lesson referencing an asset that cannot be found, **When** the teacher publishes,
   **Then** publishing is refused and the missing asset is named.
5. **Given** a refused publish, **When** the teacher looks at their lesson, **Then** the draft is
   exactly as it was — a refusal changes nothing.
6. **Given** unsaved changes, **When** the teacher publishes, **Then** the changes are saved first
   and what is published is what was saved.
7. **Given** unsaved changes and storage that cannot be reached, **When** the teacher publishes,
   **Then** nothing is published and they are told the save failed rather than the lesson did.

---

### User Story 3 - What was published stays published (Priority: P3)

The teacher publishes, then keeps working. The learners keep seeing what was published, unchanged,
however much the draft moves on. Nothing the teacher can do — and nothing the framework offers —
alters a version that has been published.

**Why this priority**: BR-008 and BR-009, and the promise the whole publishing model rests on. A
teacher who cannot rely on it will stop editing published lessons, which is the behaviour the
feature exists to make safe.

**Independent Test**: Publish a lesson, make many draft edits including deletions, and confirm the
published version is byte-identical to what was published. Confirm no route through the framework
can change it.

**Acceptance Scenarios**:

1. **Given** a published version, **When** the teacher edits the draft extensively, **Then** the
   published version is byte-identical to what it was.
2. **Given** a published version, **When** the teacher deletes the slide it was published from,
   **Then** the published version still plays.
3. **Given** a published version, **When** anything in the framework is asked to change it,
   **Then** there is no way to do so — the capability does not exist rather than being refused.
4. **Given** a published version, **When** it is played, **Then** it needs nothing from the draft.
5. **Given** a published version, **When** it is examined, **Then** it carries who published it and
   when.

---

### User Story 4 - A newer version can be published (Priority: P4)

The lesson improves. The teacher publishes again, learners get the new one, and the old one is still
there — because a class part-way through the old one should not have it changed underneath them, and
because being able to look at what was live last week is how a problem gets diagnosed.

**Why this priority**: FR-PUB-008. Publishing once is a demonstration; publishing repeatedly is the
product.

**Independent Test**: Publish twice, confirm both versions exist, confirm exactly one is active, and
confirm the first is unchanged by the second.

**Acceptance Scenarios**:

1. **Given** a published lesson, **When** the teacher publishes again, **Then** a new version exists
   and the earlier one is retained.
2. **Given** several published versions, **When** the lesson is played, **Then** exactly one is
   active and it is the most recently published.
3. **Given** several published versions, **When** they are listed, **Then** each carries its
   publisher and its time, newest first.
4. **Given** a newly published version, **When** an earlier one is examined, **Then** it is
   unchanged.

---

### User Story 5 - A lesson can be withdrawn, and the record says who did what (Priority: P5)

A lesson turns out to be wrong, or a course ends. Somebody with permission withdraws it, and learners
stop being given it. The lesson is not destroyed — it is withdrawn — and every publish and withdrawal
is on a record nobody can quietly edit.

**Why this priority**: FR-PUB-010 and FR-PUB-015. It is the smallest of the five and the one a
deployment discovers it needs at an awkward moment.

**Independent Test**: Publish, withdraw, and confirm nothing is active while both the version and the
record of both actions remain.

**Acceptance Scenarios**:

1. **Given** a published lesson, **When** somebody with permission withdraws it, **Then** no version
   is active, and a request for one says so rather than saying the lesson does not exist.
2. **Given** a learner part-way through a withdrawn lesson, **When** the withdrawal happens,
   **Then** the framework does not interrupt them, and the host can discover that the version they
   are playing is no longer active.
3. **Given** a withdrawn lesson, **When** it is examined, **Then** the version still exists — it was
   withdrawn, not deleted.
4. **Given** a withdrawn lesson, **When** somebody with permission restores it, **Then** it is active
   again, and no new version was created.
5. **Given** somebody without permission, **When** they attempt to withdraw, **Then** it is refused,
   nothing changes, and they are told it is permission they lack rather than that something broke.
6. **Given** somebody without permission to publish, **When** they attempt to, **Then** the same —
   and the lesson's draft is untouched.
7. **Given** any publish, withdrawal, or restoration, **When** the record is read, **Then** it names
   who and when.
8. **Given** the record, **When** anything attempts to change an entry in it, **Then** there is no
   way to do so.

---

### Edge Cases

- **A lesson with no slides.** Reported as an error rather than published as an empty experience.
- **A slide with no elements.** Legal — a pause, a beat, a held background — and not an error.
- **An element type nobody registered.** Reported by the resolver as unknown, and its elements
  contribute nothing. Note the cliff this feature walks off deliberately: an **empty** registry
  treats every type as known, so before this feature no type was ever unknown. Registering the seven
  turns that escape off, which is correct — a host that registers an eighth type of its own must
  register it properly — and it is a behaviour change worth stating rather than discovering.
- **A required question of an unregistered type.** The resolver already treats this asymmetrically:
  losing a decoration and stranding a learner on an unanswerable question are not comparable. The
  report says so too.
- **A plugin whose own `validate` throws.** Reported as an error against that element rather than
  taking the whole validation down: an author with one broken plugin still needs the other issues.
- **Two hundred issues.** Reported in full, grouped so the list stays navigable. Truncating would
  hide the one that matters.
- **A warning the organisation treats as an error.** BR-012's accessibility metadata is exactly this.
  The rule finds the missing alt text; the policy decides whether that stops a publish.
- **A host that sets no policy at all.** Everything policy-governed is a warning, so the lesson
  publishes and the teacher is still told. That is the default, and it is the one most organisations
  will run on.
- **Publishing twice in quick succession.** The second either supersedes the first or is refused as a
  conflict; it never produces two active versions.
- **Publishing while offline.** Refused with a reason, and the draft untouched — the same shape ED-5
  established for a save. The reason has to distinguish "your work could not be saved" from "your
  lesson cannot be published": one is about the network and the other is about the lesson, and a
  teacher told the wrong one goes looking in the wrong place.
- **Publishing with an unanswered conflict.** Somebody else has saved this lesson, so the save that
  must precede a publish cannot succeed. Publishing waits on the conflict being answered, which is
  the existing path rather than a second one.
- **An asset that exists at validation and is gone by publish.** Validation said nothing and
  publishing refuses, which is correct rather than inconsistent: the warning is a courtesy about a
  moment that has passed, and the block is about the package being made now.
- **An asset that is missing at validation and restored by publish.** The warning was right when it
  was given and publishing proceeds. A teacher who fixes a problem should not have to re-run a
  report to be allowed to continue.
- **A published version whose schema format is older than the current one.** It plays as published:
  bringing it forward would change what a learner receives, which BR-008 forbids.
- **Withdrawing a lesson nobody published.** Answered plainly rather than treated as an error state.
- **A withdrawn lesson requested by a host.** Reported as withdrawn, not as missing. A host that
  cannot tell the two apart will show a learner "this lesson does not exist" about a lesson that
  plainly does.
- **A learner mid-lesson when it is withdrawn.** The framework leaves them alone and makes the state
  visible. Whether they are stopped, allowed to finish, or told at the end is a judgement about *why*
  the lesson was withdrawn, and only the host knows that.

## Requirements *(mandatory)*

### Functional Requirements

**Finding what is wrong (US1)**

- **FR-001**: The system MUST validate a whole lesson on request and report every issue it finds in
  one pass (FR-PUB-001).
- **FR-002**: Every issue MUST carry a severity, and errors MUST be distinguishable from warnings
  (FR-PUB-002).
- **FR-003**: Every issue MUST identify the slide it concerns, and the element where it has one
  (FR-PUB-004).
- **FR-004**: Every issue MUST state the problem, the affected object, and the recommended action
  (NFR-USA-004). A code alone is not a message.
- **FR-005**: The teacher MUST be able to go from an issue to its source in one action, with the
  slide shown and the element selected where there is one (FR-PUB-005).
- **FR-006**: Checks specific to an element type MUST come from that type's own registration. The
  engine MUST NOT branch on element type (Constitution I). `ElementPlugin.validate` is the seam, and
  this is its first consumer.
- **FR-006a**: Each of the seven MVP element types MUST have a complete `ElementPlugin`, including a
  `validate`. Constitution I requires a plugin to supply its full contract — data schema, editor
  component, player renderer, inspector configuration, and validator — and states that partial
  plugins are rejected. The seven have carried a renderer and an editor since Wave 2 and no core
  plugin, so the seam FR-006 describes has been real and empty. A validation engine with a seam and
  no producers validates nothing a teacher can actually author.
- **FR-006b**: Registering those plugins MUST NOT change what any lesson renders **or what a teacher
  sees while authoring it**. They add checks; they change neither playback nor the inspector, and both
  halves are asserted across the change rather than assumed. The second half is easy to forget
  precisely because it is not playback: a plugin carries an inspector specification as well as a
  resolver, and a registered one currently takes precedence over the editor's own.
- **FR-006c**: A type's own checks MUST NOT restate what the format already rejects. The schema
  already reports a correct answer naming no option; a plugin repeating it produces two issues for
  one fault, which is the duplication this whole engine is arranged to avoid.
- **FR-007**: The validation engine MUST be pure and deterministic: the same lesson yields the same
  issues, in the same order, every time, with no input beyond the lesson and the policy. Anything
  that must ask the outside world a question MUST live outside it (see FR-016a).
- **FR-008**: Validation MUST report a lesson a learner could reach and not leave — the required
  question with no way past it that today is reported only to the learner.
- **FR-009**: Validation MUST report the authoring rules the editor already surfaces — an element
  outside its slide (BR-017), a slide whose advance condition cannot be met (BR-006), a sequence
  that will not resolve (BR-016) — by using the same logic rather than restating it. Two answers to
  one question is how a teacher learns to trust neither.
- **FR-010**: Validation MUST report missing accessibility metadata every time it is missing, at a
  severity the host's policy determines. The default MUST be **warning** (BR-012).
- **FR-010a**: The host MUST be able to raise any policy-governed rule to an error, and the raised
  severity MUST then block publication like any other error — the policy changes what a severity
  *is*, not what a severity *does*.
- **FR-010b**: The policy MUST NOT be able to silence a rule. It chooses between warning and error;
  it does not choose between reported and not. A rule an organisation does not want blocking is a
  warning, and a rule nobody wants to see is a rule that should not exist.
- **FR-011**: A lesson with nothing wrong MUST say so, rather than presenting an empty list.
- **FR-012**: Validation MUST NOT change the lesson in any way.

**Blocking a publish (US2)**

- **FR-013**: An error MUST block publication (FR-PUB-003).
- **FR-014**: A warning MUST NOT block publication.
- **FR-015**: Publishing MUST validate immediately beforehand. An earlier result MUST NOT be trusted,
  because the draft may have moved since.
- **FR-016**: Publishing MUST be refused when the lesson references an asset that cannot be resolved,
  naming it (BR-018, FR-PUB-014). This check MUST run at publish and MUST NOT rely on an earlier
  answer: an asset present an hour ago may be gone now, and BR-018 is about what the *published*
  package references.
- **FR-016a**: Validation MUST also be able to report an unresolvable asset as a **warning**, through
  a pass separate from the engine. A missing image is the one problem a teacher cannot diagnose from
  the report alone, so learning about it while editing is worth the round trip — but the pure engine
  MUST NOT depend on that pass, and a caller that cannot afford to wait MUST be able to skip it and
  still get every other issue.
- **FR-016b**: The two MUST agree about what an asset reference is. One rule reported at two
  strengths is a courtesy; two rules disagreeing about which assets a lesson uses is a defect.
- **FR-017**: A refused publish MUST leave the draft exactly as it was.

**What publishing produces (US3)**

- **FR-018**: Publishing MUST create a snapshot of the lesson as it stands (FR-PUB-006).
- **FR-018a**: Publishing MUST save any outstanding changes first, and MUST publish what was saved.
  If that save does not succeed, publishing MUST NOT happen and the teacher MUST be told why.
  Publishing a state storage never held would produce a version nobody could reproduce and a record
  that pointed at nothing.
- **FR-019**: Draft edits MUST NOT alter a published version (FR-PUB-007, BR-009).
- **FR-020**: Nothing in the framework MUST be able to modify a published version. The capability
  MUST be absent rather than guarded — as with the conflict token, a rule enforced by the shape of
  the interface is a property, and a rule enforced by review is a hope (BR-008).
- **FR-021**: A published version MUST be playable without the draft it came from.
- **FR-022**: A published version MUST carry the identity of whoever published it and the time it
  was published (FR-PUB-009).
- **FR-023**: A published version MUST play as published, even when the current format has moved on.
  Bringing it forward would change what a learner receives.

**Publishing again (US4)**

- **FR-024**: An authorized user MUST be able to publish a newer version (FR-PUB-008).
- **FR-025**: Earlier published versions MUST be retained.
- **FR-026**: Exactly one version MUST be active at a time, and it MUST be the most recently
  published one that has not been withdrawn.
- **FR-027**: The active version MUST be addressable by a stable identifier a host can put behind a
  URL. The framework MUST NOT provide the URL itself — it ships no server (FR-PUB-011).
- **FR-028**: Published versions MUST be listable, newest first, each carrying its publisher and its
  time.

**Withdrawing, and the record (US5)**

- **FR-029**: An authorized user MUST be able to withdraw a published lesson so that no version is
  active (FR-PUB-010).
- **FR-029a**: Once withdrawn, a request for the active version MUST report that none is available,
  distinguishably from a lesson that never existed. "Withdrawn" and "not found" send a host looking
  in two different places.
- **FR-029b**: What happens to a learner already part-way through MUST be the host's decision. The
  framework MUST make the state discoverable and MUST NOT interrupt a lesson in progress by itself:
  it does not know whether this withdrawal is a correction that should stop everyone now or an
  end-of-term tidy-up that should let a class finish.
- **FR-030**: Withdrawal MUST NOT delete anything.
- **FR-031**: A withdrawn lesson MUST be restorable without creating a new version.
- **FR-032**: An unauthorized attempt MUST be refused, and the refusal MUST say that permission is
  what is missing rather than that the action failed. Nothing MUST be published, withdrawn, or
  restored by it.
- **FR-032a**: The framework MUST NOT hold roles, permissions, or any model of who may do what. It
  asks by attempting, and the boundary answers — the same shape a save already has, and the same
  division that put conflict semantics in the interface rather than in each host's endpoint. A
  framework that decided permissions would be deciding them for organisations whose rules it has
  never seen.
- **FR-033**: Every publish, withdrawal, and restoration MUST be recorded with who did it and when
  (FR-PUB-015).
- **FR-034**: The record MUST be append-only. Nothing in the framework MUST be able to alter or
  remove an entry.

**Across all five**

- **FR-035**: The storage boundary MUST be able to publish a version, list published versions, read
  one, withdraw, restore, and read the record. It can do none of these today.
- **FR-036**: Publishing MUST NOT change the draft, its history, or its save state.
- **FR-037**: The whole feature — validation, refusal, publication, withdrawal, and the record —
  MUST be exercisable with no host backend.
- **FR-038**: Every new surface MUST be keyboard-operable with an accessible name, role, and state,
  MUST resolve its styling from theme tokens, and MUST NOT convey severity through colour alone.
- **FR-039**: Validating the 50-slide, 300-element lesson MUST NOT block the editor, and MUST
  complete within one second.
- **FR-040**: BR-008, BR-009, BR-012, and BR-018 MUST each gain a rule-named test, taking
  `check:rules` from 14 of 18 to 18 of 18.

### Key Entities

- **Issue**: One thing wrong with a lesson — a code, a severity, a message written for a teacher, and
  where it is: the slide, and the element when it has one.
- **Validation report**: Every issue for one lesson, in a deterministic order, plus whether anything
  in it blocks publication.
- **Severity**: `error` or `warning`. Errors block; warnings do not. Which one a given rule produces
  may come from policy rather than from the rule.
- **Validation policy**: Which policy-governed rules an organisation treats as errors rather than
  warnings. Supplied by the host, defaulting to warning for all of them. It can raise a severity and
  lower it; it cannot silence a rule.
- **Published version**: An immutable snapshot, its publisher, its time, and the format version it
  was published under.
- **Publication record**: The append-only sequence of publish, withdraw, and restore actions, each
  with who and when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All seven MVP element types contribute their own checks, and the engine contains zero
  branches on element type. Measured across the seven rather than across "every registered type",
  because zero registered types satisfies the second and nothing at all satisfies a teacher.
- **SC-001a**: Registering the seven changes zero rendered output and zero inspector fields — every
  existing playback, parity, and inspector suite passes unmodified.
- **SC-002**: 100% of errors block publication and 0% of warnings do.
- **SC-002a**: The pure engine completes with the host unreachable, returning every issue except the
  asset warnings — measured with no asset resolver supplied at all.
- **SC-003**: A published version is byte-identical after any number of draft edits — measured over
  a session that edits, deletes, undoes, and restores.
- **SC-004**: A teacher reaches an issue's source in exactly one action, for every issue that has a
  source.
- **SC-005**: Validating the 50-slide, 300-element lesson completes within one second and leaves the
  editor's input-to-feedback budget unchanged.
- **SC-006**: There are zero routes through the framework by which a published version can be
  modified.
- **SC-007**: `check:rules` reports 18 of 18 business rules covered, up from 14.
- **SC-007a**: With no policy supplied, zero policy-governed rules block publication and 100% of them
  are still reported.
- **SC-008**: A lesson a learner could reach and not leave is reported to the author in 100% of the
  dead-end shapes the player already detects for the learner.
- **SC-009**: Every publish, withdrawal, and restoration appears in the record with its actor and
  time, and zero entries can be altered afterwards.
- **SC-009a**: A permission refusal changes nothing — zero versions published, withdrawn, or
  restored — and says permission is what was missing, across every action that can be refused.
- **SC-010**: The whole feature is exercisable with no host backend and no network.
- **SC-011**: Every new surface passes automated accessibility checks and is operable from the
  keyboard alone.
- **SC-012**: A refused publish leaves the draft byte-identical in 100% of refusal paths — errors,
  missing assets, permission, and unreachable storage.

## Assumptions

- **The framework validates and refuses; the host publishes and authorizes.** Whether this person may
  publish is the host's question — it has the identities and the roles — and the framework finds out
  the only way it honestly can: by attempting, and being told. It holds no roles and pre-empts
  nothing. This is the same division EN-6 set for storage and ED-5 followed for conflicts, and it is
  why a permission refusal reads like the other refusals rather than like a special case.

  The alternative worth naming: a host could declare capabilities up front so controls could be
  disabled rather than refused. That is a better *interface* and a worse *guarantee* — a disabled
  button is a hint, and the refusal is what actually protects the lesson. A host that wants the hint
  can render its own; it knows the roles.
- **Identity and time come from the host, as they did for checkpoints.** ED-5 established that the
  host's storage is the only participant with an authoritative clock, and the editor is forbidden
  from reading one. A publisher's identity is the host's for the same reason. Note that this is a
  *different* identity from ED-5's author handle, which scopes locally kept work and never crosses
  the storage boundary: a publication record is meant to leave.
- **Asset availability is checked twice, at two strengths.** The engine stays pure, synchronous, and
  deterministic — asking whether an asset resolves is none of those — so the check lives in a
  separate pass that reports a **warning**, and publishing re-checks and refuses on an **error**.
  The apparent duplication is the point: a missing image is the one problem a teacher cannot fix from
  the report alone, and it is also the one whose answer changes between being told and acting on it.
  A single check would have to choose between telling them early and being trustworthy.
- **Accessibility metadata defaults to a warning.** BR-012 says "according to organization policy",
  so the rule cannot decide and the default is what every organisation that never sets one gets. An
  *error* default would refuse lessons that most organisations publish daily, which does not protect
  accessibility — it teaches people to route around the gate, and a gate people route around protects
  nothing. A *warning* default under-serves organisations with a legal duty, and those are precisely
  the ones that will set a policy rather than inherit a default.

  Constitution III is not diluted by this. WCAG 2.2 AA remains a merge gate for the framework's own
  learner-facing UI; what a *teacher's lesson* must carry before it may be published is the
  organisation's call, and the framework's job is to make sure they always know.
- **Withdrawal is not deletion, and there is no hard delete.** FR-PUB-010 says "unpublishing or
  archiving"; neither word means destroying. A framework that could destroy a published version could
  be asked to.
- **Withdrawal changes availability, not playback.** A learner mid-lesson is not interrupted by the
  framework. The distinction that decides it: a withdrawal because the lesson teaches something wrong
  should stop everyone immediately, and a withdrawal because term ended should let the class finish —
  and nothing in a manifest says which this is. The framework makes the state discoverable and leaves
  the judgement with whoever has the context to make it.
- **The record is the framework's, the audit trail is the host's.** The framework records what it
  did; an organisation's compliance log is a larger thing that belongs to whoever runs it.
- **No approval workflow.** Review and sign-off are a first-follow-up-release item in spec §19, and
  a publish gate that waited for an approver is a different feature.
- **A published version keeps the format it was published under.** Migrating it on read would change
  what a learner receives, which is the one thing BR-008 forbids — so the player must be able to play
  an older published format, and that is a constraint on migrations rather than on this feature.

## Dependencies

- **SCH-2 (the schema validator).** `validate` answers whether a lesson is *structurally* a lesson.
  PB-1 is the layer above it: a lesson can satisfy the schema completely and still be one no learner
  can finish. The two must not be confused, and the reports must not duplicate each other.
- **`ElementPlugin.validate`.** Declared in Wave 1, never called. This feature is its first consumer,
  and the ninth instance of a pattern this project has now named eight times.
- **The editor's existing findings.** `collectProblems` has emitted `ELEMENT_BEYOND_SLIDE` since
  Wave 1; the timeline reports overruns; the preview reports a slide a learner cannot leave. This
  feature must *use* those rather than re-derive them, or the editor and the validator will
  eventually disagree.
- **EN-6's storage boundary, as ED-5 extended it.** Publishing is its fourth addition, and — as with
  ED-5 — the shape of the gap was found by trying to use it: there is no `publish`, no way to list or
  read published versions, and nowhere for the record to live.
- **ED-5's save loop.** Publishing saves first and publishes what was saved (FR-018a), so this
  feature drives a hook feature 008 owns rather than reimplementing one. It inherits that loop's
  failure paths with it: an unreachable storage, a permission refusal, and an unanswered conflict
  are all reasons a publish does not happen, and none of them is about the lesson.
