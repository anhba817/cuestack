# Implementation Plan: Undo, Autosave, and Recovery

**Branch**: `008-undo-autosave-recovery` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-undo-autosave-recovery/spec.md`

## Summary

The editor stops borrowing against undo, and the storage boundary acquires its first consumer.
ED-5 of Wave 4, and the last item in it.

Seven decisions carry the feature. The first two are about where the work lives, and the third is
the one that reshaped the plan.

**History goes inside `useEditorSession`, not beside it.** The tempting shape is a
`useDraftHistory` the host wraps around the session, which keeps the hook small. It is the wrong
shape for the same reason the preview's override needed its two conditions: `Overlay`, `Inspector`,
`Timeline`, `SequenceView`, and `EffectControls` all call `session.apply` directly, so a history
the host has to route through is a history four surfaces can bypass, and the bypass is silent. Put
it in the frame and it becomes a property: there is no way to change a lesson that does not record
a step, because there is no way to change a lesson that is not `apply`. `applyEdit`'s five promises
are held the same way, and its header says why — "a handler that forgets to validate cannot exist,
because no handler validates."

**Undo restores a snapshot, and refuses to replay.** `applyEdit` already deep-clones the manifest
and returns a whole new one, and nothing mutates a draft after it is returned, so every previous
draft is an immutable object we already hold. History is therefore an array of references: nothing
is copied on the edit path, which matters because that path is inside the 100 ms input-to-feedback
budget. The alternative — keep the edits and replay from the origin — costs a clone and a full Zod
validation per step, so a 40-step undo would be 40 validations of a 300-element manifest. Constitution
IV already refuses exactly this trade for seeking: "replaying prior effects to reach a seek target
is prohibited." The same sentence applies to time and to history, which is a good sign it is the
right rule rather than a local convenience.

**The studio may not schedule, and this feature needs three delays.** `no-clock-in-studio` bans
`setTimeout`, `setInterval`, `requestAnimationFrame`, `Date`, `Date.now`, and `performance.now`
across `packages/studio/src/**` **with no `ignores`**, and its comment says that is deliberate:
"the rule needs no exemption at the one module most likely to grow a clock." ED-5 needs the 1.5 s
idle interval, the retry backoff, and the 15-minute checkpoint interval. Its stated remedy — "ask
the transport what time it is" — is wrong here: the transport is *lesson* time, it does not run
while a teacher edits, and it resets. So the plan takes the other half of the rule's own comment,
which is the route ED-3 already used: "both primitives the editor needs already live in
`@cuestack/react` ... so `usePlayback` imports rather than reimplements." A `Scheduler` port is
declared in `@cuestack/core` beside `TimeSource`, its browser implementation ships from
`@cuestack/react` beside `browserPorts`, and the studio imports it. **The rule is not touched.**

**Run collapsing turned out to be load-bearing for more than nudges.** The clarification was asked
about arrow keys. Implementing it against the code found that `timeline/Track.tsx` calls `onRetime`
on **every `pointermove`** — one `set-timing` edit per frame — where `canvas/gesture.ts` commits
once on release and says so in its header: "One edit per gesture, not one per frame." So a
two-second timeline drag is roughly 120 applied changes. Without collapsing it would exhaust a
50-step history in under a second and undo would be useless on the timeline, which is half of what
Wave 4 built. With it, the drag is one step. FR-004a is therefore not a convenience for arrow keys;
it is what makes undo work at all on the surface feature 006 shipped.

Collapsing needs a boundary that is not elapsed time, and pointer-up is the honest one. The session
gains `endEditRun()`, called by the canvas and the timeline when a gesture finishes and by the text
commit — so two consecutive drags of the same element are two steps while ten uninterrupted nudges
are one, and neither answer depends on how fast anyone moved.

The run key that decides all this is the edit's kind, its target ids, **and the path being written**.
The path is not decoration: `set-field` addresses an *element* rather than a field, so a key without
it would put an element's width and its label in one run — and `inspector/Field.tsx` commits on
every `onChange`, which makes that the ordinary case rather than a corner (research R-04).

**The load path is where `migrate()` finally has a consumer.** `migrate()` has been in
`@cuestack/schema` since Wave 1 with nothing calling it, because nothing has ever loaded a lesson it
did not itself construct — the **eighth** member of the declared-with-no-producer pattern, after
`Ports.storage`. ED-5 loads one twice, on open and on restore, and once restoring goes through
`applyEdit` the question stops being academic: the validator judges against the *current* schema, so
a version written under an earlier format would be refused, and the refusal would look like data
corruption to a teacher whose lesson is intact. Every manifest from storage is brought forward
first, in the persistence layer and never in the reducer (research R-14, FR-050).

**Restoring a version is the nineteenth edit kind, not a second write path.** The first draft of this
plan gave the session a `replaceDraft(manifest)`; it would have bypassed the read-only refusal, the
schema validation, and the closure guarantee feature 005's SC-017 asserts — on the one input in the
system that did not come from the editor's own reducer. `replace-draft` joins `EDIT_KINDS` instead
and inherits all three (research R-12, FR-039a). It branches inside `applyEdit` rather than in
`dispatch`, which mutates a cloned draft in place and so has nothing for a whole-manifest
replacement to mutate: two entry points into one frame, both passing the same refusal and the same
validator.

**The storage boundary needs three additions and has never been called.** `StorageAdapter` has
carried `loadDraft`, `saveDraft`, and `listVersions` since EN-6, with a conflict case in the
signature so a host cannot implement last-writer-wins by accident, and `browserPorts()` fills
`Ports.storage` from the in-memory reference — which nothing reads. That is the **seventh** contract
member this project has found declared with no producer, after `ElementPlugin.inspector`,
`EffectDescriptor.parameters`, `RenderState.problems`, `ResolveContext.effects`,
`AdvanceControllerOptions.allowOverride`, and `Ports.assets`. Trying to use it surfaced the gap the
spec records: a save cannot declare itself a checkpoint, a version entry cannot say when it was
recorded, and an earlier version's content cannot be fetched at all. Three additive changes, none
of them to the manifest, so no `schemaVersion` bump follows.

**Keeping runs on the save schedule, not on the change.** `localStorage` is synchronous and the
write is a whole manifest; `inspector/Field.tsx` commits on every `onChange`. Writing per change
would put a 300-element lesson's serialization between a key press and the character appearing, and
Constitution IV calls that budget an acceptance criterion rather than an aspiration — offline being
exactly when a teacher least wants the editor to feel worse. So the keeper writes when a save is
attempted, plus once when the page is going away — through the `VisibilityPort` that already exists
rather than a raw listener, so the flush is injectable like every other timing seam here — and
`write` returns a result because quota is a real outcome for a whole-manifest write (FR-024a–c,
research R-08).

**Identity does not merely scope the kept work — it chooses where the kept work lives.** FR-029a
says that with no author identity nothing is offered on reopening, while the automatic resend still
works within the session. Rather than write a durable copy and then remember not to offer it, the
absence of an identity selects an in-memory keeper. Nothing durable is written, so nothing can leak
from a shared classroom machine, and the promise is kept by construction rather than by a check
somewhere that could be forgotten.

**Three confirmations are deleted, not deprecated.** `canvas/DeleteConfirmation.tsx`,
`sequence/CustomConfirmation.tsx`, and the inline prompt in `effects/EffectControls.tsx` each carry
a comment naming ED-5 as their replacement. Their suites do not disappear with them: each becomes
an assertion that the action is reversible, which is the requirement the prompt was standing in for.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, unchanged from features 001–007.

**Primary Dependencies**: No new runtime dependencies in any package. `@cuestack/studio` already
depends on `@cuestack/core`, `@cuestack/react`, `@cuestack/schema`, and React 19.

**Storage**: The host's, through `StorageAdapter`. The in-memory reference in
`@cuestack/core/adapters/memory` is extended to serve checkpoints and version loads, so FR-048's
"exercisable with no host backend" stays true. Locally kept work uses `localStorage` through an
injectable keeper, or memory when no author identity is supplied.

**Testing**: Vitest 4.1.10. `@cuestack/studio` (happy-dom) for the hooks and surfaces,
`@cuestack/studio-pure` (node, no `document`) for the history algebra and the run-key predicate,
`@cuestack/core` (node) for the adapter contract, `gates` for the CI checks.

**Target Platform**: Browsers, latest two major versions. Authoring at 1280 px and wider.

**Project Type**: Monorepo of libraries — `@cuestack/schema` ← `@cuestack/core` ← `@cuestack/react`
← `@cuestack/studio`, plus `examples/nextjs`.

**Performance Goals**: A reversal within 100 ms on the 50-slide / 300-element fixture, and `apply`
still inside the budget it met before this feature — measured online *and* offline, since offline is
where the keeper writes (SC-003, SC-010d, FR-047).
Recording a step adds nothing measurable to the edit path — no copy, no serialization. Autosave
begins 1.5 s ± 250 ms after the last change (SC-005).

**Constraints**: `no-clock-in-studio` — no scheduling primitive may be constructed inside
`packages/studio/src`, and no `Date` may be referenced there at all. Probed: `new Date(recordedAt)`
fails the gate, `Intl.DateTimeFormat().format(recordedAt)` passes, which is how a checkpoint's time
is rendered (research R-13). Constitution II — every delay must be drivable without wall-clock time.
FR-045 — nothing here may enter the manifest or influence playback.

**Scale/Scope**: 50 reversal steps over a manifest of up to 300 elements; a version history of
checkpoints rather than saves, bounded in practice by four per hour of continued editing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this feature satisfies it | Verdict |
|---|---|---|
| **I. Code quality & modular boundaries** | No `any` in an exported signature. Core gains an interface and no UI import; the browser scheduler ships from `@cuestack/react`, keeping core framework-free. The `StorageAdapter` change is additive and semver-visible. No new switch on element type. | ✅ |
| **II. Test-first & deterministic verification (NON-NEGOTIABLE)** | Every delay runs on an injected `Scheduler`; no suite waits on wall time and none uses fake timers. The history algebra and run-key predicate are pure and tested in `studio-pure`, with no `document` available to reach for. Each of FR-001…FR-049 gets a test before its implementation. | ✅ |
| **III. UX consistency** | One status component and one four-word vocabulary, built so PB-2 can render a publish state through it. Undo replaces confirmation as the NFR-USA-003 answer rather than joining it. Every failure names the problem, the lesson, and the action. New surfaces are keyboard-operable, theme-token styled, and never state-by-colour. | ✅ |
| **IV. Performance as a contract** | Recording a step is a push of an existing reference. Reversal is a state set, not a replay — the same refusal Constitution IV makes for seeking. A perf fixture asserts SC-003 on the 50/300 lesson. | ✅ |
| **V. Preview–player parity (NON-NEGOTIABLE)** | No renderer, timing engine, or effect implementation is touched. Nothing added is serialized into the manifest: history, save state, kept work, and author identity are all session state, and FR-045 is asserted by a test that compares the manifest before and after a full save-and-undo cycle. | ✅ |

**Gates 1–7**: typecheck, lint (including `no-clock-in-studio`, which this feature deliberately does
not amend), tests, coverage floors for `core` and `schema`, parity fixtures, automated a11y on the
new surfaces, and the perf fixture. No gate is weakened.

**Deviations**: none. The one place a deviation was considered — adding an `ignores` entry to
`no-clock-in-studio` — was rejected in favour of importing the primitive, which is the route the
rule's own comment describes. See research R-03.

## Project Structure

### Documentation (this feature)

```text
specs/008-undo-autosave-recovery/
├── plan.md                          # This file
├── research.md                      # Phase 0 — eleven decisions
├── data-model.md                    # Phase 1 — the five session entities and their invariants
├── quickstart.md                    # Phase 1 — how to run and verify each story
├── contracts/
│   ├── history-contract.md          # What a reversal step is, and what apply promises
│   └── storage-contract.md          # The three additions, and what a host must honour
├── checklists/requirements.md       # From /speckit-specify, re-validated by /speckit-clarify
└── tasks.md                         # Phase 2 — /speckit-tasks, not created here
```

### Source Code (repository root)

```text
packages/core/src/
├── adapters/index.ts                # + checkpoint option, VersionEntry fields, loadVersion
├── adapters/memory/index.ts         # + checkpoint recording, version loading, injected now()
├── ports/scheduler.ts               # NEW — the deferred-execution interface, beside TimeSource
└── ports/connectivity.ts            # NEW — isOnline + subscribe, mirroring VisibilityPort

packages/react/src/player/
└── browserTiming.ts                 # NEW — browserScheduler() and browserConnectivity(), the
                                     #       only implementations that read a browser global

packages/studio/src/
├── session/useEditorSession.ts      # + undo, redo, canUndo, canRedo, endEditRun
├── draft/edit.ts                    # + 'replace-draft', the nineteenth kind
├── draft/reducer.ts                 # + its case; validation and read-only inherited
├── history/
│   ├── stack.ts                     # NEW — pure: push, collapse, undo, redo, depth
│   ├── runKey.ts                    # NEW — pure: which edits may join a run
│   └── shortcuts.ts                 # NEW — pure: chord → undo | redo | null
├── persistence/
│   ├── useDraftPersistence.ts       # NEW — the save loop, retries, conflict, checkpoints
│   ├── schedule.ts                  # NEW — pure: idle, backoff, and checkpoint policy
│   ├── keeper.ts                    # NEW — the local-keeping port + browser and memory kinds
│   ├── migrateOnLoad.ts             # NEW — every manifest from storage, brought forward first
│   ├── flush.ts                     # NEW — the hide/unload write, over the existing VisibilityPort
│   ├── SaveStatus.tsx               # NEW — one component, four words, shared with PB-2
│   ├── ConflictNotice.tsx           # NEW — persistent, non-blocking
│   ├── RecoveryPrompt.tsx           # NEW — modal <dialog>, answered before the lesson opens
│   └── VersionHistory.tsx           # NEW — checkpoints, newest first
├── useHistoryShortcuts.ts           # NEW — the host attaches it; text fields keep native undo
├── canvas/DeleteConfirmation.tsx    # DELETED
├── sequence/CustomConfirmation.tsx  # DELETED
├── canvas/Overlay.tsx               # delete applies directly; gesture end calls endEditRun
├── effects/EffectControls.tsx       # inline confirmation removed
├── timeline/Track.tsx               # gesture end calls endEditRun
├── inspector/Field.tsx              # gains onEndRun; Field holds no session of its own
├── inspector/Inspector.tsx          # the seam — it passes session.endEditRun down
├── styles/editor.css                # confirmation rules out; status/history/notice rules in
└── index.ts                         # exports follow the above

examples/nextjs/app/edit/editor-view.tsx   # wires storage, status, history, recovery
```

**Structure Decision**: The existing four-package graph is unchanged and the arrow still points one
way. The only cross-package additions are two interfaces in `core` and their browser implementations
in `react`, which is what lets the studio obey `no-clock-in-studio` without an exemption.

They go in core because the constitution fixes the graph that way — "additional adapters are thin
bindings over the same core" — so a second adapter's editor needs this contract and must not import
it from `@cuestack/react`. Worth being precise about what that is *not*: unlike `MediaPort`,
`VisibilityPort`, and `TimeSource`, these two will have **no consumer inside core**. That is a
consequence of core being the contract package rather than a sign they are misplaced, and it is
stated here because the obvious-sounding justification — "the same split the others use" — does not
survive checking (research R-03). The keeper stays in the studio because `localStorage` is not a clock and
authoring is the only thing that keeps a draft.

### Post-design re-check

The design added three ports, one interface rename, one new adapter method, and five components.
Re-reading the five principles against them changes no verdict:

- **I** — the two new core interfaces import nothing and add no dependency; the browser
  implementations live in the adapter package where every other browser read already lives. The
  nineteenth edit kind is a case in the existing reducer, not a branch on element type.
- **II** — every delay in the design routes through `Scheduler`, and the history algebra and
  checkpoint policy are pure modules tested with no `document` available at all.
- **III** — one `SaveStatus`, four words, reusable by PB-2 because its prop is a status rather than
  a draft, and never blank: a lesson with nothing outstanding reads Saved, which keeps FR-016's
  "exactly one of" literally true on open as well as after a write.
- **IV** — the edit path gains a push of an existing reference and nothing else; reversal is a state
  set, and `quickstart.md` §11 measures it.
- **V** — `contracts/history-contract.md` §7 and `quickstart.md` §10 both pin FR-045, and the second
  is an executable comparison rather than a promise.

## How a dependency reaches the studio

This feature adds a third way to inject a primitive into `@cuestack/studio`, so the rule is worth
writing down before it becomes a habit nobody chose.

| Existing | Shape | Example |
|---|---|---|
| `usePlayback` | `ports?: Pick<Ports, 'time' \| 'visibility'>`, defaulting to `browserPorts()` | The transport's clock |
| `useEditorSession` | Discrete optional members — `analytics?`, `editors?`, `idSource?` | Things that are not ports |

**The rule, from here on: a member of `Ports` arrives as `Pick<Ports, …>` with a `browserPorts()`
fallback; anything else arrives as a named option.** So `useDraftPersistence` takes
`ports?: Pick<Ports, 'visibility'>` for the hide-flush signal — the same seam `usePlayback` already
uses, which is why T063a names it — and takes `storage`, `scheduler`, `connectivity`, `keeper`, and
`identity` as named options, because none of them is in `Ports` and R-03 explains at length why the
first two must not be.

That leaves one hook with six options, which is more than any other in the package. It is the honest
count: persistence genuinely depends on six things the editor cannot do itself, and grouping them
into a bag named `ports` would claim a relationship to `Ports` that four of them do not have.

## Complexity Tracking

No constitution violations to justify. Two choices that look like complexity are recorded here
because a reviewer will reasonably ask about both.

| Choice | Why | Simpler alternative rejected because |
|---|---|---|
| Three new ports (scheduler, keeper, connectivity) rather than direct browser calls | Constitution II requires every delay to be verifiable without wall time, and `no-clock-in-studio` forbids the direct call outright | Vitest fake timers would satisfy the letter of determinism while leaving `setTimeout` in studio source, which the lint rule refuses — and the repo has driven every clock by injection since Wave 1 |
| `endEditRun()` on the session, called by surfaces | A run needs a boundary, and pointer-up is the only one that is not elapsed time | Breaking runs on a timer reintroduces exactly the nondeterminism the clarification rejected; breaking them only on selection change makes two consecutive drags of one element a single undo step |
