# Contract: the storage boundary, extended

`StorageAdapter` is the only place lesson data leaves the framework. It has been defined since EN-6
and called by nothing; ED-5 is its first consumer, and using it is what found the three gaps below.

Everything here is **additive**. Nothing in the lesson manifest changes, so no `schemaVersion` bump
and no migration follow.

---

## 1. What is unchanged

```ts
type VersionToken = string          // opaque; not a timestamp
loadDraft(lessonId): Promise<LoadResult>
saveDraft(lessonId, manifest, token): Promise<SaveResult>
```

`SaveResult`'s conflict case and the mandatory `token` argument stay exactly as EN-6 wrote them, and
the reason stays as its comment states it: "a host cannot accidentally implement last-writer-wins,
because there is nowhere to put the token that isn't the check."

Every method still returns a result rather than throwing. That was always the right call for an
editor that autosaves, and this feature is what makes it load-bearing: `useDraftPersistence` decides
between Offline, Save Failed, and a conflict notice purely from the returned `reason`.

---

## 2. Addition one — a save may declare itself a checkpoint

```ts
interface SaveOptions {
  /** Record this save in the version history. Absent means an ordinary autosave. */
  readonly checkpoint?: { readonly label?: string }
}

saveDraft(lessonId, manifest, token, options?): Promise<SaveResult>
```

**Why the framework decides and the host records.** The clarification separated two things the old
interface conflated: the version the editor holds, which must advance on every save so a conflict is
detectable, and the version a teacher browses, which must not, or an hour's work becomes hundreds of
indistinguishable rows. Only the framework knows which saves are checkpoints — it owns the policy in
`persistence/schedule.ts` — and only the host can record one.

**What a host must honour.**

- Every `saveDraft` advances the token, checkpoint or not.
- A save with `checkpoint` present adds exactly one entry to what `listVersions` returns.
- A save without it adds none — **but is still saved**. An ordinary autosave must reach storage and
  must be what `loadDraft` returns afterwards; it is absent from the history, not absent from
  storage (FR-035c). An adapter that treated a non-checkpoint save as a no-op would pass every
  history test and lose an hour of work.
- A label, where given, is stored verbatim and returned by `listVersions`.

**Backward compatible.** An optional fourth parameter. An adapter written against EN-6 keeps
compiling and keeps working; it simply records no checkpoints, and the teacher sees an empty history
rather than a broken editor.

---

## 3. Addition two — an entry says when it was recorded

```ts
interface VersionEntry {
  readonly token: VersionToken
  readonly versionNumber: number
  /** Epoch milliseconds. The host's clock, never the framework's. */
  readonly recordedAt: number
  /** Present only when the teacher named this checkpoint. */
  readonly label?: string
}

listVersions(lessonId): Promise<readonly VersionEntry[]>
```

`VersionSummary` is renamed to `VersionEntry` — it now describes a checkpoint rather than a save,
and a summary of nothing is a poor name for it.

**`recordedAt` is the host's, and that is a rule rather than a convenience.** The host's storage is
the only participant with an authoritative clock; a framework-side stamp would disagree between two
browsers and could be moved by a system clock adjustment. It is also the only workable answer:
`no-clock-in-studio` forbids the editor from reading a clock at all, and `VersionToken`'s own
comment already refuses timestamps as tokens for the related reason — "that needs synchronised
clocks and reintroduces nondeterminism."

**What a host must honour.** Entries are ordered by `versionNumber`; `recordedAt` is
non-decreasing across them; both are stable for a given token forever. Listing does not require
loading any version's content.

---

## 4. Addition three — an earlier version's content can be fetched

```ts
loadVersion(lessonId, token): Promise<LoadResult>
```

**Why it must exist.** FR-DAT-009 asks a teacher to restore an earlier draft version, and the
interface could list versions and load only the current draft. The requirement was unimplementable
against the boundary as it stood — not difficult, unimplementable. This is the gap FR-038 records.

**Shape.** `LoadResult`, unchanged, so a caller handles `not_found`, `unauthorized`, and
`unavailable` exactly as it already does for `loadDraft`. The `token` it returns is the **current**
draft's token, not the loaded version's: what comes back is content to be saved forward as a new
version (FR-DAT-010), and returning the old token would make the very next save look like a
conflict.

That last sentence is the whole of why restoring is additive rather than destructive, and it is the
easiest thing in this contract to get subtly wrong.

---

## 5. What restore does, in adapter terms

```text
loadVersion(lessonId, chosenToken)      → { manifest, token: currentToken }
saveDraft(lessonId, current, token, { checkpoint: {} })   // FR-042: the state being left
session.apply({ kind: 'replace-draft', manifest })         // validated, refusable, reversible
saveDraft(lessonId, manifest, newToken, { checkpoint: { label } })
```

The third line goes through `apply` rather than a session method of its own, and that is the whole
of FR-039a: the manifest arriving here was written by an earlier release and returned by a host, so
it is the one input in the system that did not come from the editor's own reducer. It is validated
before it becomes the draft, refused in read-only, and recorded as one reversal step — see
[history-contract.md §0](./history-contract.md) and research R-12.

**A refused restore leaves everything alone.** The checkpoint on line two has already been taken,
which is correct: the state being left is in the history whether or not the restore succeeds.

Two checkpoints, in that order. The first is what makes FR-042 true — the state the teacher is
leaving is itself in the history, so a restore they regret is one they can walk back through the
history as well as through undo. No entry is ever removed, which is FR-DAT-010 and BR-008/BR-009:
published versions are untouched because this boundary only ever addresses drafts.

---

## 5a. Who migrates

**The framework, on the way in. The host stores what it was given, byte for byte.**

`loadDraft` and `loadVersion` both return whatever the host has, which for an old version may
predate the current format. The persistence layer passes it through `migrate()` from
`@cuestack/schema/migrate` before anything else sees it (FR-050). A manifest that cannot be brought
forward is reported to the teacher, naming the lesson, and is not loaded.

**A host is never asked what a `schemaVersion` is.** That is the same argument EN-6 made for the
conflict token: a rule enforced at the boundary is a property of the framework, and a rule left to
each host is a hope about each host.

**This matters more since restore became an `Edit` kind.** `applyEdit` validates against the current
schema, so an unmigrated old version would be *refused* — and the refusal would look like data
corruption to a teacher whose lesson is intact. Migration therefore happens in the persistence layer,
before `apply` sees it, and never inside the reducer.

`migrate()` has had no consumer anywhere in the repository until now, because nothing has ever loaded
a lesson it did not itself construct. This boundary is the first thing that does.

---

## 6. The in-memory reference

`createMemoryStorage()` implements all three additions, and gains an injected `now` so its
`recordedAt` is deterministic in tests:

```ts
createMemoryStorage(options?: { now?: () => number })
```

This is product, not scaffolding — FR-048 requires the whole feature, conflict and recovery and
history included, to be exercisable with no host backend. The reference already issues real
incrementing tokens and genuinely rejects stale saves; it now genuinely records checkpoints and
genuinely serves old versions, so a host implementing the interface has a working example of every
path rather than of three of five.

---

## 7. What this contract does not add

- **No delete.** FR-DAT-010 makes history additive; an interface that can remove an entry is one a
  host can be asked to remove an entry with.
- **No merge.** Conflicts are refused, not reconciled (spec §19, and the spec's own assumption about
  why a blind overwrite is not offered).
- **No pruning.** How long a host keeps checkpoints is the host's business, and a framework that
  decided it would be deciding a retention policy for data it does not hold.
- **No author identity.** It scopes locally kept work and nothing else, and never crosses this
  boundary (FR-029b).
