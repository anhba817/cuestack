# Data Model: Undo, Autosave, and Recovery

**Nothing in this document is authored data.** Not one field here is serialized into a
`LessonManifest`, reaches a learner, or influences playback. That is FR-045 and Constitution V, and
it is also the line SC-007 measures: a session of pure navigation — and now a session of saving,
undoing, and restoring — must leave the manifest byte-identical to what was loaded.

The one thing this feature *does* write to the manifest is the manifest itself, unchanged, through
`StorageAdapter.saveDraft`. Everything below exists to decide when that happens and what to say
about it.

---

## 1. The line, restated

| Kind | Lives where | Serialized | Survives a refresh |
|---|---|---|---|
| `LessonManifest` | `session.draft` | yes, by the host's storage | via storage, or via kept work |
| History | `useEditorSession` | never | never (R-01, FR-012) |
| Save state | `useDraftPersistence` | never | never — recomputed on open |
| Kept work | the keeper | never *as lesson data* | yes, when an identity is supplied |
| Author identity | the host | never | not this feature's business |
| Version entries | the host's storage | not into the manifest | yes |

Feature 005's data model drew the first two rows and this one extends the same table rather than
starting a second.

---

## 2. `HistoryStep`

One completed authoring action, and what is needed to undo it visibly.

| Field | Type | Required | Notes |
|---|---|---|---|
| `before` | `LessonManifest` | yes | A reference to the draft as it stood, not a copy (R-02) |
| `runKey` | `string` | yes | Kind + sorted target ids + the written path for field kinds; a value that cannot match for non-collapsible kinds (R-04) |
| `slideId` | `string` | yes | The slide the change was made on. Undo navigates here (FR-008) |
| `selectionBefore` | `readonly string[]` | yes | The fallback selection when a reversal restores nothing |

**Invariants.**

1. `before` is never mutated. Guaranteed by `applyEdit`, which clones its input and returns a new
   manifest; nothing in the studio writes to `session.draft`.
2. A step is pushed only when `apply` succeeds. A refusal changes nothing, so there is nothing to
   reverse (FR-019 gets the same property for free).
3. `slideId` is the slide the *edit context* named, which is `session.slideId` at the time — not
   the slide the element happens to be on, because an edit only ever addresses one slide.

## 3. `HistoryStack`

| Field | Type | Notes |
|---|---|---|
| `past` | `readonly HistoryStep[]` | Oldest first; the top is the next reversal |
| `future` | `readonly HistoryStep[]` | Filled by undo, emptied by any new change (FR-003) |
| `runOpen` | `boolean` | False after `endEditRun`, a selection change, a slide change, or a text commit |

**Depth.** `past` is capped at 50 (FR-005). The oldest step is dropped, and dropping it is silent —
undo simply becomes unavailable at the bottom, which is the state the control already renders for
"nothing to undo".

**State transitions.**

```text
apply(ok)          past ← push(step) unless collapsing;  future ← []
apply(collapsing)  past unchanged;                       future ← []
undo               past ← pop → future;                  runOpen ← false
redo               future ← pop → past;                  runOpen ← false
select / goToSlide / endEditRun / text commit            runOpen ← false
```

**Collapsing** is the absence of a push, not a merge of two steps. The existing top step's `before`
is already the state the whole run started from, which is why the rule needs no arithmetic and
cannot drift.

## 4. `SaveState`

The one vocabulary, shared with publishing (Constitution III, FR-016). Exactly one at a time.

| State | Shown as | Meaning |
|---|---|---|
| `idle` | Saved | Nothing is outstanding — the lesson matches what storage holds |
| `pending` | Saving | A change is waiting out the idle interval |
| `saving` | Saving | A save is in flight |
| `saved` | Saved | Storage acknowledged it (FR-017) |
| `offline` | Offline | The last attempt failed as unavailable; work is kept |
| `failed` | Save Failed | Unauthorized, or the automatic attempts are spent |
| `conflict` | Save Failed | Storage holds a newer version; autosave is stopped (FR-032) |

`pending` and `saving` both read **Saving** on purpose, and `idle` and `saved` both read **Saved**:
the differences matter to the code and not to a teacher, and inventing a fifth word would break the
vocabulary Constitution III fixes at four.

**There is no blank.** An earlier draft of this table rendered `idle` as nothing, which would have
made FR-016's "exactly one of" false on open and again after every acknowledgement. Saved is not a
convenient placeholder there — it is true: a lesson just loaded from storage matches what storage
holds, which is the same claim as a lesson just written to it.

**Transitions.**

```text
idle      --change-->                pending
pending   --interval elapsed-->      saving
saving    --ok-->                    saved        (token ← returned)
saving    --unavailable-->           offline      (kept work written)
saving    --unauthorized-->          failed
saving    --conflict-->              conflict     (kept work retained; autosave stops)
saved     --change-->                pending
offline   --change-->                offline      (kept work rewritten)
offline   --online signal / backoff--> saving
failed    --change / manual retry--> pending      (attempts reset, FR-022a)
conflict  --change-->                conflict     (kept work rewritten; no save attempted)
conflict  --teacher chooses-->       pending | idle
```

**Attempt counter.** Held beside the state, reset on any acknowledgement and on any new change.
Five attempts, backing off across roughly two minutes (FR-022). Once spent, the state is `failed`
and never `saving` — which is what SC-010c asserts.

## 5. `KeptWork`

| Field | Type | Notes |
|---|---|---|
| `lessonId` | `string` | Part of the key |
| `manifest` | `LessonManifest` | The newest state storage has not acknowledged |
| `token` | `VersionToken` | The version it was built from, so the resend carries the right one |

**Key.** `cuestack:draft:{identity}:{lessonId}`. With no identity, a memory keeper is selected and
nothing durable is written at all (R-08) — so FR-029a's two halves are one decision.

**Lifecycle.** Written **on the same schedule a save is attempted on** — never on every change
(FR-024a) — plus once more when the page is being hidden or unloaded with changes outstanding
(FR-024b). **Cleared on acknowledgement** (FR-028), so a later refresh cannot offer work that is
already saved. Never cleared by a conflict the teacher has not answered (FR-034).

**Why the schedule and not the change.** `localStorage` is synchronous and this is a whole-lesson
write; `inspector/Field.tsx` commits on every `onChange`, so writing per change would put a
300-element manifest's serialization between a key press and the character appearing. Constitution
IV makes that budget an acceptance criterion rather than an aspiration. The unload flush is what
keeps the interval from being a window in which a refresh loses the newest edits.

**Existence is the recovery signal.** Kept work is cleared on acknowledgement, so work that is still
there is by definition work storage has not got — there is no timestamp to compare and none is
needed (FR-027). Whether the *stored* lesson has moved on is a separate question, answered by
comparing the kept `token` with the one `loadDraft` returns, and it changes what the offer says
rather than whether it appears (FR-027b).

## 6. `VersionEntry` — at the storage boundary

Replaces `VersionSummary`. See [contracts/storage-contract.md](./contracts/storage-contract.md).

| Field | Type | Required | Notes |
|---|---|---|---|
| `token` | `VersionToken` | yes | Opaque; what `loadVersion` takes |
| `versionNumber` | `number` | yes | Position in the history, unchanged from EN-6 |
| `recordedAt` | `number` | yes | Epoch milliseconds, stamped by the **host**, never by the framework |
| `label` | `string` | no | Present only when the teacher named the checkpoint |

`recordedAt` is the host's because the host's storage is the only participant with an authoritative
clock, and because the studio is forbidden from reading one at all (R-03).

`listVersions` returns **checkpoints**, not saves. That is the change the clarification requires and
the reason an entry can carry a label at all.

## 7. Ports added

| Port | Declared in | Browser implementation | Test double |
|---|---|---|---|
| `Scheduler` | `@cuestack/core` `ports/scheduler.ts` | `browserScheduler()` in `@cuestack/react` `player/browserTiming.ts` | a hand-advanced queue |
| `Connectivity` | `@cuestack/core` `ports/connectivity.ts` | `browserConnectivity()` in the same module | a settable flag with subscribers |
| `VisibilityPort` | already in `@cuestack/core` `ports/visibility.ts` | already in `browserPorts()` | already has one |
| `DraftKeeper` | `@cuestack/studio` `persistence/keeper.ts` | `browserKeeper()` over `localStorage` | `memoryKeeper()` — also the no-identity production choice |

`write` returns a result rather than `void`. `localStorage` throws `QuotaExceededError` when it is
full and can be unavailable to the page outright, and a keeper that swallowed either would lose the
teacher's work while the editor told them it was being kept — the one outcome FR-024 exists to
prevent (FR-024c).

None of the three joins `Ports`. That interface's comment gives the reason — "adding a port is then
a visible change at every construction site" — and playback defers nothing, keeps nothing, and does
not care whether the network is up.

`VisibilityPort` is reused rather than added: the hide-flush needs "is the document hidden, and tell
me when that changes", which is what it already says, and reusing it makes the flush injectable
instead of a raw listener a test has to dispatch a DOM event at (FR-024b). It arrives the way
`usePlayback` already receives one — `Pick<Ports, 'visibility'>` with a `browserPorts()` fallback —
because it is a member of `Ports`; the other three arrive as named options because they are not. See
the plan's "How a dependency reaches the studio".

Unlike the three that came before them, `Scheduler` and `Connectivity` will have **no consumer inside
core** — a consequence of core being the contract package, so a second adapter's editor can reach
them without importing from `@cuestack/react` (research R-03).

The keeper is the one that stays in the studio, and the split is not arbitrary: `localStorage` is
not a clock, so `no-clock-in-studio` has nothing to say about it, and keeping an unsaved draft is an
authoring concern that the player has no version of.

## 8. What `EditorSession` gains

| Member | Type | Notes |
|---|---|---|
| `undo()` | `() => void` | Refused in read-only, like every change (FR-011) |
| `redo()` | `() => void` | Same |
| `canUndo` | `boolean` | Renders the control as unavailable rather than absent |
| `canRedo` | `boolean` | False after any new change |
| `endEditRun()` | `() => void` | Called by surfaces at the end of a gesture (R-04) |

**`replaceDraft` is deliberately absent.** Restoring a version is `apply({ kind: 'replace-draft' })`,
the nineteenth member of `EDIT_KINDS`, so it inherits validation, the read-only refusal, and the
closure guarantee rather than restating them (research R-12). The kind branches inside `applyEdit`
rather than in `dispatch`, which mutates a cloned draft in place and has nothing for a whole-manifest
replacement to mutate.

**Every manifest from storage is migrated before it reaches `apply`** (FR-050, research R-14).
`applyEdit` validates against the current schema, so an unmigrated old version would be refused —
which is why the migration lives in `persistence/migrateOnLoad.ts` and never in the reducer.

`apply` keeps its signature and its return type. A caller that ignores history entirely — every
existing surface — is already recording steps, which is the whole point of R-01.
