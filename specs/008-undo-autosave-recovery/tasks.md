---

description: "Task list for feature 008 — Undo, Autosave, and Recovery (ED-5)"
---

# Tasks: Undo, Autosave, and Recovery

**Input**: Design documents from `/specs/008-undo-autosave-recovery/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required, and test-first. Constitution II is NON-NEGOTIABLE — "failing test, then
implementation, then refactor" — and every timing test drives an injected scheduler rather than
wall-clock time. Each implementation task below has its test task listed before it, and the test is
expected to fail when written.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1…US5, matching the spec's five user stories
- Every task names the exact file it touches

## Path conventions

Monorepo, four packages plus the example app:
`packages/{schema,core,react,studio}/src|test`, `examples/nextjs`, `tools/scripts`.

## Shared files

**Ten files are touched by more than one phase.** They fall into two kinds, and the distinction is
what keeps the phases genuinely parallel rather than nominally so.

### Single-owner — one task writes it; other phases fold their changes in

| File | Owner | Why |
|---|---|---|
| `packages/studio/src/session/useEditorSession.ts` | T030 (US1) | Only history changes it; restore is an `Edit` kind, not a session method (research R-12) |
| `packages/studio/src/draft/edit.ts` and `draft/reducer.ts` | T077b, T077c (US5) | The nineteenth kind; three suites enumerate `EDIT_KINDS` and are updated together in T078 |
| `packages/studio/src/persistence/useDraftPersistence.ts` | T052 (US2), extended in order by T063, T070, T079, T080 | The save loop grows one story at a time and must stay one loop |
| `packages/studio/src/history/runKey.ts` | T027 (US1) | T091 breaks it deliberately and restores it; that is not an edit |
| `packages/studio/test/history/every-kind.test.tsx` | T020 (US1) | T078 *verifies* its walk covers the nineteenth kind; it does not rewrite the file |

### Append-only — every phase adds a block, nobody edits another phase's

The convention is the point: **append at the end, never edit in place.** A stylesheet and a test file
that four or five phases all extend will conflict on every merge if anyone reformats or reorders.

| File | Phases that append | Shape of each block |
|---|---|---|
| `packages/studio/src/styles/editor.css` | T042 (US1), T054, T065, T072, T082 | One commented section per phase, at the end |
| `packages/studio/test/a11y/axe.test.tsx` | T042 (US1), T050, T066, T073, T083 | One `describe` per phase |
| `packages/studio/src/index.ts` | T042 (US1), T055, T065, T072, T082 | One export block per phase, in phase order |
| `packages/studio/test/keyboard/persistence.test.tsx` | T066 (US3) creates, T083 (US5) appends | One `describe` per surface |

### Sequential, not concurrent

Two more files are shared but never at the same time, because the second toucher is in the polish
phase and runs after every story: `examples/nextjs/app/edit/editor-view.tsx` (T056 wires the status,
T087 completes the wiring) and `packages/studio/README.md` (T043 documents undo, T088 the rest).

---

## Phase 1: Setup (Shared Test Infrastructure)

**Purpose**: The doubles every later phase drives. Nothing here ships.

**T002 and T004 do not typecheck until T011.** They are written against the storage boundary as
Phase 2 leaves it, deliberately: a double built against today's interface would compile now and break
the moment the boundary changes, which is a worse place to find out. Run Phase 2 first if a green
typecheck between phases matters to you.

- [X] T001 [P] Create a hand-advanced scheduler double with `advance(ms)`, a pending-timer count, and cancel support in `packages/studio/test/harness/scheduler.ts`
- [X] T002 [P] Create a recording `StorageAdapter` double in `packages/studio/test/harness/storage.ts` — records every `saveDraft` call with its token and options, can be told to answer `conflict`, `unavailable`, or `unauthorized`, and can hold an acknowledgement open so a test can assert the status stays Saving. **Write it against the extended interface** (`SaveOptions`, `VersionEntry`, `loadVersion`), so it will not typecheck until T011 lands — the alternative is a double that compiles today and stops compiling the moment the boundary changes
- [X] T003 [P] Create keeper doubles and identity helpers in `packages/studio/test/harness/keeper.ts` — a memory keeper, a spy that records writes and clears, and a helper that asserts nothing durable was written at all
- [X] T004 Extend the editor harness in `packages/studio/test/harness/editor.tsx` with persistence options (storage, scheduler, keeper, identity, lessonId, connectivity) and handles for the status text, the conflict notice, the recovery prompt, and the version list — depends on T001–T003
- [X] T005 [P] Add a 50-slide / 300-element lesson accessor for studio perf suites in `packages/studio/test/harness/large.ts`, reading the same fixture features 005 and 006 use from `tools/scripts/fixtures/`

---

## Phase 2: Foundational (The Boundary and the Ports)

**Purpose**: The storage-boundary extension and the two new ports.

**⚠️ Blocks US2, US3, US4, and US5.** It does **not** block US1 — undo needs no persistence at all,
so Phase 3 may run concurrently with this phase. That is deliberate: US1 is the MVP and should not
wait on a cross-package change.

**Rebuild after this phase.** `@cuestack/studio` resolves core and react through their package
entries, so a studio suite will not see these changes until `pnpm build` runs.

- [X] T006 [P] Write the failing contract test for checkpoint recording in `packages/core/test/adapters/checkpoints.test.ts` — every save advances the token; only a save carrying `checkpoint` adds an entry to `listVersions`; a label round-trips verbatim
- [X] T007 [P] Write the failing contract test for `loadVersion` in `packages/core/test/adapters/versions.test.ts` — returns the named version's content and the **current** draft's token, and answers `not_found` for an unknown token
- [X] T008 [P] Write the failing regression test in `packages/core/test/adapters/conflict.test.ts` proving the EN-6 conflict path is unchanged by the new optional parameter — a stale token is still refused and the stored manifest is still untouched
- [X] T009 [P] Declare the `Scheduler` port — `now()` and `after(ms, run)` returning a cancel — in `packages/core/src/ports/scheduler.ts`, with a header stating two things: it is deliberately not a member of `Ports`, and it is the first port here with no consumer inside core — which is a consequence of core being the contract package, so a second adapter's editor can reach it without importing from `@cuestack/react` (research R-03)
- [X] T010 [P] Declare the `Connectivity` port — `isOnline()` and `subscribe(listener)` — in `packages/core/src/ports/connectivity.ts`, mirroring `VisibilityPort`'s shape
- [X] T011 Extend the storage boundary in `packages/core/src/adapters/index.ts` per [contracts/storage-contract.md](./contracts/storage-contract.md): add `SaveOptions`, rename `VersionSummary` to `VersionEntry` with `recordedAt` and optional `label`, and add `loadVersion`
- [X] T012 Implement all three additions in the in-memory reference in `packages/core/src/adapters/memory/index.ts`, taking an injected `now` so `recordedAt` is deterministic — makes T006–T008 pass
- [X] T013 Export the new types and ports from `packages/core/src/index.ts` and `packages/core/src/ports/index.ts`
- [X] T014 [P] Write the failing test for the browser implementations in `packages/react/test/player/browserTiming.test.ts` — `after` fires once, the returned cancel prevents it, and `browserConnectivity` reports and notifies
- [X] T015 Implement `browserScheduler()` and `browserConnectivity()` in `packages/react/src/player/browserTiming.ts` — the only place in this feature that reads a browser global
- [X] T016 Export both from `packages/react/src/index.ts`

---

## Phase 3: User Story 1 — A teacher can take back anything they just did (P1) 🎯 MVP

**Goal**: Every change reversible and reapplicable in one action, and the three confirmations gone.

**Independent test**: Perform each edit kind the reducer accepts, undo each, and confirm the manifest is
byte-identical to what it was before. Redo and confirm it returns. Confirm no confirmation prompt
appears for any destructive action.

**Depends on**: Phase 1 only.

### Tests (write first, expect red)

- [X] T017 [P] [US1] Write `packages/studio/test/history/runKey.pure.test.ts` — the allow-list is exactly `transform-elements`, `set-timing`, `set-field`, `set-slide-field`; every other kind gets a key that cannot match itself; keys differ when target ids differ; **and keys differ when the written path differs**, so an element's width and its label are two runs rather than one
- [X] T018 [P] [US1] Write `packages/studio/test/history/stack.pure.test.ts` — push, collapse-instead-of-push, undo, redo, `future` cleared by any new change, depth capped at 50 with the oldest dropped
- [X] T019 [P] [US1] Write `packages/studio/test/history/shortcuts.pure.test.ts` — the chord table for undo and redo on both platform conventions, and `null` for everything else
- [X] T020 [US1] Write `packages/studio/test/history/every-kind.test.tsx` — walk every member of `EDIT_KINDS` (eighteen when this is written), apply one of each, undo, and assert the manifest is byte-identical (SC-001, SC-002). Drive the walk from `EDIT_KINDS` itself rather than a hand-written list, so the nineteenth kind T077b adds fails here until it is covered
- [X] T021 [US1] Write `packages/studio/test/history/runs.test.tsx` — ten arrow nudges are one step; a drag then a nudge of the same element is one; two drags separated by `endEditRun()` are two; a selection change between nudges splits them (FR-004a)
- [X] T022 [US1] Write `packages/studio/test/history/timeline-run.test.tsx` — drive a timeline drag the way `Track.tsx` emits it, one `set-timing` per `pointermove`, and assert the whole drag is one reversal step
- [X] T023 [US1] Write `packages/studio/test/history/visible.test.tsx` — undoing an edit made on another slide navigates there (FR-008); undoing a delete leaves the returned elements selected; undoing an add restores the prior selection (FR-009)
- [X] T024 [US1] Write `packages/studio/test/history/read-only.test.tsx` — undo and redo are refused in read-only with the same refusal every change receives, and nothing is recorded (FR-011)
- [X] T025 [US1] Write `packages/studio/test/history/inert.test.tsx` — a session of pure navigation records no steps and leaves undo unavailable (FR-007); a refused edit records nothing
- [X] T026 [US1] Write `packages/studio/test/keyboard/history.test.tsx` — undo and redo work with focus in the canvas, the inspector, and the timeline; a keystroke inside a text field is left to the platform; each reversal announces what it reversed (FR-010)

### Implementation

- [X] T027 [P] [US1] Implement the run-key derivation in `packages/studio/src/history/runKey.ts` — kind, sorted target ids, and the written path for `set-field` and `set-slide-field`, over the four-kind allow-list. The path is load-bearing: `set-field` addresses an element rather than a field, and `inspector/Field.tsx` commits on every `onChange` (research R-04)
- [X] T028 [P] [US1] Implement the pure stack in `packages/studio/src/history/stack.ts` — push, collapse, undo, redo, depth bound, run-open flag
- [X] T029 [P] [US1] Implement `historyIntentFor` in `packages/studio/src/history/shortcuts.ts`, leaving `canvas/shortcuts.ts` untouched
- [X] T030 [US1] Wire history into `packages/studio/src/session/useEditorSession.ts` — `apply` records a step, and the hook gains `undo`, `redo`, `canUndo`, `canRedo`, and `endEditRun`; `select`, `goToSlide`, and the text commit close the run
- [X] T031 [US1] Call `endEditRun()` at the end of a pointer gesture in `packages/studio/src/canvas/Overlay.tsx`
- [X] T032 [US1] Call `endEditRun()` on pointer-up and on blur in `packages/studio/src/timeline/Track.tsx`
- [X] T032a [US1] End the run when an inspector field loses focus, so leaving a field and returning to it is two reversal steps rather than one. `FieldProps` is `{ field, source, disabled, onCommit }` and holds no session, so add an optional `onEndRun` prop to `packages/studio/src/inspector/Field.tsx` and pass `session.endEditRun` down from `packages/studio/src/inspector/Inspector.tsx`, which does hold it; add the case to `packages/studio/test/history/runs.test.tsx`
- [X] T032b [US1] Read how `packages/studio/src/effects/EffectFields.tsx` commits a parameter — per interaction or per committed value — and either add `set-effect` to the allow-list keyed by element **and** effect id, or record in `contracts/history-contract.md` §3 why it does not belong there
- [X] T033 [US1] Implement `useHistoryShortcuts({ session, target })` in `packages/studio/src/useHistoryShortcuts.ts`, ignoring events whose target is an input, textarea, or contenteditable
- [X] T034 [US1] Announce reversals through the existing announcer in `packages/studio/src/canvas/Announcer.ts` — add `describeReversal`, naming what came back or went away

### Removing the three confirmations (FR-012, SC-004)

- [X] T035 [US1] Rewrite `packages/studio/test/canvas/delete.test.tsx` — deletion happens at once with no prompt, and one undo returns the elements selected
- [X] T036 [US1] Rewrite `packages/studio/test/sequence/custom.test.tsx` — applying a relationship to a Custom event happens at once, and one undo restores the authored timing
- [X] T037 [US1] Rewrite `packages/studio/test/keyboard/actions.test.tsx` and `packages/studio/test/keyboard/focus.test.tsx` — the focus behaviour they asserted about the prompt becomes focus behaviour about the reversal
- [X] T038 [US1] Rewrite the confirmation cases in `packages/studio/test/effects/registry-sourced.test.tsx` — removing an effect happens at once and one undo restores it with its parameters
- [X] T039 [US1] Delete `packages/studio/src/canvas/DeleteConfirmation.tsx` and apply the delete directly in `packages/studio/src/canvas/Overlay.tsx`
- [X] T040 [US1] Delete `packages/studio/src/sequence/CustomConfirmation.tsx` and apply the relationship directly in `packages/studio/src/sequence/SequenceView.tsx`
- [X] T041 [US1] Remove the inline confirmation state and markup from `packages/studio/src/effects/EffectControls.tsx`
- [X] T042 [US1] Remove `.cs-effect-confirm` and `.cs-sequence-confirm` and the delete-prompt rules from `packages/studio/src/styles/editor.css`; update `packages/studio/test/a11y/axe.test.tsx`; update the export map in `packages/studio/src/index.ts` — the two deleted components out, the history module in
- [X] T043 [US1] Document undo, redo, and `endEditRun`'s obligation on surfaces in `packages/studio/README.md`

**Checkpoint**: undo is complete and shippable on its own. The editor is safer than it was with three prompts, and nothing about saving exists yet.

---

## Phase 4: User Story 2 — The lesson saves itself, and says so honestly (P2)

**Goal**: Autosave after ~1.5 s idle, with a four-word status that never claims more than is true.

**Independent test**: With the in-memory storage, make a change, advance the scheduler past the
interval, confirm the save happened and the status moved Saving → Saved. Hold the acknowledgement
and confirm the status stays Saving. Make the storage fail and confirm Save Failed says what to do.

**Depends on**: Phase 2. Independent of US1 except T045a, which reverses a change and therefore needs it.

- [X] T044 [P] [US2] Write `packages/studio/test/persistence/schedule.pure.test.ts` — the idle interval, the backoff sequence across five attempts, and the four checkpoint triggers, all as a table
- [X] T045 [US2] Write `packages/studio/test/persistence/save.test.tsx` — a save begins 1.5 s after the last change and not before; a change arriving first restarts the interval rather than queueing a second save (FR-014, FR-015)
- [X] T045a [US2] Write `packages/studio/test/persistence/reversal-saves.test.tsx` — undo, advance the scheduler past the interval, and confirm a save occurs carrying the reverted manifest; the same for redo. A reversal is a change for saving purposes and is never an unsave — no acknowledged version is removed (FR-013, SC-006a). Depends on US1
- [X] T046 [US2] Write `packages/studio/test/persistence/saved.test.tsx` — with the acknowledgement held open the status stays Saving and never Saved; on acknowledgement the returned token is held (FR-017)
- [X] T047 [US2] Write `packages/studio/test/persistence/no-save.test.tsx` — pure navigation and refused edits trigger zero saves, and the manifest is byte-identical to what was loaded (FR-018, FR-019, SC-007). Include **opening**: mount, advance the scheduler well past the interval with no change at all, and assert zero saves. The hook observes the draft's identity and mount effects fire once with the initial value, so a spurious save on open is the easy silent bug — and under FR-035a it would mint a checkpoint nobody asked for
- [X] T048 [US2] Write `packages/studio/test/persistence/retry.test.tsx` — unavailable, unauthorized, and conflict produce three distinct messages naming the lesson and an action; exactly five automatic attempts occur; the status never reads Saving once they are spent; a further change restarts them (FR-021, FR-022, FR-022a, SC-010c)
- [X] T049 [US2] Write `packages/studio/test/persistence/concurrent.test.tsx` — editing is never blocked during an in-flight save, the newer state saves after it settles, and an explicit save-now starts immediately (FR-020, FR-023)
- [X] T049a [US2] Write `packages/studio/test/persistence/status.test.tsx` — the component renders **exactly one** of Saving, Saved, Offline, Save Failed at a time, never two and **never none**: `pending` and `saving` both read Saving, `idle` and `saved` both read Saved, so a freshly opened lesson reads Saved rather than blank. And it accepts a status that is not a draft save, so PB-2 can render a publish state through it without a second component or a fifth word (FR-016, Constitution III)
- [X] T050 [US2] Add `SaveStatus` cases to `packages/studio/test/a11y/axe.test.tsx` — accessible name, live announcement on change, and no state conveyed by colour alone
- [X] T051 [P] [US2] Implement the pure policy in `packages/studio/src/persistence/schedule.ts` — idle interval, backoff, attempt limit, and the checkpoint decision
- [X] T052 [US2] Implement `useDraftPersistence` in `packages/studio/src/persistence/useDraftPersistence.ts` — observes the draft's identity as the eligible-change signal, drives the scheduler, holds the token, and produces the `SaveState`
- [X] T053 [US2] Implement `packages/studio/src/persistence/SaveStatus.tsx` — one component, the four words, its prop a status rather than a draft so PB-2 can render a publish state through it
- [X] T054 [US2] Add status rules to `packages/studio/src/styles/editor.css`, resolving every value from theme tokens
- [X] T055 [US2] Export the hook, the component, and their types from `packages/studio/src/index.ts`
- [X] T056 [US2] Wire storage and the status into `examples/nextjs/app/edit/editor-view.tsx`

**Checkpoint**: work saves itself and says so. Nothing survives an interruption yet.

---

## Phase 5: User Story 3 — A dropped connection does not cost work (P3)

**Goal**: Keep the newest state locally, resend on reconnect, survive a refresh, and offer recovery
only to the person who made it.

**Independent test**: Make changes with storage unreachable and confirm Offline and that the work is
kept; restore reachability and confirm it saves with no teacher action. Separately, unmount the
editor entirely mid-interruption, remount, and confirm the kept work is offered before the lesson
opens.

**Depends on**: Phase 2 and US2.

- [X] T057 [P] [US3] Write `packages/studio/test/persistence/keeper.test.ts` — the browser keeper round-trips and clears; the memory keeper does the same without touching `localStorage`; the key includes both identity and lesson id; **`write` reports failure rather than swallowing it** when the store throws (quota) or is unavailable to the page (FR-024c)
- [X] T057a [US3] Write `packages/studio/test/persistence/migrate-on-load.test.tsx` — a manifest returned by `loadDraft` under an earlier format is brought to the current one before it becomes the draft; one that cannot be brought forward is reported naming the lesson and is **not** loaded; a current-format manifest passes through unchanged (FR-050)
- [X] T058 [US3] Write `packages/studio/test/persistence/offline.test.tsx` — an unavailable save reports Offline and keeps the newest state; the connectivity signal triggers an immediate resend rather than waiting out the backoff (FR-024, FR-025). Assert the **write schedule**: twenty changes inside one interval produce **one** keeper write, not twenty (FR-024a); changes outstanding when the page is hidden or unloaded are written before it goes (FR-024b); and a keeper that refuses tells the teacher their work is not being kept (FR-024c)
- [X] T059 [US3] Write `packages/studio/test/persistence/recovery.test.tsx` — unmount the editor between the interruption and the reopen; the kept work is offered, the lesson does not open until the teacher chooses, restoring opens with it unsaved, and discarding removes the local copy (FR-026, FR-027, FR-027a)
- [X] T059a [US3] Write `packages/studio/test/persistence/recovery-conflict.test.tsx` — the US3∩US4 intersection. Kept work exists **and** the stored lesson has moved on since it was kept: the offer appears and says the lesson has changed (FR-027b), restoring proceeds, and the first save afterwards is refused and raises the ordinary conflict notice. Assert that no third path was invented — the same prompt and the same notice as everywhere else (research R-15)
- [X] T060 [US3] Write `packages/studio/test/persistence/identity.test.tsx` — work kept by one identity is not offered to another; with no identity **nothing durable is written at all** and the in-session resend still works; the identity never appears in the manifest, in a save payload, or in an analytics event (FR-029, FR-029a, FR-029b, SC-010b)
- [X] T061 [US3] Write `packages/studio/test/persistence/cleared.test.tsx` — the local copy is cleared on acknowledgement so a later reopen offers nothing, and two lessons kept offline are offered only their own work (FR-028, FR-029)
- [X] T062 [US3] Implement `packages/studio/src/persistence/keeper.ts` — the `DraftKeeper` port, `browserKeeper()`, `memoryKeeper()`, and the key builder; the absence of an identity selects the memory keeper. `write` returns a result rather than `void`, because a whole-manifest write can exceed quota and the page can be denied storage outright (FR-024c)
- [X] T062a [US3] Implement the load boundary in `packages/studio/src/persistence/migrateOnLoad.ts` — pass every manifest from `loadDraft` and `loadVersion` through `migrate()` from `@cuestack/schema/migrate` before anything else sees it, returning either the brought-forward manifest or a reportable reason. `migrate()` has had no consumer anywhere in the repository until now (research R-14); the restore flow in T080 uses this same helper
- [X] T063a [US3] Implement the hide/unload flush in `packages/studio/src/persistence/flush.ts` — take the **existing** `VisibilityPort` for the hidden signal, through the seam the studio already uses for this exact job: `packages/studio/src/session/usePlayback.ts` declares `readonly ports?: Pick<Ports, 'time' | 'visibility'>` and falls back to `browserPorts()`. Do the same rather than inventing a second convention — `@cuestack/react` exports no per-member visibility factory, only the whole `browserPorts`. A test then flips a fake instead of dispatching a DOM event. Keep a raw `pagehide` listener beside it for what the port does not model; both pass the studio's lint rules, so the port is chosen for determinism rather than necessity (research R-08)
- [X] T063 [US3] Extend `packages/studio/src/persistence/useDraftPersistence.ts` — write kept work **on the save schedule, never per change** (FR-024a), flush through T063a when the page is hidden or unloaded with changes outstanding (FR-024b), surface a keeper refusal to the teacher (FR-024c), clear it on acknowledgement, subscribe to connectivity, and resume on the signal
- [X] T064 [US3] Implement `packages/studio/src/persistence/RecoveryPrompt.tsx` as a modal `<dialog>` answered before the lesson opens, following the focus-capture pattern feature 007 established in `preview/Preview.tsx`. It appears whenever kept work **exists** — existence is the signal, since kept work is cleared on acknowledgement (FR-027) — and says so plainly when the stored lesson has moved on since (FR-027b)
- [X] T065 [US3] Add recovery styles to `packages/studio/src/styles/editor.css` and export the prompt, the keeper, and their types from `packages/studio/src/index.ts`
- [X] T066 [US3] Add recovery cases to `packages/studio/test/a11y/axe.test.tsx` and a keyboard pass to `packages/studio/test/keyboard/persistence.test.tsx` — focus starts inside the prompt and returns sensibly

**Checkpoint**: an interruption, and a refresh through one, cost nothing.

---

## Phase 6: User Story 4 — A newer version is never silently replaced (P4)

**Goal**: A conflict refuses, stops autosaving, keeps the teacher's work, and does not block them.

**Independent test**: Save a draft, mutate the stored lesson behind the editor's back, make a change,
and confirm the save was refused, the stored version untouched, autosave stopped, and two ways
forward offered.

**Depends on**: Phase 2 and US2. US3 makes T071's "kept until answered" assertion stronger but is not required.

- [X] T067 [US4] Write `packages/studio/test/persistence/conflict.test.tsx` — the save is refused, the stored manifest is byte-identical to what the other writer left, and no further save is attempted (FR-030, FR-031, FR-032)
- [X] T068 [US4] Write `packages/studio/test/persistence/conflict-nonblocking.test.tsx` — with the notice showing, an edit still applies, the notice survives a slide change and a selection change, and it cannot be dismissed into silence (FR-032a). Include save-now: while the conflict is unanswered it attempts **no** save and puts the conflict and its choices back in front of the teacher (FR-020)
- [X] T069 [US4] Write `packages/studio/test/persistence/conflict-choices.test.tsx` — taking the stored version preserves the teacher's work somewhere reachable first; keeping their own saves it as a new draft; an unanswered conflict at close keeps the work for the next open (FR-033, FR-034)
- [X] T070 [US4] Extend `packages/studio/src/persistence/useDraftPersistence.ts` with the conflict state — stop the scheduler, retain kept work, and expose the two resolutions
- [X] T071 [US4] Implement `packages/studio/src/persistence/ConflictNotice.tsx` — persistent, non-blocking, naming the lesson, stating the problem and both actions per NFR-USA-004
- [X] T072 [US4] Add conflict styles to `packages/studio/src/styles/editor.css` and export the notice and its types from `packages/studio/src/index.ts`
- [X] T073 [US4] Add conflict cases to `packages/studio/test/a11y/axe.test.tsx` — announced when it appears, operable from the keyboard, and never a focus trap

**Checkpoint**: two people cannot lose each other's work.

---

## Phase 7: User Story 5 — An earlier draft can be brought back (P5)

**Goal**: A readable history of checkpoints, and a restore that adds rather than erases.

**Independent test**: Edit through many autosaves, confirm the history holds checkpoints rather than
one entry per save, restore an earlier one, and confirm the editor holds that content, a new version
exists, and every later checkpoint is still listed.

**Depends on**: Phase 2 and US2. T077a–T077c and T080 need US1's history for FR-041's "reversible by one undo", and T078 updates suites US1 also touches.

- [X] T074 [US5] Write `packages/studio/test/persistence/checkpoints.test.tsx` — drive an hour of continued editing through the scheduler; the save count is dozens and the entry count is at most five; an idle hour records nothing (FR-035a, SC-010a)
- [X] T074a [US5] Write `packages/studio/test/persistence/between-checkpoints.test.tsx` — after an ordinary autosave that is not a checkpoint, `loadDraft` returns the new content and `listVersions` has gained no entry (FR-035c). This is the case an adapter can fail while passing every history test, and it costs an hour of work when it does
- [X] T075 [US5] Write `packages/studio/test/persistence/named.test.tsx` — a teacher-requested checkpoint appears in the history under its name (FR-035b)
- [X] T076 [US5] Write `packages/studio/test/persistence/restore.test.tsx` — the ordering from [storage-contract.md §5](./contracts/storage-contract.md): a checkpoint of the state being left, the restore, a checkpoint of the result; no earlier entry removed; the restore reversible by one undo; no published version altered (FR-039…FR-042, FR-044). Include the **refused** path: a version the current format rejects and cannot bring forward leaves the draft untouched, leaves the first checkpoint standing, and writes no second one. And the **unreachable** path (FR-042a): storage reachable when the history was listed and gone by the time the teacher chooses — the pre-restore checkpoint fails, so the restore does not proceed, the unsaved work is untouched, and the teacher is told why
- [X] T077 [US5] Write `packages/studio/test/persistence/history.test.tsx` — the version-history surface's own suite: checkpoints listed newest first, each identified by when it was recorded and by its name where it has one (FR-036, FR-037), and with storage unreachable the history says so rather than presenting as empty (FR-043). Named for the surface rather than for one failure case, because T081a and [quickstart §8](./quickstart.md) both extend and run it
- [X] T077a [US5] Write the failing test for the nineteenth edit kind in `packages/studio/test/draft/replace-draft.pure.test.ts` — `replace-draft` is refused in read-only with the standard refusal, is refused when the incoming manifest would not validate (leaving the draft untouched), and otherwise replaces the draft wholesale
- [X] T077b [US5] Add `'replace-draft'` to `EDIT_KINDS` and the `Edit` union in `packages/studio/src/draft/edit.ts`, carrying the incoming `LessonManifest`
- [X] T077c [US5] Implement `replace-draft` in `packages/studio/src/draft/reducer.ts` as a branch in **`applyEdit` itself**, placed after the blanket read-only refusal and before `clone(draft)` and the slide lookup: clone the incoming manifest, run the same `validate()` the frame already runs, return the same shape. It cannot be a case in `dispatch` — the frame binds `const next = clone(draft)` and `dispatch` mutates in place, so there is nothing to rebind, and the slide lookup would refuse a stale `ctx.slideId` on an edit about to discard that slide (research R-12)
- [X] T078 [US5] Update the three suites that enumerate `EDIT_KINDS` for the nineteenth member — `packages/studio/test/draft/read-only.test.ts` (which asserts every variant is refused), `packages/studio/test/draft/validity-sweep.test.ts`, and `packages/studio/test/session/clipboard.test.ts` — and confirm T020's walk in `packages/studio/test/history/every-kind.test.tsx` now covers it. In the sweep, `replace-draft`'s sample MUST carry a **valid** manifest from the corpus: the file is a seeded random walk asserting that no edit yields an invalid manifest, so an invalid sample would make it assert the opposite of its own header. The refusal case belongs in T077a, where a refusal is the expected result
- [X] T079 [US5] Extend `packages/studio/src/persistence/useDraftPersistence.ts` with the checkpoint decision and an explicit `checkpoint(label?)` for FR-035b
- [X] T080 [US5] Implement the restore flow in `packages/studio/src/persistence/useDraftPersistence.ts` — `loadVersion`, bring the manifest forward through T062a's helper, checkpoint the state being left, `session.apply({ kind: 'replace-draft', manifest })`, checkpoint the result; a refused `apply` leaves the draft untouched and the first checkpoint standing. The migration step is not optional here: `applyEdit` validates against the current schema, so an unmigrated old version would be refused and the refusal would read as corruption (FR-050)
- [X] T081a [US5] Add a read-only case to `packages/studio/test/persistence/history.test.tsx`, the suite T077 creates — the version history remains viewable and restore is **not offered**; the `replace-draft` refusal is the backstop, not the interface (FR-039b). It belongs in the persistence suite rather than in US1's undo read-only file: `VersionHistory` is a persistence surface, and filing it under `test/history/` would put a US5 case in a US1-owned file for no reason
- [X] T081 [US5] Implement `packages/studio/src/persistence/VersionHistory.tsx` — checkpoints newest first, each showing when it was recorded and its name where it has one, listing without loading any version's content. Format `recordedAt` with `Intl.DateTimeFormat().format(ms)`, which takes a timestamp directly: `new Date(ms)` inside `packages/studio/src` **fails `no-clock-in-studio`**, and relative times are unavailable because they would need a second clock (research R-13). In read-only, list the checkpoints and offer no restore (FR-039b)
- [X] T082 [US5] Add history styles to `packages/studio/src/styles/editor.css` and export the component and its types from `packages/studio/src/index.ts`
- [X] T083 [US5] Add version-history cases to `packages/studio/test/a11y/axe.test.tsx` and to `packages/studio/test/keyboard/persistence.test.tsx` — the whole list navigable and a restore reachable from the keyboard alone

**Checkpoint**: all five stories delivered.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T084 Write `packages/studio/test/persistence/inert.test.tsx` — run a full cycle (edit, autosave, conflict, recover, undo, restore) and compare the manifest against one produced by the same edits with no persistence at all; they must be byte-identical (FR-045, Constitution V)
- [X] T085 Write `packages/studio/test/perf/history.test.tsx` — three measurements against the 50-slide / 300-element fixture with a full 50-step history behind it: a reversal within 100 ms; `apply` still within the same budget it met before this feature, so FR-047's second half is measured rather than asserted; and **`apply` while offline** within that same budget, which is where the keeper's whole-manifest write would show up if it ever moved back onto the change path (SC-003, SC-010d, NFR-PERF-002)
- [X] T086 Add a repository check to `tools/scripts/check-gates.test.ts` asserting no confirmation surface remains for an action one reversal can take back — the grep from [quickstart.md §9](./quickstart.md) armed as a test rather than left as a habit (SC-004)
- [X] T087 Complete the example wiring in `examples/nextjs/app/edit/editor-view.tsx` — undo and redo controls, `useHistoryShortcuts` at the editor root, the status, the recovery prompt, the conflict notice, and the version history, all over the in-memory adapters
- [X] T088 [P] Update `packages/core/README.md` with the boundary's three additions and `packages/studio/README.md` with the persistence hook, its ports, and the identity rule
- [X] T089 [P] Update `docs/cuestack_framework_plan.md` — ED-5 to ✅, wave 4 closed, the "deletion is confirmed, not undoable" obligation discharged, and one obligation added: `set-timing` is emitted per `pointermove`, which collapsing hides from history but not from the CPU (research R-04)
- [X] T090 Run `pnpm typecheck && pnpm lint && pnpm test && pnpm gates && pnpm check:rules` and confirm every gate is green; verify by inspection that the `no-clock-in-studio` block in `tools/eslint-config/index.js` still carries no `ignores`, and that `tools/scripts/check-rule-coverage.mjs` reports an unchanged count
- [X] T091 Verify the negative controls by deliberate breakage, restoring each afterwards: remove `'set-timing'` from the allow-list in `packages/studio/src/history/runKey.ts` (T022 must fail), drop the path from the run key in the same file (T017 must fail), record an entry per save in `packages/core/src/adapters/memory/index.ts` (T074 must fail), make a non-checkpoint save a no-op in the same file (T074a must fail), return the loaded version's token from `loadVersion` (T076 must fail), and move the keeper write from the save schedule back onto the change path in `packages/studio/src/persistence/useDraftPersistence.ts` (T058's write-count assertion must fail — every functional test still passes, which is the whole reason this control exists)
- [ ] T092 Perform the manual keyboard and screen-reader pass from [quickstart.md §13](./quickstart.md) — eight steps, with a screen reader running — and record the result in the pull request

---

## Dependencies

```text
Phase 1 (Setup)
   ├─────────────────────────────► Phase 3 (US1 — undo)          ── shippable alone
   └──► Phase 2 (Foundational)
           ├──► Phase 4 (US2 — autosave)
           │        ├──► Phase 5 (US3 — offline & recovery)
           │        ├──► Phase 6 (US4 — conflict)
           │        └──► Phase 7 (US5 — version history)
           │                 └── T077a–T077c, T078, T080 need US1
           │        └── T045a needs US1
           └──────────────────────► Phase 8 (Polish)
```

**US1 does not depend on Phase 2.** Undo needs no storage, no scheduler, and no keeper, which is
what makes it the MVP and what lets it proceed while the cross-package boundary work happens.

**US3, US4, and US5 are independent of one another.** Each extends `useDraftPersistence`, which is
why that file has a single owner (T052) and each later phase extends rather than rewrites it.

## Parallel opportunities

**Phase 1** — T001, T002, T003, and T005 are four separate files with no shared state; only T004
waits.

**Phase 2** — the three core contract tests (T006, T007, T008) and the two port declarations (T009,
T010) are five files that can be written at once; T011 and T012 then serialise because both touch
the adapters.

**Phase 3** — the three pure tests (T017, T018, T019) and then the three pure implementations (T027,
T028, T029) are two clean fan-outs of three. The ten test tasks T020–T026 are separate files and can
be written concurrently once the harness exists.

**Across phases** — one developer can take Phase 3 end to end while another takes Phase 2 then Phase
4. They meet earlier than that, and it is worth knowing where. Not at T087 — at the four append-only
   files above, three of which (`editor.css`, `axe.test.tsx`, `index.ts`) both developers touch in
   their first phase. The append-only convention is what makes those meetings cheap; without it this
   plan's parallelism is nominal.

**Within Phases 5, 6, and 7** — the test tasks in each are separate files and parallel; the
implementation tasks that touch `useDraftPersistence` are not.

## Implementation strategy

**MVP is Phase 1 + Phase 3.** Twenty-nine tasks and no cross-package change. It discharges the debt
three shipped surfaces are standing in for, removes three prompts, and makes the editor safer than
it is today — with no backend, no ports, and no new storage semantics. If the feature had to stop
somewhere, this is the place.

**Then Phase 2 + Phase 4**, which is the promise a teacher stakes an hour of work on and the point
at which `StorageAdapter` finally has a consumer.

**Then 5, 6, and 7 in any order.** Each is a distinct failure a teacher can meet, and each is
worth shipping alone: the dropped connection, the colleague who saved first, and yesterday's version.

**Test-first throughout, and the tests are expected to fail when written.** Every timing task drives
the scheduler double from T001; not one of them waits on real time, which is Constitution II's
requirement and also the reason this suite will still be trusted in a year.

**T091 is not optional.** Six of this feature's guarantees are the kind that pass by accident — a
history that collapses everything, a run key that cannot tell two fields apart, an adapter that
records everything, an adapter that saves nothing between checkpoints, a restore that looks right
until the next save conflicts, and a keeper that writes on every keystroke while every functional
test stays green. Breaking each on purpose is how we learn the tests would catch
a regression rather than hoping so. Two of the five were found by analysis rather than by writing
code, which is the argument for the pass.
