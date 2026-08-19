# Quickstart: Undo, Autosave, and Recovery

How to run this feature, and how to check that each of its five stories actually holds. Every
command is runnable from the repository root.

Design detail lives in [data-model.md](./data-model.md),
[contracts/history-contract.md](./contracts/history-contract.md), and
[contracts/storage-contract.md](./contracts/storage-contract.md). This file is the run guide.

---

## 1. Prerequisites

```bash
pnpm install
pnpm build          # required: the gates and check:data-model read dist/, not src/
```

`pnpm build` matters more than usual here. `@cuestack/studio` resolves `@cuestack/core` and
`@cuestack/react` through their package entries, so a change to core's adapters is invisible to a
studio test until core is rebuilt. Feature 007's parity gate probe was reported green for exactly
this reason before it rebuilt first.

## 2. Run everything

```bash
pnpm typecheck      # 9 projects, zero errors
pnpm lint           # includes no-clock-in-studio, which this feature does not amend
pnpm test           # the four vitest projects
pnpm gates          # typecheck, lint, tests, coverage, parity, a11y, perf
pnpm check:rules    # BR-001…BR-018 coverage
```

## 3. Run only this feature's suites

```bash
pnpm test --project @cuestack/studio-pure test/draft/replace-draft.pure.test.ts   # the 19th kind
pnpm test --project @cuestack/studio-pure test/history          # the algebra, no DOM at all
pnpm test --project @cuestack/studio-pure test/persistence      # the schedule policy
pnpm test --project @cuestack/studio      test/history          # the session hook
pnpm test --project @cuestack/studio      test/persistence      # the save loop and surfaces
pnpm test --project @cuestack/core        test/adapters         # the storage contract
```

The split is not cosmetic. `test/history/stack.pure.test.ts` and `test/history/runKey.pure.test.ts`
run in an environment with **no `document`**, so a history implementation that started reaching for
the DOM would fail to run rather than quietly grow a dependency — the same guarantee feature 005
established for geometry.

---

## 4. US1 — undo and redo

```bash
pnpm test --project @cuestack/studio test/history
```

What to look for:

- `every-kind.test.tsx` walks every member of `EDIT_KINDS` — driven from the constant, not a hand-
  written list, so the restore kind is covered the day it lands — applies one of each, undoes it, and asserts
  the manifest is byte-identical to what it was before. This is SC-001 and SC-002 together, and it
  is the test that fails when a nineteenth kind is added without thought.
- `runs.test.tsx` proves both halves of FR-004a: ten nudges are one step, and two drags separated by
  `endEditRun()` are two.
- `timeline-run.test.tsx` is the one worth reading. It drives a timeline drag the way `Track.tsx`
  actually emits it — one `set-timing` per `pointermove` — and asserts the whole drag is one step.
  Delete the `set-timing` entry from the run-key allow-list and this fails while everything else
  passes.
- `visible.test.tsx` covers FR-008 and FR-009: undoing an edit made on another slide navigates
  there, and undoing a delete leaves the returned elements selected.

**Prove it can fail.** Remove `'set-timing'` from `history/runKey.ts`'s allow-list and re-run:
`timeline-run.test.tsx` fails and reports 120-odd steps for one drag.

## 5. US2 — autosave and status

```bash
pnpm test --project @cuestack/studio test/persistence/save.test.tsx
```

No test in this file waits on real time. Each drives a hand-advanced `Scheduler`:

```ts
const scheduler = testScheduler()
// ... make a change ...
expect(status()).toBe('Saving')      // pending, before the interval elapses
scheduler.advance(1500)
await act(async () => undefined)
expect(storage.saves).toHaveLength(1)
```

A freshly opened lesson reads **Saved** before anything happens — there is no blank state — so the
sequence a test watches is Saved → Saving → Saved.

Check in particular that `saved.test.tsx` holds the acknowledgement and asserts the status stays
**Saving** — FR-017 is the requirement teachers stake an hour of work on, and the only way to test
it is to refuse to acknowledge.

## 6. US3 — offline and recovery

```bash
pnpm test --project @cuestack/studio test/persistence/offline.test.tsx
pnpm test --project @cuestack/studio test/persistence/recovery.test.tsx
```

`recovery.test.tsx` unmounts the editor entirely between the interruption and the reopen, which is
the closest a suite gets to a browser refresh: the keeper is the only thing that carries state
across, so anything held in a hook is gone exactly as it would be.

`offline.test.tsx` also pins the write schedule: twenty changes inside one interval produce **one**
keeper write. Move that back onto the change path and the assertion fails immediately — which is the
point, because the symptom in a browser would be typing that feels fine online and sticky offline.

The identity tests are the ones to read twice. `identity.test.tsx` asserts that work kept by one
identity is not offered to another, and that with **no** identity nothing durable is written at all
— `browserKeeper` is never constructed, so there is nothing to leak rather than something that is
not offered.

## 7. US4 — conflict

```bash
pnpm test --project @cuestack/studio test/persistence/conflict.test.tsx
```

Each case mutates the stored lesson behind the editor's back, then makes a change. Assert three
things every time: the save was refused, the **stored** manifest is untouched, and autosave stopped.
Save-now is part of that third one: while the conflict stands it attempts nothing.
The third is the one that regresses silently — a retry loop that keeps attempting a losing save
looks fine until you count the requests.

`conflict-nonblocking.test.tsx` covers FR-032a: with the notice showing, apply an edit and confirm
it succeeds, then confirm the notice is still there.

## 8. US5 — version history

```bash
pnpm test --project @cuestack/core   test/adapters/versions.test.ts
pnpm test --project @cuestack/studio test/persistence/history.test.tsx
```

`checkpoints.test.ts` is the one that proves the clarification: drive an hour of editing through the
scheduler, count the saves and count the entries, and assert the first is dozens and the second is
at most five (SC-010a).

`restore.test.tsx` asserts the ordering from
[storage-contract.md §5](./contracts/storage-contract.md): a checkpoint of the state being left, then
the restore, then a checkpoint of the result — and that no earlier entry disappeared. It also covers
the refused path, where the draft is untouched and the first checkpoint stands.

`history.test.tsx` is the version-history surface's own suite — the listing, the timestamps and
names, the read-only case where restore is not offered, and the unreachable case where the history
says so rather than showing an empty list. An empty list is a lie a teacher would act on.

`migrate-on-load.test.tsx` covers the boundary that makes all of this survive a format change: every
manifest from storage is brought forward before anything sees it. Skip it and a version written six
months ago is refused by the validator, and the refusal reads as corruption rather than as an old
file (FR-050).

## 9. The confirmations are gone

```bash
grep -rn "DeleteConfirmation\|CustomConfirmation\|cs-effect-confirm\|cs-sequence-confirm" \
  packages/studio/src packages/studio/test examples/nextjs/app
```

Expect no matches outside `examples/nextjs/.next` build output. `test/canvas/delete.test.tsx`,
`test/sequence/custom.test.tsx`, `test/keyboard/actions.test.tsx`, `test/keyboard/focus.test.tsx`,
and `test/a11y/axe.test.tsx` are rewritten rather than deleted: what they assert is now that the
action happens at once and one undo takes it back. SC-004 is that grep plus those five files.

## 10. Parity is untouched, and asserted to be

```bash
pnpm test --project @cuestack/studio test/parity
pnpm test --project @cuestack/studio test/persistence/inert.test.tsx
```

`inert.test.tsx` is FR-045: run a full cycle — edit, autosave, conflict, recover, undo, restore —
then compare the manifest against one produced by applying the same edits with no persistence at
all. They must be byte-identical, because none of this feature is authored data.

## 11. Performance

```bash
pnpm test --project @cuestack/studio test/perf/history.test.tsx
```

SC-003 and SC-010d, all three measurements: a reversal within 100 ms on the 50-slide / 300-element fixture with a full
50-step history behind it, **and** `apply` still inside the budget it met before this feature, online and offline —
recording a step must cost nothing measurable on the path a teacher feels, and neither must keeping. The fixture is
`tools/scripts/fixtures/`, the same one features 005 and 006 use, so a regression here is comparable
across waves.

## 12. Try it by hand

```bash
pnpm --filter @cuestack/nextjs-example dev
# http://localhost:3000/edit
```

The example wires the memory storage, so everything works with no backend. Two things are worth
doing by hand because no assertion conveys them:

1. Drag an element on the timeline for two seconds, then press undo once. It should go back to where
   it started, in one press.
2. Open the browser devtools, go offline, keep editing, then refresh. The recovery prompt should
   appear before the lesson does.

## 13. Manual keyboard and screen-reader pass

Automated a11y checks catch attributes; they do not catch whether a sequence makes sense. Perform
these eight, in one pass, with a screen reader running:

1. Undo and redo from the keyboard with focus in the canvas, the inspector, and the timeline.
2. Undo mid-typing in a text element — the platform's own undo should act on the text, not the
   editor's on the element.
3. Confirm each undo announces what it reversed (FR-010).
4. Reach the save status and confirm its state is announced when it changes, not only on focus.
5. Reach and operate the manual retry after a failure, from the keyboard alone.
6. Answer the recovery prompt from the keyboard; confirm focus starts inside it and returns
   sensibly.
7. Reach the conflict notice while it is standing, operate both choices, and confirm neither traps
   focus.
8. Open the version history, move through the checkpoints, and restore one — all from the keyboard.

Record the result in the pull request. This is the Definition of Done item the constitution names.

## 14. Known issues in the surrounding suite

- `test/perf/timeline.test.tsx` — "playhead to a rendered state within 90 ms" fails roughly one run
  in four under load. **Pre-existing**, recorded during feature 007, not caused by this feature. It
  is a threshold set close to the budget rather than a regression; re-run before investigating.
- Two `no-orphans` warnings from `lint:boundaries` predate this feature and are unrelated.

## 15. What is deliberately not here

- **A second editing tab** is not supported and not tested as a workflow. It is tested as a
  *conflict*: the second tab's save is refused, which is §7's contract holding.
- **Merging** two versions. Refused, never reconciled — spec §19 keeps collaborative editing out of
  scope, and the spec's own assumption records why a blind overwrite is not offered.
- **Pruning old checkpoints.** The host's business; the framework never removes an entry.
