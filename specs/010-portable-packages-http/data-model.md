# Data Model: Portable Packages and the HTTP Adapter

## 1. The line, restated

| Kind | Lives where | Written | Changes after it exists |
|---|---|---|---|
| Lesson package | nowhere — produced and consumed | never by the framework | n/a, it is a value |
| Package manifest entry | inside the package | with the package | never |
| Operation mapping | the host supplies it | the host's business | whenever the host's API does |
| Request context | per request, held by nobody | never | n/a |

Features 005, 008, and 009 drew this table for session state, authored data, and published versions.
This feature adds nothing to the framework's *stored* state at all — which is the point. A package is
a value in flight, and the adapter holds a description of somebody else's API. Neither is state this
framework owns.

---

## 2. `LessonPackage`

One JSON document. The shape is fixed by the framework and identical whoever produced it (FR-004a).

| Field | Type | Required | Notes |
|---|---|---|---|
| `packageVersion` | `string` | yes | This document's format version, not the lesson's |
| `schemaVersion` | `string` | yes | The lesson format version the manifest was written under |
| `kind` | `'draft' \| 'published'` | yes | What it was at the moment of export (FR-004) |
| `assetMode` | `'references' \| 'files'` | yes | Which mode produced it (FR-006a) |
| `lesson` | `LessonManifest` | yes | The manifest itself, unmodified |
| `assets` | `readonly PackagedAsset[]` | yes | Empty is legal; the inventory is always present |

**`packageVersion` and `schemaVersion` are separate on purpose** (FR-003). They change for different
reasons — a new element type moves the lesson format; a new package field moves this one — and a
document that conflated them could not describe a future in which either moved alone.

**`kind` exists because a package cannot be asked what it was.** A reader holding a manifest cannot
tell whether it was a live draft or a version learners received, and a package that claimed the
second while carrying the first is a lie a teacher has no way to detect.

**Note what is absent**: no exporter identity, no timestamp, no host address, no storage token.
Every one of them would be either a credential-adjacent leak (FR-005) or a value that goes stale
against the manifest beside it. A teacher taking a copy is not an audit event.

---

## 3. `PackagedAsset`

| Field | Type | Required | Notes |
|---|---|---|---|
| `assetId` | `string` | yes | The identity **the exporting system used** |
| `mediaType` | `string` | yes | Stored, never inferred |
| `content` | `string` | files mode only | The bytes, Base64 |

**Each distinct asset appears once** however many elements reference it (FR-009). The inventory is a
set of assets, not a list of references.

**`mediaType` is stored because it cannot be recovered.** An asset id says nothing about what the
bytes are, and a reader that guessed would guess wrong on the first file without an extension.

**`content` is Base64 *inside the document only*.** Across both API boundaries asset content is
`Uint8Array`: the content provider hands export bytes, and reading a package hands bytes back
decoded. Encoding is the format's business — a caller that had to do it would be reimplementing half
the format in order to use it, and would become the second place an encoding mistake could live
(FR-006e).

**In reference mode `content` is absent, and that is not a degraded files-mode package** — it is the
default, and `assetMode` says so at the top of the document so a reader knows before it reaches here.

---

## 4. `ImportedPackage` — what reading a package yields

Reading is separable from producing the lesson (FR-014a), so there is a value in between.

| Field | Type | Notes |
|---|---|---|
| `packageVersion` | `string` | As declared |
| `schemaVersion` | `string` | As declared — a claim, validated later (FR-013) |
| `kind` | `'draft' \| 'published'` | As declared |
| `assetMode` | `'references' \| 'files'` | As declared |
| `assets` | `readonly ImportedAsset[]` | `{ assetId, mediaType, content?: Uint8Array }` — decoded, so the host stores bytes rather than text it would have to decode itself |

**This is the step where a host meets a failure it can still act on.** It learns what the package
contains and can store the assets, or refuse them, *before* it has a lesson to save — so the
"lesson referencing an asset that was never stored" outcome is unreachable by ordinary use rather
than merely discouraged.

Note what it does **not** carry: the lesson. Producing that is the second step, and it needs the
mapping the first step's assets made possible.

---

## 5. `AssetIdMapping`

`ReadonlyMap<string, string>` — the identity the package used, to the identity the host stored it
under.

**Supplied by the host because only the host knows.** Most asset stores mint their own identifiers,
and asking the framework to preserve one is asking it to have a feature many stores do not.

**An asset the mapping omits keeps its original reference and is reported unresolved** (FR-014c).
Not dropped, because deleting a teacher's image because a store refused it is a worse answer than
telling them; and not silently kept, because a reference nobody can follow is the failure this
mapping exists to prevent.

---

## 6. `ImportResult`

| Field | Type | Notes |
|---|---|---|
| `lesson` | `LessonManifest` | Carrying the caller's identity, not the package's (FR-015a) |
| `migrated` | `readonly string[]` | The migration steps applied; empty when none were (FR-011) |
| `unresolvedAssets` | `readonly string[]` | Referenced, and not in the mapping |
| `issues` | `readonly ReportIssue[]` | From `checkLesson`, against the caller's registry; never a reason to refuse (FR-017) |

**`issues` reuses feature 009's report type** rather than inventing a second vocabulary for the same
question. A lesson that arrives with problems is a lesson to be fixed, and the teacher should meet
those problems in the panel they already know.

**The registry is the caller's, and omitting the option is a trap rather than a default.** A
supplied registry *replaces* the default rather than extending it (feature 009, research R-13), so a
host with custom element types that could not pass one would see every custom element reported as an
unknown type — a lesson described as broken because the reader had been told about seven types
(FR-017a). Composing is the host's job: `createElementRegistry([...builtinElements, mine])`.

**A failure produces no `ImportResult` at all** — refusals are a separate result shape carrying what
was wrong. There is no half-populated success.

---

## 7. `PackageRefusal`

Why a package was not read. Each is a different sentence to a person.

| Reason | Meaning |
|---|---|
| `too-large` | Beyond the size bound, refused before parsing (FR-016a) |
| `too-deep` | Beyond the nesting bound |
| `unreadable` | Not JSON, truncated, or not shaped like a package |
| `package-version-unsupported` | This reader is too old for it (FR-012) |
| `lesson-version-unsupported` | `migrate` refused it — its issues are carried through |
| `unsafe-address` | An address-bearing field carried an executable scheme (FR-016b) |

**`lesson-version-unsupported` carries `migrate`'s own issues rather than restating them.** That
function already distinguishes newer from older and says so well; a second message would be a second
opinion about the same fact.

---

## 8. `OperationMapping` — the adapter's side

Per operation: how to build a request. The adapter performs it and interprets the result.

| Part | Supplied by | Notes |
|---|---|---|
| Request description | the host, per operation | method, address, headers, body |
| Credentials | the host, per request | never stored, cached, refreshed, or logged (FR-020) |
| Cancellation | the caller, per request | so nothing is stuck reporting Saving (FR-026) |
| Response classification | the adapter, host-overridable | status → one of four outcomes |

**The mapping is supplied whole at construction** (FR-019a), so an operation nobody described is
found before a teacher relies on it rather than an hour into their work.

**The four outcomes are the load-bearing part.** `permission`, `not-found`, `conflict`,
`unavailable` — a caller that cannot tell these apart cannot say anything useful to a teacher, and
feature 009's publish flow already branches on exactly this distinction.

**What the framework cannot check**: whether the host's classification is *correct*. A mapping that
reports a conflict as a plain failure will cause a save to overwrite somebody's work, and no
assertion here can catch it. [contracts/http-operations.md](./contracts/http-operations.md) states
that in the place a host implementing it will read.
