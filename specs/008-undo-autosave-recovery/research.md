# Research: Undo, Autosave, and Recovery

Eleven decisions. Each was taken against the code rather than in the abstract, and three of them
changed once the code was read — R-03, R-04, and R-06 are all findings rather than preferences.

---

## R-01 — History lives inside `useEditorSession`

**Decision.** `undo`, `redo`, `canUndo`, `canRedo`, and `endEditRun` become members of
`EditorSession`. `apply` records a step as part of applying an edit. There is no separate history
hook a host can choose to wire up.

**Rationale.** Five surfaces call `session.apply` directly today — `Overlay`, `Inspector`,
`Timeline`, `SequenceView`, and `EffectControls` — and nothing forces a host to route them through
anything. A history the host wraps around the session is therefore a history that four of those
five can bypass, silently, and the failure mode is the worst kind: undo appears to work and quietly
skips whichever surface was wired last.

Inside the frame it becomes a property rather than a discipline. `applyEdit`'s header already
states the same argument for validation — "a handler that forgets to validate cannot exist, because
no handler validates" — and the read-only refusal is held the same way, covering the whole `Edit`
union rather than the variants a surface happens to expose.

**Alternatives considered.**

- *A `useDraftHistory` hook composed by the host.* Smaller session hook, bypassable history.
  Rejected on the above.
- *A history middleware wrapping `applyEdit` itself, in `draft/`.* The reducer is pure and takes no
  state across calls; giving it memory would cost it the property that makes it testable with no
  React at all. History is session state, and `data-model.md` §1 draws that line already.

---

## R-02 — A step holds the previous draft by reference; reversal is a state set, never a replay

**Decision.** Each history step keeps a reference to the manifest as it was before the change. Undo
sets the draft back to that reference. Nothing is copied, serialized, or diffed on the edit path.
Depth is 50; the oldest step is dropped past it.

**Rationale.** `applyEdit` already deep-clones the manifest and returns a fresh one, and nothing
mutates a draft after it is returned, so the previous draft is an immutable object we are holding
anyway. Recording a step is a push of a reference — nothing measurable added to a path that has to
stay inside NFR-PERF-002's 100 ms.

Replaying the edits from the origin was the alternative that looked principled: history becomes a
list of intents, which is smaller and reads like an event log. It costs a clone and a full Zod
validation per step, so undoing the 40th change means 40 validations of a 300-element manifest.
Constitution IV refuses the identical trade for time — "seeking MUST recompute element state from
the manifest. Replaying prior effects to reach a seek target is prohibited" — and the argument
transfers without modification. When a rule written for one axis answers a question on another, it
is usually the right rule.

Memory is the honest cost. Fifty distinct 300-element manifests is tens of megabytes for a desktop
editor at its documented maximum, and the depth bound is what keeps it from growing without limit.
The alternative that would reduce it — structural sharing between drafts — is unavailable while
`applyEdit` clones the whole tree, and changing that is a reducer decision with its own risks, not
a history one.

**Alternatives considered.** Patch journals (Immer) — feature 005's R-07 rejected the dependency
because nothing collected the patches; collecting them now would still cost patch computation on
every edit to save memory that the depth bound already caps. JSON-string snapshots — bounds memory
better, costs a `stringify` of ~250 KB inside the input-to-feedback budget on every edit.

---

## R-03 — The scheduler is declared in core, implemented in react, and imported by the studio

**Decision.** `Scheduler` — `{ now(): number; after(ms: number, run: () => void): () => void }` —
is declared in `packages/core/src/ports/scheduler.ts` beside `TimeSource`, and is **not** added to
`Ports`. `browserScheduler()` ships from `@cuestack/react`. `@cuestack/studio` imports it and
never constructs one. `no-clock-in-studio` is left exactly as it is.

**Rationale.** This was the finding that reshaped the plan. `no-clock-in-studio` bans `setTimeout`,
`setInterval`, `requestAnimationFrame`, `Date`, `Date.now`, and `performance.now` across
`packages/studio/src/**` **with no `ignores`**, and the rule's comment says the absence is the
point: "the rule needs no exemption at the one module most likely to grow a clock." This feature
needs three delays — the 1.5 s idle interval, the retry backoff, and the 15-minute checkpoint
counter — so on first reading it is the exemption that rule was written to refuse.

The remedy the rule offers by name, "ask the transport what time it is", does not apply. The
transport is *lesson* time: it does not advance while a teacher edits, and it resets. Autosave that
waited on it would never fire.

But the rule's comment offers a second route, and it is the one ED-3 actually took: "both
primitives the editor needs already live in `@cuestack/react` — `requestAnimationFrame` inside
`useFrameLoop`, `performance.now` inside `browserPorts` — so `usePlayback` imports rather than
reimplements." Taking the same route costs one interface and one twelve-line implementation, and
buys a rule that still has no exemptions and a set of delays that are injectable by construction —
which is what Constitution II asks for anyway.

Not adding it to `Ports` is deliberate. That interface's own comment explains why the grouping
exists: "adding a port is then a visible change at every construction site, rather than a quiet new
obligation." Playback never defers anything, so putting a scheduler there would oblige every player
construction site and every test's ports object to supply something the player cannot use.

**Why core rather than react, stated properly.** An earlier draft justified this as "the same split
`MediaPort`/`createDomMediaPort` and `TimeSource`/`browserPorts` already use", and that precedent
does not actually hold: every existing port in `core/ports` has a *core* consumer — `MediaPort` in
`advance/{conditions,reachability,controller}` and `media/link`, `VisibilityPort` in `time/transport`
and `resolve/element`, `TimeSource` in `time/clock`. `Scheduler` and `Connectivity` would be the
first two with none.

The real reason is the package graph the constitution fixes: "Additional adapters are thin bindings
over the same core." A second adapter's studio would need exactly this contract and must not import
it from `@cuestack/react` — the arrow points one way, and a Vue editor depending on the React package
to learn what a scheduler is would be the cycle that rule exists to prevent. Contracts belong in
core; implementations belong in adapters. That a contract has no *core* consumer is a consequence of
core being the contract package, not evidence it is in the wrong place.

**It is worth saying out loud that this adds two more declared-with-no-producer members** — the ninth
and tenth — to the package where that pattern was named. The difference is intent: the previous eight
were built ahead of consumers that had not been designed yet, and these two have a consumer in the
same change. A contract with a consumer on the day it ships is a different object from one waiting
three waves for its first call.

**Alternatives considered.**

- *Add an `ignores` for the persistence directory.* The first exemption in a rule whose value is
  that it has none, bought to avoid writing twelve lines.
- *Vitest fake timers.* Satisfies determinism in the suite while leaving `setTimeout` in studio
  source, which the lint gate refuses outright — and fake timers plus `act()` plus happy-dom is a
  combination this repo has so far avoided needing.
- *Poll from `useFrameLoop`.* A 60 Hz loop running for the lifetime of the editor to notice that
  1.5 s has passed, and a second frame loop is the exact failure mode feature 006 was designed
  against.

---

## R-04 — Run keys decide what may collapse; `endEditRun()` decides where a run ends

**Decision.** A step carries a *run key* derived from the edit: its kind, its sorted target ids,
**and — for the field kinds — the path being written**, and only for kinds a teacher genuinely
repeats: `transform-elements`, `set-timing`, `set-field`, and `set-slide-field`. Every other kind gets a key that can never match, so it never collapses. A
new edit whose run key equals the top step's key, with no run break in between, updates the draft
without pushing a step. Runs are broken by `select`, `goToSlide`, a committed text edit, a
different run key, and by `endEditRun()`, which the canvas and the timeline call when a gesture
finishes.

**Rationale.** The clarification was asked about arrow keys. Reading the code found something
larger: `timeline/Track.tsx` calls `onRetime` from `onPointerMove`, so a timeline drag emits one
`set-timing` edit per frame — roughly 120 for a two-second drag — where `canvas/gesture.ts`
deliberately commits once on release and says so ("One edit per gesture, not one per frame. The
draft changes on release, so an interrupted drag leaves nothing behind and the validity check runs
once rather than sixty times a second"). Without collapsing, one timeline drag exhausts a 50-step
history and undo is useless on half of what Wave 4 built. FR-004a is what makes undo work there at
all.

The allow-list is small on purpose. `add-element`, `duplicate`, and `paste` mint ids and have no
stable target set, so a key built from their targets would be meaningless; `delete` is not
something anyone repeats into the same target. An allow-list of four is greppable and testable,
which an "everything except" rule is not.

**The path is in the key because the target id is not enough**, and this was a correction rather
than a refinement. `set-field` addresses an *element*, not a field — so a key of kind plus target
would make an element's width and its label share one, and changing one after the other would
collapse into a single step that reverted both. `set-slide-field` is worse: it names no element at
all, so every slide property on one slide would share a key. `inspector/Field.tsx` commits on every
`onChange`, so a teacher typing a label and then adjusting a number is the ordinary case rather than
a contrived one. Two different fields are two runs; the same field twice is one.

`endEditRun()` exists because a run needs a boundary and the clarification ruled out elapsed time.
Pointer-up is the boundary a teacher already believes in: two consecutive drags of one element are
two steps, and ten uninterrupted nudges are one, and neither answer changes with how fast anyone
moved.

**Alternatives considered.** Breaking runs after a quiet interval — exactly the nondeterminism the
clarification rejected, and it would make the undo suite depend on a scheduler. Breaking only on
selection change — makes two consecutive drags of the same element one undo step, which nobody
expects.

**`set-effect` joined the list once the question was read.** `EffectFields` renders the same
`Field` the inspector does, and `Field` commits on every `onChange` — so an effect's amount typed as
"0.35" is four applied changes. Its key carries the element, the effect, and the keys the patch
writes, so a duration change and a parameter change stay separate. The list is five, not four,
and it grew from evidence rather than from suspicion.

**Noted, not fixed here.** One `set-timing` per pointermove also means one full manifest clone and
one full Zod validation per frame during a timeline drag. Collapsing removes the history
consequence; the CPU cost is feature 006's and is out of ED-5's scope. It belongs in the carried
obligations rather than in this feature's tasks.

---

## R-05 — A step carries the slide and the selection, and reversal computes what came back

**Decision.** Each step records the `slideId` the change was made on and the selection immediately
before it. Undo restores the draft, navigates to that slide if the teacher is elsewhere (FR-008),
and sets the selection to the elements the reversal *restored* — computed by diffing element ids on
the affected slide between the two drafts — falling back to the recorded selection when the
reversal restored nothing.

**Rationale.** FR-009 asks that undoing a delete leave the returned elements selected, which is
what makes the reversal visible rather than merely correct. The removed ids are not in `EditResult`
— it carries `idsCreated` and nothing about removals — so recording them per edit kind would mean a
branch per kind, which Constitution I calls a defect. The diff is general, needs no per-kind
knowledge, and is O(elements on one slide).

Recording the selection as well is what covers the other direction: undoing an *add* restores
nothing, and the useful answer is the selection the teacher had before they added.

**Alternatives considered.** Recording the whole session state per step — brings authoring time and
clipboard into history, which FR-007 forbids and which would make undo move the playhead. Recording
nothing and leaving selection to `clampSelection` — correct but silent, and FR-008 exists because a
silent reversal on another slide reads as the editor doing nothing.

---

## R-06 — Three additive changes at the storage boundary, and its first consumer

**Decision.**

1. `saveDraft` gains an optional fourth parameter carrying a checkpoint request and its label.
2. `VersionSummary` becomes `VersionEntry`, gaining `recordedAt` and an optional `label`.
   `listVersions` returns checkpoints, not every save.
3. `loadVersion(lessonId, token)` is added, returning the same `LoadResult` shape.

The in-memory reference implements all three and takes an injected `now` so its timestamps are
deterministic.

**Rationale.** Trying to use a contract is how this project reviews one, and this is the seventh
member found declared with no producer — after `ElementPlugin.inspector`,
`EffectDescriptor.parameters`, `RenderState.problems`, `ResolveContext.effects`,
`AdvanceControllerOptions.allowOverride`, and `Ports.assets`. `Ports.storage` is filled by
`browserPorts()` from the memory adapter and read by nothing.

Using it surfaced the gaps immediately. FR-DAT-009 asks a teacher to restore an earlier version and
the interface can only load the current draft, so the requirement was unimplementable as the
boundary stood. FR-DAT-008 asks for a version history and `listVersions` returns every save, which
with a 1.5 s autosave is not a history anyone can read — the clarification's separation of the
version the editor holds from the version the teacher browses is what resolves it, and the boundary
has to be told which is which. And an entry with no timestamp cannot be told apart from the one
above it.

`recordedAt` is the host's, not the framework's. The adapter stamps it, because the host's storage
is the only participant with an authoritative clock — and because a framework-side stamp would need
a clock the studio is forbidden to read.

**Alternatives considered.** A separate `VersionAdapter` — a second boundary for a feature of the
first, and `saveDraft` would still need to say whether it was a checkpoint. Deriving checkpoints
client-side from a full version list — requires the list the decision exists to avoid.

**Semver.** Two additive optional fields and one new required method on an interface with exactly
one implementation in the repository and no published consumers. Nothing in the manifest changes,
so no `schemaVersion` bump and no migration.

---

## R-07 — Checkpoint policy is a pure function of counters, evaluated at save time

**Decision.** `persistence/schedule.ts` exports a pure decision: given the number of applied changes
since the last checkpoint, the editing time accumulated since it, and whether the teacher asked,
return whether this save is a checkpoint. Editing time is accumulated from the scheduler only while
changes are arriving, so an idle editor accrues none.

**Rationale.** FR-035a has four triggers and the spec's edge cases pin the awkward one: the
15-minute interval counts *continued editing*, not wall-clock time, so a lesson left open overnight
records nothing. Keeping the decision pure means the four triggers are a table in a
`studio-pure` test rather than four branches inside a hook that needs a DOM to exercise.

**Alternatives considered.** A repeating 15-minute timer — fires while nobody is editing, which the
spec explicitly rules out. Checkpointing on every nth save — the count of saves is a proxy for
elapsed idle intervals rather than for work done, so a teacher typing steadily and one poking at
the lesson hourly would get very different histories.

---

## R-08 — The keeper is a port, and the absence of an identity chooses which kind

**Decision.** `DraftKeeper` — `read`, `write`, `clear`, all synchronous and keyed by a string.
`browserKeeper()` over `localStorage`, `memoryKeeper()` over a `Map`. The key is
`cuestack:draft:{identity}:{lessonId}`. **With no author identity supplied, the memory keeper is
selected**, so nothing durable is written at all.

**Rationale.** FR-029a asks for two things that look like they need a flag: keep working through an
interruption, but offer nothing on reopening. Selecting the keeper's *kind* from the presence of an
identity delivers both without one. Nothing durable exists, so nothing can be offered, and nothing
can leak to the next person at a shared classroom machine — the guarantee is structural rather than
a check in a code path that could be forgotten or reordered.

FR-029b — that the identity never enters the manifest, storage, or analytics — is then easy to
assert, because the only place it appears is a key string.

**When it writes, and why not more often.** On the same schedule a save is attempted on, plus once
when the page is being hidden or unloaded with changes outstanding — never on every change. This was
a correction. `localStorage` is synchronous and the write is the whole manifest, and
`inspector/Field.tsx` commits on every `onChange`, so keeping per change would put a 300-element
lesson's serialization between a key press and the character appearing. Constitution IV calls those
budgets acceptance criteria rather than aspirations, and offline is exactly when a teacher least
wants the editor to feel worse.

The residual window is honest and small: up to one interval of the newest edits, closed in the
ordinary case by the unload flush.

**The hidden signal comes through `VisibilityPort`, not a raw listener.** That port already exists in
`core/ports`, already has a browser implementation inside `browserPorts()`, and already says exactly
what is needed — is the document hidden, and tell me when that changes. Using it makes the flush
injectable, so a test triggers it by flipping a fake rather than by dispatching a DOM event, which is
what Constitution II asks for and what every other timing seam in this feature already does. A raw
`pagehide` listener is kept beside it for the case the port does not model; probing confirmed both
pass the studio's lint rules, so this is a determinism choice rather than a forced one. A synchronous write is a feature there — an asynchronous store
cannot be relied on to finish while the page is going away, which is one of the two reasons
IndexedDB was rejected below.

**`write` returns a result.** `QuotaExceededError` is a real outcome for a whole-manifest write, and
the page may be denied storage entirely. A `void` write would lose the work while the editor said it
was being kept, which is worse than not keeping at all — so the teacher is told (FR-024c).

**Alternatives considered.** `sessionStorage` for the no-identity case — survives a refresh, which
is precisely what must not happen without an identity. IndexedDB — asynchronous, and the write has
to happen reliably before an interrupted save, where synchronous is a feature. A single durable
keeper with an "offer" flag — one boolean between a draft and a stranger.

---

## R-09 — Connectivity is inferred from save outcomes, with the browser's signal as an accelerator

**Decision.** A `Connectivity` port mirroring `VisibilityPort` — `isOnline()` and
`subscribe(listener)` — declared in `packages/core/src/ports/connectivity.ts` and implemented over
`navigator.onLine` and the `online` / `offline` events in `@cuestack/react`, beside the scheduler. The Offline state is entered when a save fails with `unavailable`, and the
port's signal is used to retry immediately rather than waiting out the backoff.

**Rationale.** `navigator.onLine` reports whether there is a network interface, not whether the
host's API answers, so trusting it as the source of truth would show Offline on a captive portal
and Saved-pending on a dead backend. The save outcome is the only authority on whether saving
works. The signal is still worth having: it turns "the connection came back" from something
discovered up to two minutes late into something discovered at once, which is FR-025's "without the
teacher asking."

Mirroring `VisibilityPort` deliberately — the shape is already in `core/ports`, already has a
browser implementation and a test double pattern, and a second port that looks different for no
reason costs a reader more than it saves a writer.

**Alternatives considered.** Trusting `navigator.onLine` alone — wrong on the two failure modes that
matter. Polling a health endpoint — costs requests to learn what the next save would say anyway,
and there is no endpoint to poll: the framework knows only an adapter.

---

## R-10 — Undo shortcuts bind above the canvas, and text fields keep the platform's own undo

**Decision.** A pure `historyIntentFor(chord)` in `history/shortcuts.ts` and a
`useHistoryShortcuts({ session, target })` hook the host attaches to its editor root. The hook
ignores events whose target is an input, textarea, or contenteditable, leaving the browser's native
undo to the text surface. `canvas/shortcuts.ts` and `intentFor` are not touched.

**Rationale.** Undo has to work when focus is in the inspector or the timeline, and the studio has
no root component of its own — it exports parts a host composes, which is the same fact feature 007
ran into when `inert` turned out to be unimplementable. So the binding must be something the host
attaches, and a hook is the smallest thing that can be.

Leaving `intentFor` alone avoids a double-handling bug that would be hard to see: it is called by
`Overlay`'s keydown listener, so adding undo there and binding at the root as well would give one
keystroke two reversals whenever the canvas had focus.

Text fields keeping native undo is the behaviour every editor has, and the alternative is worse than
it sounds: the session's history has one entry for a committed text edit, so an editor-level undo
mid-typing would discard the whole paragraph rather than the last word.

**Alternatives considered.** Extending `intentFor` — the double-handling above. A global `document`
listener inside the studio — steals keystrokes from a host's own surfaces, and the studio does not
own the document.

---

## R-11 — The three confirmations are deleted, and their suites become reversibility suites

**Decision.** `canvas/DeleteConfirmation.tsx` and `sequence/CustomConfirmation.tsx` are deleted with
their exports; the inline prompt in `effects/EffectControls.tsx` is removed. `Overlay` applies the
delete directly. The tests that exercised them are rewritten in place to assert that the action
happens immediately and that one undo takes it back.

**Rationale.** Each of the three carries a comment naming ED-5 as its replacement, and one of them
states the rule this decision follows: "A tool that both confirms and undoes every deletion is one
that has stopped trusting its own history." Constitution III accepts confirmation *or* undo; keeping
both is not extra safety, it is a prompt teachers learn to dismiss without reading, which costs
safety everywhere else it appears.

Rewriting rather than deleting the tests is the part worth stating. `canvas/delete.test.tsx`,
`sequence/custom.test.tsx`, `keyboard/actions.test.tsx`, `keyboard/focus.test.tsx`, and
`a11y/axe.test.tsx` all touch these surfaces, and what they were really asserting was that a
destructive action cannot happen by accident. That requirement survives; only its mechanism
changes. Deleting the tests along with the components would quietly drop the requirement with them.

**Alternatives considered.** Keeping the delete confirmation behind an option — an option nobody
sets is dead code, and one somebody sets is the tool that both confirms and undoes. Deprecating for
a release — there are no published consumers to protect, and the studio is at `0.0.0`.

---

## R-12 — Restore is a nineteenth `Edit` kind, not a session method

**Decision.** `replace-draft` joins `EDIT_KINDS` and gains a case in `applyEdit`. The restore flow
calls `session.apply({ kind: 'replace-draft', manifest })` like any other change. There is no
`replaceDraft` method on the session.

**Rationale.** The first plan gave the session a `replaceDraft(manifest)` and called it "an ordinary
recorded change". It would not have been one. `applyEdit` is where four guarantees live — the
read-only refusal that covers the whole union before anything else runs, the post-edit schema
validation, the purity, and the clone — and a method beside it inherits none of them. R-01's whole
argument for putting history inside the session is that "there is no change that is not `apply`";
a second write path makes that sentence false on the day it lands.

The content this path carries is also the content most likely to be invalid. A restored version was
written by an earlier release, possibly under an earlier format, and `loadVersion` returns whatever
the host has. Skipping validation on the one input that did not come from the editor's own reducer
is precisely backwards — feature 005's promise is that "the editor cannot construct a lesson the
player would refuse", and a restore that bypassed the validator would be the first way to do it.

Making it a kind buys three things for one case statement: the read-only refusal (a teacher reading
a lesson cannot restore over it), the validation, and membership of the closure guarantee feature
005's SC-017 asserts — the read-only suite enumerates `EDIT_KINDS`, so the nineteenth kind is
refused-by-default and fails a test until someone says otherwise deliberately.

**Alternatives considered.**

- *A session method with the three guards written by hand.* Three restatements of rules that already
  exist in one place, and the closure test would not see it at all.
- *Reloading the editor at the restored version instead of editing into it.* Discards the history and
  the session, so FR-041's "reversible by the same single action every other change is" could not
  hold — and it would make a restore the one change a teacher cannot walk back.

**One frame, two entry points — and this is the part that needed reading twice.** `applyEdit` binds
`const next = clone(draft)`, looks the slide up in it, and hands both to `dispatch`, which mutates
them in place. A kind that *replaces* the whole manifest cannot be a case in `dispatch`: there is no
way to rebind `next` from inside it. And `slideOf(next, ctx.slideId)` runs before dispatch, so a
stale slide id would refuse an edit that is about to discard that slide anyway.

So `replace-draft` branches inside `applyEdit` itself, immediately **after** the blanket read-only
refusal and **before** the clone and the slide lookup: clone the incoming manifest, run the same
`validate(next)` the frame already runs, return the same shape. Two entry points into one frame,
not two write paths — the distinction that matters is that both go through the same refusal and the
same validator, which is the whole of R-12's argument. The alternative, changing `dispatch` to
return a manifest rather than mutate, would rewrite eighteen working cases to accommodate a
nineteenth.

**Consequence to carry.** `EDIT_KINDS` goes from eighteen to nineteen. `test/draft/read-only.test.ts`
enumerates it and asserts every variant is refused, and `test/draft/validity-sweep.test.ts` and
`test/session/clipboard.test.ts` both read it. All three must be updated in the same change, which
is the closure working rather than the closure being inconvenient.

`validity-sweep.test.ts` needs one thing said explicitly: it is a **seeded random walk** that
synthesises a sample edit per kind and asserts none of them yields an invalid manifest. The sample
for `replace-draft` must carry a *valid* manifest from the corpus. Handing it an invalid one would
make the file assert the opposite of what its header claims, and the refusal case belongs in the
kind's own suite where a refusal is the expected result.

---

## R-13 — A checkpoint's time is formatted with `Intl`, because `Date` is unavailable

**Decision.** `VersionHistory` formats `recordedAt` with `Intl.DateTimeFormat().format(ms)`, which
accepts a timestamp number directly. Absolute times only; no "2 hours ago".

**Rationale.** Probed against the actual lint configuration: `new Date(recordedAt)` inside
`packages/studio/src` fails `no-clock-in-studio` with "Unexpected use of 'Date'", because the rule
restricts the global rather than a particular call. `Intl.DateTimeFormat` passes — it is not a clock
and it reads none.

This is worth recording rather than leaving to discovery, because the natural first attempt at FR-037
is `new Date(entry.recordedAt).toLocaleString()` and it fails a gate rather than a test, which is a
slower and more confusing way to learn it. R-03 claims this feature needs no exemption from that
rule; this is the second place that claim had to be checked, and it holds.

**Relative times are out.** "2 hours ago" needs a *now*, and the only now available to the studio is
`Scheduler.now()` — which is a monotonic reading for scheduling, not a wall-clock time, so it cannot
be differenced against an epoch stamp. A relative label would need a second time source in the
editor, which is the thing the rule exists to prevent.

**Alternatives considered.** Passing a formatter down from the host — correct, and more ceremony than
a list of dates deserves; a host that wants its own format can already wrap the component. Formatting
in the adapter — puts presentation behind a data boundary.

---

## R-14 — The framework migrates on load; the host stores what it was given

**Decision.** Every manifest arriving from storage — `loadDraft` on open, `loadVersion` on restore —
passes through `migrate()` from `@cuestack/schema/migrate` before it becomes the draft. A manifest
that cannot be brought forward is reported and not loaded. Hosts are not asked to know about
`schemaVersion` at all.

**Rationale.** This is the eighth member of the pattern, and the sharpest instance of it.
`migrate()` has existed in `@cuestack/schema` since Wave 1 and **has no consumer anywhere in the
repository** outside its own tests — after `ElementPlugin.inspector`, `EffectDescriptor.parameters`,
`RenderState.problems`, `ResolveContext.effects`, `AdvanceControllerOptions.allowOverride`,
`Ports.assets`, and `Ports.storage`. It has had none because nothing has ever loaded a lesson it did
not itself construct. ED-5 is the first thing that does, twice.

The question is not academic once R-12 lands. Restoring a version now goes through `applyEdit`,
which validates against the **current** schema — so a version written six months ago under an
earlier format would be *refused* rather than brought forward, and the refusal would look like data
corruption to a teacher whose lesson is perfectly intact. Migration has to happen before `apply`
sees it, which puts it in the persistence layer rather than in the reducer.

Putting it in the framework rather than the host follows the argument EN-6 already made for the
conflict token: a rule enforced at the boundary is a property of the framework, and a rule left to
each host is a hope about each host. A host implementing `saveDraft` and `loadDraft` over its own
API should not have to learn what a `schemaVersion` is.

Constitution I ties the two together from the other side: "any change to the lesson manifest MUST
bump `schemaVersion` and ship a migration function in the same change." That obligation has been
kept for six features, and this is the first one where the migrations have somewhere to run.

**Alternatives considered.**

- *Migrate inside `applyEdit`'s `replace-draft` case.* Puts a schema concern in the reducer, and
  would silently migrate on a path where the teacher should be told what happened.
- *Ask each host to migrate.* Every host reimplements it, and a host that forgets produces a refusal
  that reads as corruption.
- *Refuse anything not at the current version.* Makes version history useless the first time the
  format changes, which is the feature's whole point.

**Scope note.** Migration on the *open* path (`loadDraft`) is in scope here because the recovery
comparison already calls it. Whether the host's own initial `manifest` prop is migrated stays the
host's business — that manifest did not come through this boundary.

---

## R-15 — Recovery asks whether work exists, not whether it is newer

**Decision.** The recovery offer is triggered by kept work *existing*. Whether the stored lesson has
moved on is a second, separate question — answered by comparing the kept token with the one
`loadDraft` returns — and it changes what the offer *says*, not whether it appears.

**Rationale.** FR-027 originally read "newer than what storage returns", and there is nothing to
compare it with: kept work carries a lesson id, a manifest, and a token, and deliberately no
timestamp — a timestamp would need a clock the studio may not read, and would be the teacher's clock
rather than the storage's. What makes the comparison unnecessary is FR-028: kept work is cleared the
moment storage acknowledges it, so work still present is by definition work storage has not got.
Existence *is* the comparison, already performed.

The token comparison earns its place separately. If someone else saved while this teacher's work sat
unkept, restoring is not recovery — it is choosing between two versions, and a prompt that said
"we found unsaved work" without mentioning that would be misleading at the moment it matters most.
So the offer names it.

**What happens next needs no new machinery, which is the good sign.** A teacher who restores in that
situation holds a manifest built on a superseded token; the first save is refused, and the conflict
notice they meet is the one US4 already builds. Recovery blocks and is answered before the lesson
opens; the conflict does not block and stands until they answer it (R-16). The two
compose without a third path — the case simply had nobody looking at it, because it lives in the
intersection of two stories rather than in either.

**Alternatives considered.**

- *Stamp kept work with a time and compare.* Needs a clock the studio cannot read, compares two
  machines' clocks, and answers a question FR-028 has already answered.
- *Treat the moved-on case as a conflict before the lesson opens.* Would make the teacher resolve a
  conflict against a draft they have not seen yet, and R-16's whole argument for a non-blocking
  conflict is that the work should be in front of them when they decide.


---

## R-16 — Recovery interrupts; a conflict does not

**Decision.** The recovery choice is answered before the lesson opens for editing. A conflict is a
persistent, non-dismissible notice the teacher can leave standing while they keep working, with
autosave stopped until they answer it.

**Rationale.** Recorded here late, and that is the reason it needed writing down: the decision was
taken in clarification and lived only in the spec's Assumptions and in the plan's summary, so two
citations in R-15 pointed at R-11 — which is about deleting the three confirmations — and sent a
reader to the wrong page. A decision every other artifact leans on should be findable where the
other decisions are.

The two situations look alike and are not. Recovery happens before there is a lesson on screen, and
the editor cannot render one until it knows which copy it is rendering — so asking first costs
nothing, and showing either copy before the teacher has chosen would be the silent application
FR-027 forbids. A conflict happens with an hour of the teacher's work already in front of them, and
a dialogue standing between them and it is the most reliable way to make that work disappear: people
dismiss what blocks them, and they dismiss it fastest when they are mid-thought. The answer there is
to stop *saving*, not to stop *working* (FR-027a, FR-032a).

**What it buys downstream.** R-15's moved-on case — kept work whose stored lesson has since changed
— composes out of these two behaviours with no third path: the teacher answers the blocking recovery
offer, restores, and meets the ordinary non-blocking conflict on the first save. A design that
blocked on both, or neither, would have needed a special case for it.

**Alternatives considered.** Both blocking — the editor is never in an unresolved state, and the
teacher meets a modal dialogue over work they cannot see. Neither blocking — recovery would have to
render one copy while asking which copy to render.
