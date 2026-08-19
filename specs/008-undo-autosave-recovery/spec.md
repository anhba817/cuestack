# Feature Specification: Undo, Autosave, and Recovery

**Feature Branch**: `008-undo-autosave-recovery`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Start ED-5 and finish wave 4"

Wave 4 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md), final tranche:
ED-5. ED-1, ED-2, ED-3, ED-4, ED-6, and QA-5 are delivered; this is the last item in the wave.

This is the feature the editor has been borrowing against. Three surfaces in the studio today are
confirmations written explicitly as placeholders for undo, each carrying a comment saying so —
`DeleteConfirmation` ("FR-CAN-011 and ED-5 bring real undo, and when they do this prompt should be
*removed* rather than kept alongside it"), the effect-removal prompt, and the sequence Custom
prompt ("undo does not exist until ED-5, so the confirmation is the only thing standing between an
experiment and a loss"). This feature owes their removal, not a companion to them.

It is also the first consumer of a boundary built three waves ago. `StorageAdapter` has defined
`loadDraft`, `saveDraft`, and `listVersions` since EN-6 — with a conflict case in the signature so
a host *cannot* implement last-writer-wins — and nothing has ever called any of them. Every
feature since 005 has changed an in-memory draft and handed it to the host through `onChange`. The
seventh instance of the pattern the plan named at Wave 4: the kernel is built ahead of its
consumers, so the reliable way to review one of its contracts is to try to use it. Trying to use
it here surfaces one gap immediately — the interface can list earlier versions but cannot return
one, so FR-DAT-009 is unimplementable against it as written.

The requirements this discharges are FR-DAT-001 through FR-DAT-010, FR-CAN-011, FR-CAN-012,
NFR-PERF-005, NFR-REL-001, and the undo half of NFR-USA-003.

## Clarifications

### Session 2026-08-18

- Q: When a teacher nudges the same element ten times in a row with the arrow keys, should pressing undo take back all ten nudges at once, or one nudge per press? → A: A run of repeated changes of the same kind to the same elements collapses into one step, broken by any different change, a selection change, or a slide change — never by elapsed time.
- Q: With autosave firing about every 1.5 seconds of idle time, should every save appear in the version history the teacher browses? → A: No. Every save still advances the version the editor holds, but a history entry is recorded only at checkpoints — the first save after a lesson is opened, then at a bounded interval of continued editing — plus any the teacher asks for by name.
- Q: When the editor finds newer work kept locally from an interrupted session, or hits a save conflict, must the teacher answer before they can carry on editing? → A: Recovery blocks and is answered before the lesson opens; a conflict does not block — it is a persistent notice the teacher can leave standing while they keep working, with autosave stopped until they answer.
- Q: On a shared classroom computer, should work kept in the browser be readable by whoever opens the browser next? → A: No. Kept work is scoped per lesson and per the author identity the host supplies; with no identity supplied nothing is offered on reopening, though the local copy is still used for the automatic resend while the session lasts.
- Q: How many times should the editor retry a failing save on its own before it stops and waits for the teacher to ask again? → A: Five attempts over about two minutes, after which the status stops claiming to be trying and offers an explicit retry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A teacher can take back anything they just did (Priority: P1)

The teacher deletes an element, moves three others, retimes a caption, and changes their mind about
all of it. Each press of undo takes back exactly one thing they did, in the order they did it, and
shows them what came back. Redo puts it forward again. Nothing asks them whether they are sure
first, because being sure is no longer the price of trying something.

**Why this priority**: It is the debt three shipped surfaces are standing in for, it is the largest
single behaviour in the feature, and it is the one that changes how the rest of the editor feels.
It is also independent of persistence — undo is correct with no backend at all.

**Independent Test**: Open a lesson, perform each kind of change the editor offers, undo each one,
and confirm the lesson is byte-identical to what it was before that change. Redo and confirm it
returns. Confirm no confirmation prompt appears for any destructive action.

**Acceptance Scenarios**:

1. **Given** a lesson with an element selected, **When** the teacher deletes it and undoes, **Then**
   the element returns with its geometry, timing, effects, and flags exactly as they were, and it is
   selected.
2. **Given** a completed drag of three elements, **When** the teacher undoes once, **Then** all
   three return to where they started — one drag is one step, not one step per element and not one
   per frame of the drag.
3. **Given** ten arrow-key nudges of the same element with nothing in between, **When** the teacher
   undoes once, **Then** the element returns to where it was before the first nudge; pressing a
   different key or selecting something else first would have ended the run.
4. **Given** a change the teacher has undone, **When** they redo, **Then** the change is reapplied
   and the lesson matches what it was before the undo.
5. **Given** a change the teacher has undone, **When** they make a different change instead, **Then**
   redo is no longer offered and the discarded branch does not reappear later.
6. **Given** an edit made on slide 2 while the teacher is now looking at slide 5, **When** they undo,
   **Then** the editor brings slide 2 into view so the reversal is visible rather than silent.
7. **Given** a lesson open in read-only mode, **When** the teacher attempts to undo, **Then** it is
   refused with the same refusal every other change receives.
8. **Given** a session of pure navigation — changing slides, selecting, scrubbing authoring time —
   **When** the teacher presses undo, **Then** nothing happens, because none of that changed the
   lesson.
9. **Given** any destructive action in the editor, **When** the teacher performs it, **Then** no
   confirmation dialogue appears, and a single undo takes it back.
10. **Given** undo and redo, **When** operated from the keyboard alone, **Then** both work through the
   platform's conventional shortcuts and each announces what it reversed or reapplied.

---

### User Story 2 - The lesson saves itself, and says so honestly (Priority: P2)

The teacher stops typing. A moment later the editor saves, without being asked, and says so. It
says *Saving* while it is saving and *Saved* only once the save has actually landed somewhere — not
when it was sent. It also says *Saved* when there is nothing outstanding at all, which is true of a
lesson just opened as much as of one just written. When it cannot save, it says that too, in words
that name the problem and what to do about it.

**Why this priority**: It is the promise a teacher stakes an hour of work on, and the one that
distinguishes an editor from a toy. It depends on nothing in US1 and can ship without it.

**Independent Test**: Open a lesson with an in-memory storage and confirm it reads Saved with nothing
outstanding. Make a change, advance the clock past the idle interval, and confirm the save happens
and the status moves **Saved → Saving → Saved**. Hold the acknowledgement and confirm the status
stays Saving. Make the storage fail and confirm the status
becomes Save Failed with an actionable message.

**Acceptance Scenarios**:

1. **Given** a change to the lesson, **When** roughly 1.5 seconds pass with no further change,
   **Then** the editor begins saving without being asked.
2. **Given** a save in progress, **When** the storage has not yet acknowledged it, **Then** the
   status reads Saving and never Saved.
3. **Given** an acknowledged save, **When** the acknowledgement arrives, **Then** the status reads
   Saved and the editor holds the version the storage returned.
4. **Given** a teacher typing continuously, **When** changes arrive faster than the interval,
   **Then** the interval restarts rather than queueing a save per keystroke.
5. **Given** a change that the editor refused — a locked element, an invalid value — **When** the
   interval passes, **Then** no save occurs, because nothing changed.
6. **Given** a session of pure navigation, **When** any amount of time passes, **Then** no save
   occurs and the lesson is byte-identical to what was loaded.
7. **Given** a save that fails, **When** it fails, **Then** the status reads Save Failed and states
   which lesson, what went wrong, and what the teacher can do.
7a. **Given** an unanswered conflict, **When** the teacher asks to save now, **Then** no save is
    attempted and the conflict and its choices are put back in front of them.
8. **Given** a save in progress, **When** the teacher keeps editing, **Then** editing is never
   blocked and the newer state is saved after the current attempt settles.
9. **Given** a teacher who does not want to wait, **When** they ask to save now, **Then** the save
   begins immediately.
10. **Given** a save that keeps failing, **When** five automatic attempts over about two minutes are
    spent, **Then** the editor stops retrying, says so rather than appearing to still be trying, and
    offers an explicit retry.
11. **Given** an editor that has stopped retrying, **When** the teacher makes another change, **Then**
    the automatic attempts begin again.

---

### User Story 3 - A dropped connection does not cost work (Priority: P3)

The teacher's connection goes. They keep working — the editor keeps their changes and says
*Offline* rather than pretending. The connection comes back and the work goes up without being
asked. If the browser is refreshed while still offline, the work is still there when the lesson
reopens, and the teacher is asked whether to bring it back rather than having it appear or vanish
by itself — and only that teacher is asked, because the next person at a shared classroom computer
has no business being offered somebody else's unsaved lesson.

**Why this priority**: It is the difference between an inconvenience and a lost afternoon, and
NFR-REL-001 makes the refresh case explicit. It requires US2's save loop to exist first.

**Independent Test**: Make changes with storage unreachable, confirm the status reads Offline and
the changes are kept; restore reachability and confirm the work saves with no teacher action.
Separately, discard the editor entirely mid-interruption, reopen the lesson, and confirm the kept
work is offered.

**Acceptance Scenarios**:

1. **Given** storage is unreachable, **When** the teacher makes changes, **Then** the status reads
   Offline and the newest state is kept locally.
2. **Given** kept work and an unreachable storage, **When** storage becomes reachable, **Then** the
   editor saves the kept state without the teacher asking, and the status moves to Saved.
3. **Given** kept work, **When** the browser is refreshed and the lesson reopened, **Then** the
   editor reports that newer local work exists and lets the teacher restore or discard it, and the
   lesson does not open for editing until they have chosen.
4. **Given** kept work that the teacher chooses to restore, **When** they restore it, **Then** the
   editor opens with that work in place and treats it as unsaved.
5. **Given** kept work that the teacher chooses to discard, **When** they discard it, **Then** the
   local copy is removed and the storage's version is what opens.
6. **Given** kept work, **When** storage acknowledges it, **Then** the local copy is cleared, so a
   later refresh does not offer work that is already saved.
7. **Given** two different lessons edited offline, **When** either is reopened, **Then** it is
   offered only its own kept work.
8. **Given** kept work made by one teacher, **When** a different teacher opens the same lesson at the
   same browser, **Then** they are not offered it.
8a. **Given** an interruption, **When** the teacher types steadily, **Then** the work is kept on the
    save schedule rather than on every keystroke, and typing stays as responsive as it is online.
8b. **Given** unkept changes, **When** the page is closed or refreshed, **Then** they are written
    before it goes.
8c. **Given** a browser that refuses to keep the work, **When** the editor tries, **Then** the
    teacher is told their work is not being kept locally.
8d. **Given** kept work and a lesson someone else has saved since, **When** the teacher reopens it,
    **Then** the offer says the lesson has changed, and restoring leads to the ordinary conflict.
9. **Given** a host that supplies no author identity, **When** the lesson is reopened, **Then** no
   kept work is offered — and within the session that made it, an interruption still resends
   automatically.

---

### User Story 4 - A newer version is never silently replaced (Priority: P4)

The teacher's colleague saved the same lesson while this teacher's editor was open. The next save
is refused rather than applied. The editor stops saving into the conflict, says what happened, and
gives the teacher a way forward that does not throw away either side by itself.

**Why this priority**: FR-DAT-007 is a MUST NOT with data-loss consequences, and the storage
interface was designed around it three waves ago — `saveDraft` cannot be called without a version
token and `SaveResult` has a conflict case a caller must handle. This story is what makes that
design load-bearing rather than decorative.

**Independent Test**: Save a draft, mutate the stored lesson behind the editor's back, make a change,
and confirm the save is refused, the stored newer version is unchanged, and the teacher is told and
offered choices.

**Acceptance Scenarios**:

1. **Given** an editor holding version A and storage holding version B, **When** the editor saves,
   **Then** the save is refused and version B is left exactly as it was.
2. **Given** a refused save, **When** it is refused, **Then** the editor stops autosaving into the
   conflict rather than retrying the same losing save.
3. **Given** a conflict, **When** the teacher is told, **Then** the message names the lesson, says a
   newer version exists, and offers a way forward.
4. **Given** a conflict, **When** the teacher chooses to take the stored version, **Then** their own
   work is preserved somewhere they can reach before it is replaced.
5. **Given** a conflict, **When** the teacher chooses to keep their own work, **Then** it is saved as
   a new draft rather than over the newer version.
6. **Given** a conflict the teacher has not yet answered, **When** they keep editing, **Then** editing
   is not blocked, their local work is not discarded, and the notice is still there when they look
   back at it.
7. **Given** a conflict the teacher never answers, **When** they close the editor, **Then** their work
   is kept locally and offered to them when the lesson is reopened.

---

### User Story 5 - An earlier draft can be brought back (Priority: P5)

The teacher restructured a lesson yesterday and wants what it was before. They open the lesson's
history, see a readable handful of checkpoints rather than every autosave, and bring one back.
Bringing it back adds a new version — it does not erase the day's work in between, and they can undo
it like anything else. Before an experiment they are unsure about, they can mark a checkpoint of
their own and give it a name.

**Why this priority**: It is the largest new surface and the least urgent — undo covers the recent
past, autosave covers the crash, and history covers the regret. FR-DAT-010's rule that restoring is
additive is the part that makes it safe to offer at all.

**Independent Test**: Edit a draft through many autosaves, confirm the history holds checkpoints
rather than one entry per save, restore an earlier checkpoint, and confirm the editor holds that
content, a new version exists, and every checkpoint made after the restored one is still listed.

**Acceptance Scenarios**:

1. **Given** a lesson edited across many autosaves, **When** the teacher opens its history, **Then**
   the checkpoints are listed newest first, each identified by when it was recorded — not one entry
   per save.
2. **Given** an hour of continued editing, **When** the teacher opens the history, **Then** it holds
   a handful of checkpoints rather than the dozens of saves that actually occurred.
3. **Given** a teacher about to try something risky, **When** they ask for a checkpoint and name it,
   **Then** it appears in the history under that name.
4. **Given** a listed checkpoint, **When** the teacher restores it, **Then** the editor holds that
   version's content.
5. **Given** a restore, **When** it completes, **Then** a new version exists and no checkpoint
   made after the restored one has been removed.
6. **Given** a restore, **When** the teacher changes their mind, **Then** a single undo takes it back
   like any other change.
7. **Given** unsaved work, **When** the teacher restores an earlier version, **Then** the unsaved
   work is saved as a checkpoint first, so the state being left is itself in the history and can be
   returned to.
7a. **Given** storage that has become unreachable since the history was listed, **When** the teacher
    restores, **Then** the restore does not proceed and they are told why — their unsaved work is
    not discarded at the moment its safety net failed.
8. **Given** storage is unreachable, **When** the teacher opens the history, **Then** the editor says
   the history is unavailable rather than showing an empty list.
9. **Given** a stored version written under an earlier format, **When** the teacher restores it,
   **Then** it is brought to the current format first and restores normally (FR-050).
10. **Given** a stored version the current format would refuse and cannot bring forward, **When** the
    teacher restores it, **Then** the restore is refused with a reason and the draft is left
    untouched — the editor never holds a lesson the player could not load.
11. **Given** a restore, **When** it completes, **Then** no published version of the lesson has
    changed.

---

### Edge Cases

- **Nothing to undo.** Undo at the start of a session does nothing and says nothing alarming; the
  control is offered as unavailable rather than absent, so its position is stable.
- **History exhausted.** Past the retained depth, the oldest steps are dropped. The teacher is not
  told step by step, but undo must never appear to work and silently do nothing.
- **Ten arrow-key nudges.** The run collapses into one undo step, so one press returns the element
  to where it started. Pressing a different key, selecting something else, or changing slide ends the
  run, and the next nudge begins a new step.
- **A drag followed by a nudge of the same element.** Both are the same kind of change to the same
  element, so they collapse — undo returns the element to where it was before the drag. This follows
  from FR-004a rather than being a special case, and it matches how a teacher describes what they did:
  they were positioning one thing.
- **Undo after a restore.** A restore is a change like any other and is undone like one.
- **Undo while a save is in flight.** The reversal is a new state to save; the in-flight save is
  allowed to settle and the reversal is saved after it.
- **Undo does not mean unsave.** Undoing does not remove any acknowledged version from history.
- **A save that keeps failing.** Five automatic attempts over about two minutes, backing off between
  each. After that the status stays Save Failed, the editor stops implying an attempt is under way,
  and the teacher can ask for a retry — as can any further change they make.
- **Three different failures, three different messages.** Unreachable, unauthorized, and conflict
  are distinct conditions and must not collapse into one "could not save".
- **Refresh with a save in flight.** The state was kept locally before the attempt, so an
  unacknowledged save is recoverable.
- **Typing steadily while offline.** Keeping happens on the save schedule, so a 300-element lesson is
  serialized once every second and a half rather than once per character.
- **A browser with no room left.** The teacher is told their work is not being kept, rather than
  being left to believe it is.
- **A shared staffroom computer.** Kept work is offered only to the identity that made it. Another
  teacher opening the same lesson sees the stored version and no recovery offer.
- **A host that supplies no identity.** Nothing is offered on reopening; the automatic resend within
  the session still works. Failing closed here loses a convenience, and failing open would leak a
  draft.
- **Recovered work for a lesson the teacher can no longer open.** The recovery offer must not be the
  only copy: discarding is explicit, and an unauthorized load does not silently delete kept work.
- **A conflict left unanswered for an hour.** Editing continues, the notice stays, autosave stays
  stopped, and the newest state is kept locally throughout — so an unanswered conflict costs a
  teacher nothing but the reassurance of seeing Saved.
- **Two tabs on one lesson.** Out of scope as a supported workflow, and it must still be safe: the
  second tab's save conflicts rather than overwrites.
- **Restore while offline.** Refused with a reason, not attempted and half-completed — including the
  case where storage was reachable when the history was listed and is not by the time the teacher
  chooses, which is the version that actually happens.
- **An hour of uninterrupted editing.** Autosave fires dozens of times and the history gains at most
  five entries, because entries are recorded at checkpoints rather than at saves.
- **A checkpoint interval that elapses while nobody is editing.** The interval counts continued
  editing, not wall-clock time, so a lesson left open overnight does not accumulate checkpoints.
- **Listing the history.** It must not require loading any version's content to show.

## Requirements *(mandatory)*

### Functional Requirements

**Reversing changes (US1)**

- **FR-001**: The editor MUST let a teacher reverse the most recent change to the lesson, and MUST
  reverse changes in the reverse of the order they were made.
- **FR-002**: The editor MUST let a teacher reapply a change they have just reversed.
- **FR-003**: Making a new change after a reversal MUST discard the reversed changes; reversed and
  new changes MUST NOT interleave.
- **FR-004**: One completed authoring action MUST correspond to exactly one reversal step — a drag,
  a committed text edit, a multiple-element delete, and an applied sequence are each one step.
- **FR-004a**: An uninterrupted run of repeated changes of the same kind to the same elements MUST
  collapse into one reversal step. The run MUST be broken by a change of a different kind, a change
  to a different set of elements, a selection change, or a slide change — and MUST NOT be broken by
  elapsed time, so history never depends on how fast the teacher works.
- **FR-005**: The editor MUST retain at least 50 reversal steps for the open lesson.
- **FR-006**: A reversal MUST restore the lesson's authored data exactly, including element order,
  timing, effects, and flags.
- **FR-007**: Session state that is never serialized into the lesson MUST NOT be recorded as a
  reversal step, and reversing MUST NOT change it except where FR-008 and FR-009 require it.
- **FR-008**: When a reversal changes a slide the teacher is not currently viewing, the editor MUST
  bring that slide into view.
- **FR-009**: After a reversal or reapplication, the selection MUST name only elements the lesson
  contains, and elements restored by the reversal MUST be selected.
- **FR-010**: Undo and redo MUST be operable from the keyboard using the platform's conventional
  shortcuts (FR-CAN-012), and each MUST announce what it reversed or reapplied.
- **FR-011**: Undo and redo MUST be refused in read-only mode, using the same refusal the editor
  gives every other change.
- **FR-012**: The editor MUST NOT confirm a destructive action that one reversal can take back. The
  element-deletion confirmation, the effect-removal confirmation, and the sequence Custom
  confirmation MUST be removed rather than retained alongside undo.
- **FR-013**: A reversal or reapplication MUST be treated as a change for the purpose of saving.

**Saving without being asked (US2)**

- **FR-014**: The editor MUST begin saving approximately 1.5 seconds after the last change, with no
  teacher action (NFR-PERF-005).
- **FR-015**: A change arriving before the interval elapses MUST restart the interval rather than
  cause a second save.
- **FR-016**: The editor MUST report exactly one of **Saving**, **Saved**, **Offline**, and **Save
  Failed**, through one shared status surface and one vocabulary usable by publishing as well as
  saving (Constitution III, FR-DAT-002). There is no fifth state and no blank: a lesson with nothing
  outstanding reads **Saved**, which is true of a lesson just loaded from storage as much as of one
  just written to it.
- **FR-017**: The editor MUST NOT report Saved until storage has acknowledged the change
  (FR-DAT-003).
- **FR-018**: An action that changes no lesson data MUST NOT trigger a save.
- **FR-019**: A change the editor refused MUST NOT trigger a save.
- **FR-020**: The teacher MUST be able to request a save immediately rather than waiting for the
  interval. While a conflict is unanswered the request MUST NOT attempt a save; it MUST re-surface
  the conflict and its choices instead. Sending a save that is known to be refused teaches a teacher
  that the control does nothing, which costs more than the one refused request saves.
- **FR-021**: A failed save MUST be reported with the problem, the affected lesson, and a
  recommended action (NFR-USA-004), and MUST distinguish unreachable, unauthorized, and conflicting
  outcomes from one another.
- **FR-022**: Failed saves MUST be retried automatically with increasing delay, for at most five
  attempts spanning roughly two minutes. Once those are spent the editor MUST stop retrying, MUST
  stop presenting itself as still trying, and MUST offer the teacher an explicit retry.
- **FR-022a**: A change made after the automatic attempts are spent MUST restart them, so a teacher
  who keeps working is not left with an editor that has permanently given up.
- **FR-023**: Editing MUST remain available while a save is in flight, failing, or offline.

**Surviving an interruption (US3)**

- **FR-024**: While storage is unreachable, the editor MUST keep the newest unsaved state locally and
  report Offline (FR-DAT-004).
- **FR-024a**: The kept state MUST be written on the same schedule a save is attempted on, **not on
  every change**. Keeping is a whole-lesson write to the browser's synchronous storage, and the
  inspector commits a change per keystroke — writing per change would put a 300-element lesson's
  serialization between a teacher's key press and the character appearing, which Constitution IV
  forbids outright.
- **FR-024b**: When the page is being hidden or unloaded with unkept changes outstanding, the editor
  MUST write them before it goes. Otherwise FR-024a's interval is a window in which a refresh loses
  the newest edits — the exact moment FR-026 exists to cover.
- **FR-024c**: When the browser refuses to keep the work — no room, or storage unavailable to the
  page — the editor MUST tell the teacher that their work is not being kept locally. Failing
  silently here is worse than not keeping at all, because the teacher believes it is safe.
- **FR-025**: When storage becomes reachable again, the editor MUST save the kept state without the
  teacher asking (FR-DAT-005).
- **FR-026**: The kept state MUST survive an ordinary browser refresh (NFR-REL-001).
- **FR-027**: When a lesson opens and locally kept work exists for it, the editor MUST tell the
  teacher and let them restore or discard it. It MUST NOT apply it silently and MUST NOT discard it
  silently. **Existence is the whole test**: kept work is cleared the moment storage acknowledges it
  (FR-028), so work that is still there is by definition work storage has not got.
- **FR-027b**: When the stored lesson has moved on since the work was kept — someone else saved in
  between — the editor MUST say so in the same breath as the offer, because the teacher is choosing
  between two versions rather than recovering from an interruption. Restoring in that situation
  produces a conflict on the first save, which is FR-031's path and needs no separate one.
- **FR-027a**: The recovery choice MUST be answered before the lesson opens for editing. Until it is
  answered the editor MUST NOT show either copy as though it were the lesson, because showing one
  before the teacher has chosen is the silent application FR-027 forbids.
- **FR-028**: Once storage acknowledges the kept state, the local copy MUST be cleared.
- **FR-029**: Locally kept work MUST be scoped per lesson **and** per the author identity the host
  supplies, so one lesson's recovery never offers another's content and one teacher's unsaved work is
  never offered to another person at the same browser.
- **FR-029a**: When the host supplies no author identity, kept work MUST NOT be offered on reopening.
  It MUST still be kept and resent automatically for as long as the editing session lasts, so a
  connection drop costs nothing even where the framework cannot tell who is at the keyboard.
- **FR-029b**: The author identity MUST be used only to scope what is kept locally. It MUST NOT enter
  the lesson manifest, MUST NOT be sent to storage by the framework, and MUST NOT appear in any
  analytics event.

**Never overwriting a newer version (US4)**

- **FR-030**: Every save MUST carry the version the editor last knew about.
- **FR-031**: A save MUST be refused when storage holds a newer version, and the stored version MUST
  be left unchanged (FR-DAT-006, FR-DAT-007).
- **FR-032**: On a conflict the editor MUST stop autosaving into that conflict and MUST tell the
  teacher, naming the lesson.
- **FR-032a**: The conflict notice MUST NOT block editing. It MUST persist until the teacher answers
  it — surviving slide changes, selection changes, and further editing — and MUST NOT be dismissible
  in a way that leaves the conflict unresolved and unsignalled.
- **FR-033**: On a conflict the teacher MUST be offered at least two ways forward: take the stored
  version, or keep their own work as a new draft. Neither MUST discard the other side without the
  teacher choosing it.
- **FR-034**: A conflict MUST NOT discard the teacher's local work before they have chosen, including
  when the editor is closed with the conflict still unanswered — the work MUST be kept locally and
  offered again on reopening.

**Returning to an earlier draft (US5)**

- **FR-035**: The system MUST maintain a version history of the draft (FR-DAT-008). A history entry
  is distinct from the version the editor holds for conflict detection: every acknowledged save
  advances the latter, and only a checkpoint records the former.
- **FR-035a**: A checkpoint MUST be recorded on the first acknowledged save after a lesson is opened,
  on the first acknowledged save after 15 minutes of continued editing since the last checkpoint,
  whenever the teacher asks for one, and before a restore replaces unsaved work (FR-042).
- **FR-035b**: The teacher MUST be able to ask for a checkpoint and give it a name, so a version they
  will want later is findable by what it was rather than by when it happened.
- **FR-035c**: Saves between checkpoints MUST still be saved and MUST still be recoverable as the
  current draft. They are absent from the history, not absent from storage.
- **FR-036**: The teacher MUST be able to list a draft's checkpoints, newest first.
- **FR-037**: Each history entry MUST carry when it was recorded, and its name where the teacher gave
  one, so a teacher can tell the versions apart.
- **FR-038**: The storage boundary MUST be able to return the content of a named earlier version, and
  MUST be told whether a save is a checkpoint. It can do neither today: the interface can list
  versions and load only the current draft, which leaves FR-DAT-009 unimplementable as the boundary
  stands.
- **FR-039**: The teacher MUST be able to restore a listed version into the editor (FR-DAT-009).
- **FR-039b**: In read-only mode the history MUST remain viewable and restore MUST NOT be offered.
  The refusal that backs it is a backstop, not the interface: a control that looks operable and then
  refuses is the failure NFR-USA-004 describes.
- **FR-039a**: A restored version MUST reach the draft through the same path every other change
  takes. It MUST be validated before it becomes the draft, MUST be refused in read-only mode, and
  MUST be recorded as one reversal step. A version stored under an earlier format, or one an older
  release wrote, is exactly the content most likely to be invalid — so the restore path is the last
  place a validation may be skipped.
- **FR-040**: A restore MUST create a new version and MUST NOT remove any checkpoint made after the
  one restored (FR-DAT-010).
- **FR-041**: A restore MUST be reversible by the same single reversal action every other change is.
- **FR-042**: Unsaved work MUST be saved as a checkpoint before a restore replaces it, so the state
  being left is itself in the history and can be returned to.
- **FR-042a**: If that checkpoint cannot be written, the restore MUST NOT proceed, and the teacher
  MUST be told why. Continuing would discard unsaved work at the moment its safety net failed, which
  is the opposite of what FR-042 exists for.
- **FR-043**: When storage is unreachable, the history MUST report itself unavailable rather than
  present as empty.
- **FR-044**: Restoring a draft version MUST NOT alter any published version (BR-008, BR-009).

**Across all five**

- **FR-045**: Nothing in this feature MUST change what a learner receives. No new field enters the
  lesson manifest, and no history, save state, or recovery data influences playback (Constitution V).
- **FR-046**: Every new surface — status, history, recovery offer, conflict choice — MUST be
  keyboard-operable with an accessible name, role, and state, MUST resolve its styling from theme
  tokens, and MUST NOT convey its state through colour alone.
- **FR-047**: Saving, keeping, and history MUST NOT block editing or degrade the editor's
  input-to-visual-feedback budget (NFR-PERF-002).
- **FR-048**: The framework MUST exercise saving, conflict, recovery, and version history with no
  host backend, through the in-memory reference storage.
- **FR-049**: Every delay this feature introduces — the idle interval, retry backoff, connectivity
  checks — MUST be verifiable without waiting on real time (Constitution II).
- **FR-050**: A lesson arriving from storage — whether the current draft or a restored version —
  MUST be brought to the current format before it becomes the draft. A lesson that cannot be brought
  forward MUST be reported to the teacher, naming the lesson and what is wrong, and MUST NOT be
  loaded. This is the first path in the product by which a lesson enters the editor without having
  come from the editor, so it is the only place the question arises.

### Key Entities

- **Reversal step**: One completed authoring action, and enough of the lesson to return to the state
  before it. Carries which slide the change touched and which elements it created or removed, so a
  reversal can be shown rather than merely applied.
- **Save state**: Exactly one of Saving, Saved, Offline, Save Failed, with the failure carrying its
  reason. The single vocabulary shared with publishing.
- **Kept work**: The newest state that storage has not acknowledged, held against a named lesson and
  the author identity that made it, durable across a refresh, cleared on acknowledgement.
- **Author identity**: An opaque handle the host supplies to say who is editing. It scopes kept work
  and nothing else — it never reaches the manifest, storage, or analytics.
- **Version token**: The opaque handle identifying which version the editor last knew about. Already
  defined at the storage boundary; this feature is its first consumer.
- **History entry**: One checkpoint of a draft — the version it points at, its position in the
  history, when it was recorded, and the name the teacher gave it if they gave one. Distinct from the
  version token, which advances on every save.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every kind of change the editor can make to a lesson can be reversed in one action and
  reapplied in one action — measured as 100% of the editor's change kinds, with no kind exempt.
- **SC-002**: After a reversal, the lesson is byte-identical to what it was before the change was
  made, for every change kind.
- **SC-003**: A reversal completes within 100 ms on a 50-slide, 300-element lesson, and recording a
  step leaves the time to apply a change within the same budget it met before this feature.
- **SC-004**: Zero confirmation prompts remain in the editor for actions a single reversal can take
  back, and no destructive action is left irreversible.
- **SC-005**: Saving begins within 1.5 seconds ± 250 ms of the last change, and never before it.
- **SC-006**: The editor reports Saved zero times for work storage has not acknowledged.
- **SC-006a**: A reversal is saved like any other change — zero reversals leave the lesson stored in
  the state they reversed away from.
- **SC-007**: A session of pure navigation triggers zero saves and leaves the lesson byte-identical.
- **SC-008**: Work made during a connection interruption is present after connectivity returns in
  100% of interruption scenarios exercised, including one that spans a full browser refresh.
- **SC-009**: A save against a stale version replaces the stored newer version zero times, and the
  teacher is offered at least two ways forward every time.
- **SC-010**: A teacher can find and restore an earlier checkpoint in no more than three actions, and
  zero checkpoints made after the restored one are removed by doing so.
- **SC-010a**: An hour of continued editing produces at most five history entries, while every one of
  its saves remains acknowledged.
- **SC-010b**: Kept work is offered back to zero identities other than the one that made it, across
  every recovery scenario exercised.
- **SC-010c**: A persistently failing save produces exactly five automatic attempts, and the status
  never reads Saving once they are spent.
- **SC-010d**: Editing while offline meets the same input-to-feedback budget as editing online, on
  the 50-slide, 300-element lesson.
- **SC-011**: Every new surface passes automated accessibility checks and is fully operable from the
  keyboard alone.
- **SC-012**: The whole feature is exercisable, including conflict and recovery, with no host
  backend and no network.

## Assumptions

- **Persistence is the host's; policy is the framework's.** The host supplies a storage adapter, the
  lesson's identity, the version the lesson opened at, and — optionally — an opaque handle for who is
  editing. The framework decides when to save, what
  to say, what to keep, and what to do on a conflict. This is what the EN-6 boundary was designed
  for, and it is why the conflict case lives in the interface rather than in each host's endpoint.
- **Steps are grouped by what the change was, never by when it happened.** Every route into the
  reducer already corresponds to one completed action — a drag commits once on release, text commits
  once on blur, a sequence applies once — so the only actions that need grouping are the repeatable
  ones: arrow-key nudges and stepper controls. Grouping those by *sameness* rather than by elapsed
  time gives teachers the collapsing behaviour every drawing tool has trained them to expect while
  keeping history deterministic: the same sequence of actions always produces the same history,
  whatever speed it was performed at, and the undo suite never waits on a clock.
- **History does not outlive the open lesson.** Closing the editor discards it. Persisting undo
  history would put session state into storage, which Constitution V's "editor state that is not
  serialized MUST NOT influence playback" makes awkward and which nothing has asked for.
- **The retained depth is 50 steps.** Deep enough to cover a working session's regret, shallow
  enough to bound what the editor holds for a 300-element lesson.
- **"A local queue" is the newest pending state, not a log of individual changes.** The storage
  boundary saves whole manifests, so replaying a queue of edits would have nothing to replay them
  into. Keeping the newest state satisfies FR-DAT-004's intent — no work is lost — with the only
  shape the boundary can consume.
- **A deliberate overwrite is not offered on conflict.** The editor cannot show a teacher what the
  newer version contains that theirs does not, so an "overwrite anyway" button would be a choice
  made blind. Take-theirs and keep-mine-as-a-new-draft are both recoverable; overwriting is not.
- **The version the editor holds and the version the teacher browses are two different things.** The
  first exists to detect a conflict and must advance on every save; the second exists to be read by a
  person and must not. The existing boundary conflates them — `listVersions` returns every save — and
  separating them is what makes both FR-DAT-006 and FR-DAT-008 satisfiable at once. How long a host
  keeps checkpoints, and whether it prunes them, remains the host adapter's business.
- **The checkpoint interval is 15 minutes of continued editing.** Short enough that an afternoon's
  work has several points to return to, long enough that a full day produces a list a teacher can
  read. It is measured in editing, not in elapsed time, so an idle editor records nothing.
- **Recovery interrupts; a conflict does not.** The two look alike and are not. Recovery happens
  before there is a lesson on screen and the editor cannot render one until it knows which copy it is
  rendering, so asking first costs nothing. A conflict happens with an hour of the teacher's work
  already in front of them, and a dialogue that stands between them and it is the most reliable way
  to make that work disappear — the answer is to stop saving, not to stop working.
- **Five retries over about two minutes.** Long enough to ride out a router reboot or a backend
  restart with the teacher none the wiser, short enough that the editor never claims to be trying
  long after it stopped. An editor that retries forever is one whose status nobody reads.
- **Connectivity is inferred, not polled.** Save outcomes and the browser's own online signal decide
  the Offline state. Polling a backend to ask whether it is there costs requests to learn what the
  next save would have told us.
- **Real-time collaborative editing stays out of scope**, per spec §19. Conflicts are treated as the
  edge case they are, which is what makes refusing rather than merging the right answer.
- **The three existing confirmations are removed in this feature, not deprecated.** Each was written
  as a placeholder with a comment saying so; leaving them alongside undo produces a tool that both
  confirms and undoes every deletion.

## Dependencies

- **ED-1 (canvas) and the draft reducer.** `applyEdit` is pure, clones its input, and returns a whole
  validated manifest. That is what makes reversal possible without an inverse for each of the
  the reducer's change kinds, and feature 005's research already recorded it as "the natural thing for
  ED-5 to wrap".
- **EN-6 (storage adapter).** Exists, is unconsumed, and is this feature's first consumer. It needs
  an additive extension to satisfy FR-035a, FR-037, and FR-038: a save cannot declare itself a
  checkpoint, an entry cannot say when it was recorded or what it was named, and an earlier version's
  content cannot be fetched at all. Additive to an interface, not to the manifest, so no
  `schemaVersion` bump follows.
- **The shared status vocabulary is also PB-2's.** Wave 5's immutable publish reuses the same four
  words by Constitution III, so the status surface must not assume it is describing a draft save.
- **Removing the three confirmations touches feature 005's and 006's suites.** Those tests assert the
  prompts exist; they become assertions that the actions are reversible.
