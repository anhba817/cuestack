# Contract: the fourth adapter, and why immutability is structural

`PublishingAdapter` joins `StorageAdapter`, `AssetAdapter`, and `AnalyticsAdapter`. It is a new
boundary rather than six more methods on an existing one, and the separation is what lets BR-008 be
a property of the interface instead of a rule somebody remembers.

---

## 1. Why a fourth adapter

`StorageAdapter` is at four methods after ED-5. Six more takes it to ten and mixes two opposite
lifetimes in one interface: **a draft that changes every 1.5 seconds, and a version that must never
change again.** EN-6 divided adapters by capability rather than by subject, and publishing is a
capability a host may genuinely not have — an editor embedded in an LMS that publishes through its
own workflow needs storage and no publishing at all.

The split also makes the guarantee visible. In a file containing only publish, read, withdraw, and
the record, the absence of an update method is something a reader notices. In a file of ten methods,
six of which write, it would be a convention waiting to be broken by somebody in a hurry.

This is EN-6's own argument about the conflict token, applied again: "putting that in the *interface*
rather than in each implementation is what makes it a property of the framework instead of a hope
about the host's endpoint."

---

## 2. The interface

```ts
interface PublishingAdapter {
  publish(lessonId, manifest, by): Promise<PublishResult>
  listPublished(lessonId): Promise<readonly PublishedVersion[]>   // newest first
  loadPublished(lessonId, versionId?): Promise<LoadPublishedResult> // active when no id
  withdraw(lessonId, by): Promise<ActionResult>
  restore(lessonId, by): Promise<ActionResult>
  readRecord(lessonId): Promise<readonly RecordEntry[]>            // oldest first
}
```

Every method returns a result rather than throwing, for the reason EN-6 gave and ED-5 relied on: a
refusal is an expected condition, not an exceptional one. A host without permission, an unreachable
service, and a lesson nobody published are all ordinary answers.

**`by` is the host's identity for whoever is acting.** The framework does not know who anybody is and
does not decide what they may do — it asks by attempting, and the adapter answers (FR-032a). A
`permission` refusal is one of the results, and the framework's job is to say so plainly rather than
to have prevented the attempt.

Note this is a *different* identity from ED-5's author handle, which scopes locally kept work and
deliberately never crosses a storage boundary. A publication record is meant to leave.

---

## 3. What is deliberately absent

- **No `updatePublished`.** BR-008. The capability does not exist rather than being guarded.
- **No `deletePublished`.** FR-030 — withdrawal is not deletion, and an interface that can destroy a
  published version can be asked to.
- **No way to edit the record.** FR-034. An interface that can rewrite history can be asked to.
- **No `setActive(versionId)`.** Publishing makes the newest version active and withdrawal clears it;
  an arbitrary pointer move would let a host make an old version active without a record of doing so.

A host must be able to honour all four absences. An adapter that offers these operations through its
own API is free to; what it must not do is offer them *here*, because this is where the framework's
guarantee is expressed.

---

## 4. Immutability, twice

**The absent method is the guarantee. The freeze is what catches the honest mistake.**

`loadPublished` returns a deeply frozen manifest. A host that hands the same object to a renderer
which mutates it in place would violate BR-008 without writing anything that looks like a violation —
and this framework ships a renderer that takes manifests, so that is not hypothetical.

Freezing is affordable here in a way it would not be for a draft: a published version is read rarely,
where a draft is resolved sixty times a second. The draft is deliberately not frozen.

---

## 5. Active, withdrawn, and not found are three answers

```text
loadPublished(lessonId)  ->  { ok: true, version }
                         |   { ok: false, reason: 'withdrawn' }
                         |   { ok: false, reason: 'not_found' | 'unauthorized' | 'unavailable' }
```

**`withdrawn` and `not_found` must be distinguishable** (FR-029a). A host that cannot tell them apart
will show a learner "this lesson does not exist" about a lesson that plainly does, which is the kind
of message that produces a support ticket rather than an understanding.

**The framework never interrupts a learner mid-lesson** (FR-029b). It cannot know which kind of
withdrawal this is: a lesson withdrawn because it teaches something wrong should stop everyone
immediately, and one withdrawn because term ended should let the class finish. Nothing in a manifest
says which, so the framework makes the state discoverable and leaves the judgement with whoever has
the context.

---

## 6. What publishing does, in order

```text
1. saveNow()                     // FR-018a — and publish only if it lands
2. checkLesson(manifest, policy) // FR-015 — freshly, never a cached report
3. if any error -> refuse, naming them, changing nothing
4. checkAssets(collectAssetRefs(manifest), assets)
5. if any unresolved -> refuse, naming them (BR-018, FR-016)
6. publish(lessonId, manifest, by)
7. if refused -> say which of permission, conflict, or unreachable
```

Steps 1 and 3–5 all end in "changing nothing", and FR-017 makes that a requirement rather than a
consequence: a refused publish leaves the draft byte-identical. SC-012 measures it across all four
refusal paths.

**Step 2 does not trust an earlier report.** The draft may have moved since one was produced, and a
report is cheap. Trusting a stale one is how a lesson gets published with the error it was shown to
have.

**Step 1's failures are not step 3's failures.** An unreachable storage, a permission refusal, and an
unanswered conflict are all reasons a publish does not happen, and none of them is about the lesson.
The message must distinguish them, or a teacher goes looking for a validation problem that is not
there.

---

## 7. The in-memory reference

`createMemoryPublishing()` implements all six methods, freezes on read, refuses to alter the record,
and takes an injected `now` so `publishedAt` is deterministic in tests — the same shape ED-5
established for `createMemoryStorage`.

Product, not scaffolding. FR-037 requires the whole feature — validation, refusal, publication,
withdrawal, and the record — to be exercisable with no host backend, so a host implementing this
interface has a working example of every path rather than of four of six.
