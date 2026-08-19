# Contract: what `apply` now promises, and what a reversal restores

`applyEdit` states five promises in its header — purity, no mutation of the input, a validated
result, a blanket read-only refusal, and locked elements skipped rather than fatal — and says why
they live in the frame: "a handler that forgets to validate cannot exist, because no handler
validates."

History is the sixth, and it is held the same way. `useEditorSession.apply` is the only route from a
surface to the reducer, so every change is recorded because there is no change that is not `apply`.

---

## 0. Restore is a change, not a second write path

`replace-draft` is the nineteenth member of `EDIT_KINDS`, and restoring a version goes through
`session.apply` like everything else (research R-12). There is no `replaceDraft` method, and the
absence is the point: a method beside `applyEdit` would inherit none of the four guarantees below,
and the manifest it carries — written by an earlier release, returned by a host — is the one input
in this system that did not come from the editor's own reducer.

So a restore is validated before it becomes the draft, is refused in read-only, and is one reversal
step (FR-039a, FR-041). It is also covered by feature 005's closure guarantee for free: the
read-only suite enumerates `EDIT_KINDS`, so the new kind is refused-by-default and fails a test
until somebody says otherwise on purpose.

**It branches in `applyEdit`, not in `dispatch`.** The frame binds `const next = clone(draft)` and
`dispatch` mutates it in place, so a kind that replaces the manifest has nothing to mutate — and the
slide lookup that precedes `dispatch` would refuse a stale slide id on an edit about to discard that
slide. `replace-draft` therefore branches after the read-only refusal and before the clone, running
the same validator. **Two entry points into one frame, not two write paths**: what makes it one
frame is that both pass the same refusal and the same `validate` (research R-12).

**The manifest reaching it has already been migrated.** `loadVersion` returns whatever the host
stored, which may predate the current format; the persistence layer brings it forward before calling
`apply`, because a validator asked to judge an old format would refuse a lesson that is perfectly
intact (FR-050, research R-14).

---

## 1. The six promises of `session.apply`

1. **The five the reducer already makes**, unchanged. `apply` still returns the same `EditResult`,
   and a caller that ignores history entirely — which is every surface shipped today — is already
   recording steps.
2. **A successful change is reversible.** Exactly one reversal step exists for it, or it joined the
   run above it (§3).

**A refusal records nothing.** Nothing changed, so there is nothing to reverse — and FR-019's "a
refused change MUST NOT trigger a save" falls out of the same fact rather than needing a check.

---

## 2. What a reversal restores

| Restored | From | Requirement |
|---|---|---|
| The lesson's authored data, exactly | the step's `before` reference | FR-006 |
| The slide the change was made on | the step's `slideId`, if the teacher is elsewhere | FR-008 |
| The selection | the elements the reversal brought back, else the step's `selectionBefore` | FR-009 |

**What a reversal does not restore**: authoring time, the clipboard, the open text surface, the
timeline's scale, the preview's state. FR-007 keeps them out of history, and the reason is concrete
rather than tidy — an undo that moved the playhead would look like the editor losing its place.

**Elements brought back are computed, not recorded.** `EditResult` carries `idsCreated` and nothing
about removals, so knowing what a `delete` took would mean a branch per edit kind — which
Constitution I calls a defect. Diffing element ids on the affected slide between the two drafts is
general, needs no per-kind knowledge, and costs one pass over one slide.

---

## 3. Which changes may join a run

A run key is the edit's kind, its sorted target ids, **and the path being written for the field
kinds** — and it is built **only for these four kinds**:

| Kind | Why it repeats |
|---|---|
| `transform-elements` | Arrow-key nudges; and the canvas's own drag, which commits once |
| `set-timing` | The timeline emits one per `pointermove` — see below |
| `set-field` | Inspector fields, which commit on every `onChange` |
| `set-slide-field` | The same, for slide properties |

**The path is part of the key, and leaving it out was a defect.** `set-field` addresses an element,
not a field, so a key of kind plus target would put an element's width and its label in one run —
change one then the other and a single undo reverts both. `set-slide-field` names no element at all,
so every slide property would share one key. Since `inspector/Field.tsx` commits on every
`onChange`, this is the ordinary case rather than a corner. **Two different fields are two runs; the
same field twice is one.**

Every other kind gets a key that cannot match, so it never collapses. `add-element`, `duplicate`,
and `paste` mint ids and have no stable target set; `delete` is not something anyone repeats into
the same target. An allow-list of four is greppable; "everything except" is not.

`set-effect` **is** on the list, and it was added after the question was read rather than guessed
at. `EffectFields` renders the same `Field` the inspector does, and `Field` commits on every
`onChange` — so typing "0.35" into an effect's amount is four applied changes and would be four undo
steps. Its key carries the element, the effect, **and the keys the patch writes**, so changing a
duration and then a parameter are two runs.

**`set-timing` is the reason this matters more than it sounds.** `timeline/Track.tsx` calls
`onRetime` from `onPointerMove`, so a two-second timeline drag is roughly 120 applied changes —
where `canvas/gesture.ts` commits once on release and its header says why. Without collapsing, one
timeline drag exhausts a 50-step history and undo stops working on half of what Wave 4 built.

---

## 4. Where a run ends

A run is broken by, and only by:

- an edit with a different run key;
- `select()`;
- `goToSlide()`;
- a committed text edit;
- `endEditRun()`.

**Never by elapsed time.** That is the clarification's decision and it is what keeps history
deterministic: the same sequence of actions produces the same history whatever speed it was
performed at, and no test of undo needs a clock.

**`endEditRun()` is the surfaces' obligation.** `canvas/Overlay.tsx` calls it when a pointer gesture
ends; `timeline/Track.tsx` calls it on pointer-up and on blur. Without it, two consecutive drags of
one element would be one reversal step, which nobody expects. With it, ten uninterrupted nudges are
still one, which everybody does.

A surface that forgets to call it degrades gracefully — steps merge that should not have — rather
than corrupting anything. That is the right failure direction, and it is why this is a call rather
than a required argument to `apply`.

---

## 5. Read-only

`undo` and `redo` are refused in read-only mode with the same refusal every change receives
(FR-011), and the refusal is produced by the same path: a reversal is an ordinary change to the
draft, so `session.mode` is checked in one place rather than two.

**Nothing is recorded in read-only either**, because nothing succeeds. The blanket refusal
`applyEdit` performs before anything else already covers the whole `Edit` union — which is what
feature 005's SC-017 asserts — so history inherits the guarantee instead of restating it.

---

## 6. Interaction with saving

- A reversal or reapplication **is a change** for saving purposes (FR-013). It is not an "unsave":
  no acknowledged version is removed and no checkpoint is withdrawn.
- Undo while a save is in flight is safe. The in-flight save carries the manifest it was started
  with; the reversal becomes the next pending state and is saved after it settles.
- History is **not** persisted and does not survive closing the lesson (FR-012). Restored kept work
  arrives with an empty history, and that is honest: the steps that produced it happened in a
  session that is gone.

---

## 7. What this contract does not promise

- **No branching history.** A new change after a reversal discards the reversed ones (FR-003).
- **No unbounded depth.** Fifty steps; past that the oldest is dropped, and the control simply
  becomes unavailable — the same state it renders for "nothing to undo".
- **No cross-lesson history.** Scoped to the open lesson, like everything else in the session.
- **No undo of a save.** Saving is not a change to the lesson, and a control that could unsave would
  be the opposite of what FR-DAT-003 promises.
