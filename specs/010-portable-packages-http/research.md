# Research: Portable Packages and the HTTP Adapter

Phase 0. Every decision below was checked against the code rather than recalled, and where checking
changed the answer that is said plainly.

---

## R-01: Where export and import live

**Decision.** `packages/core/src/packaging/`, inside `@cuestack/core`. Not a new package, and not
`@cuestack/schema`.

**Rationale.** The work needs three things that already exist, and they are not in one place:
`validate` and `migrate` are in `@cuestack/schema`, and **`collectAssetRefs` is in
`@cuestack/core`** — feature 009 built it to find every asset a lesson references. Core depends on
schema, so core is the only package that can reach all three. Putting packaging in schema would mean
either duplicating the asset walk or having schema depend on core, which `no-core-in-schema` forbids
in CI.

Reusing `collectAssetRefs` is not merely convenient. FR-014d requires reference rewriting to "cover
every place an asset identity can appear, not a list of the places it appears today", and
`collectAssetRefs` already walks the payload for `assetId` keys at any depth rather than naming
paths — its own header records that `assetId` appears at three depths already and that a list of
paths would go stale.

**Alternatives considered.** A fifth package, `@cuestack/package` — rejected: two pure functions do
not need a package, and it would have to depend on core for the asset walk anyway, so the boundary
would buy nothing. `@cuestack/schema` — rejected on the dependency direction above.

---

## R-02: Who obtains asset content for a files-mode export

**Decision.** The caller supplies it, through a content provider the caller passes in. The framework
never fetches.

**Rationale.** `AssetAdapter.resolve(assetId)` returns `{ url }` — an address, not bytes. Turning an
address into bytes is a network fetch, and FR-030 forbids the framework from reaching the network
except where the operation is defined by doing so. Export is not defined by doing so; it is defined
by producing a document.

More importantly the host is the only participant that *can* do it correctly. Its assets may be
behind a signed URL, on a filesystem the server can read, or already in memory. A framework that
fetched would be guessing at all three, and would need credentials it is forbidden to hold (FR-020).

This also makes files-mode export testable with no network, which is the same property R-08 gives the
HTTP adapter.

**Reading of FR-006c.** "Files-mode export MUST fail, naming the asset, when any asset's content
cannot be obtained" is satisfied by the provider returning nothing for an asset. The obligation is
on export to fail loudly, not on export to do the fetching.

**Alternatives considered.** Export fetches from `AssetAdapter` URLs — rejected: needs the network,
needs credentials, and would silently succeed against a public CDN while failing for every host with
private assets, which is the worst possible distribution of failure.

---

## R-03: The serialized form

**Decision.** One JSON document with a fixed top-level shape, defined in
[contracts/package-format.md](./contracts/package-format.md). Files-mode asset content is carried
inline as Base64 text with its media type beside it.

**Rationale.** The clarification settled that the framework fixes the format — a form each host
serialized its own way would be portable within a system and nowhere else. JSON is already the
manifest's form, so a package is inspectable with no tool, which is FR-004b stated literally.

Base64 is the only way to carry bytes in JSON. It costs about a third in size, and the mode is
opt-in, so nobody pays that without asking.

**The media type must be stored, not inferred.** An asset id says nothing about what the bytes are,
and a reader that guessed would guess wrong on the first file without an extension.

**Alternatives considered.** An archive container — rejected: the framework has no archive support
and would take on a compression implementation or a dependency for one, against a constitution that
requires justification for any new core dependency. A structured value the host serializes —
rejected in clarification, because it re-creates lock-in one layer down.

---

## R-04: Rewriting asset references

**Decision.** Add `remapAssetIds(manifest, mapping)` beside `collectAssetRefs` in
`packages/core/src/validation/assets.ts`, and widen that file's header from "which assets a lesson
references" to "asset references, found and rewritten".

**Rationale.** The finder and the rewriter must walk identically or they disagree about what an
asset reference is — which is exactly the argument feature 009's FR-016b made about the warning pass
and the publish check, and the reason `collectAssetRefs` is shared today. Two walks in two files
would drift the first time a new element type carried an asset somewhere new.

**Cost accepted.** The file's name says `validation` and rewriting is not validation. Moving both
functions to a new `assets/` module would read better and would churn a file feature 009 shipped
three commits ago, for no behavioural gain. The header carries the explanation instead.

---

## R-05: Version checking, and what is already done

**Decision.** Two version checks, deliberately not sharing an implementation.

- **The lesson format version** is checked entirely by `migrate`. Packaging does not compare it.
- **The package format version** is checked by packaging, against its own known set.

**Rationale, and a finding.** `migrate` already does everything FR-011 and half of FR-012 ask for —
`resolveChain` refuses an unknown version and *distinguishes newer from older*, with the message
"Manifest declares schemaVersion X, newer than the supported Y. Reading a newer manifest requires a
newer reader; nothing was loaded." That was checked rather than assumed, and it means the lesson-side
of FR-012 is already implemented: import must call `migrate` and surface its issues, not re-derive
the comparison.

Packaging therefore owns exactly one comparator, for its own format version, and there is one place
in the codebase that compares lesson versions rather than two that can disagree.

**`migrate` gains its second consumer**, and its first untrusted input — feature 008's draft recovery
was the first, reading a lesson this system itself had written.

---

## R-06: Hardening, and one honest deviation

**Decision.** Three checks, with caller-overridable bounds:

| Check | Bound | When |
|---|---|---|
| Document size | 64 MiB default | **Before** parsing |
| Nesting depth | 64 default | Immediately after parsing, before anything else |
| Address scheme | `https:`, `http:`, `mailto:` | After parsing, before the lesson is produced |

**The address check walks by key, not by element type.** Worth stating because the shortest
correct-looking implementation is wrong twice: `if (element.type === 'button')` is a switch on element
type inside core, which Constitution I calls a defect, *and* it would miss a third-party plugin whose
payload carries an address. Mirror `collectAssetRefs`'s `idsIn` instead — any string under a key named
`url` or `href`, at any depth.

**The deviation, stated rather than hidden.** FR-016a says both bounds are enforced "before parsing
it". Size genuinely is — it is a string length check on the input. Depth **cannot** be, without
writing a streaming JSON parser, which is a large amount of security-critical code to avoid one
`JSON.parse`. `JSON.parse` on deeply nested input throws `RangeError` rather than hanging or
allocating unboundedly, so the realistic attack is bounded by the engine already; the depth check
exists to turn that into a *named refusal* rather than a stack overflow. The parse is wrapped and
its failure reported as a refusal.

**The scheme check is genuinely new, and it exposes a wider hole.** `element.ts` declares a button's
address as `url: z.string().max(2000).optional()` — no scheme constraint at all. So **a lesson
authored in this editor can already carry a `javascript:` address**, and nothing rejects it. That is
a pre-existing defect in the format's validation, not only an import concern.

It is **not** fixed here, deliberately. Tightening `elementSchema` would reject manifests that are
valid today, which needs a decision about `schemaVersion` and a migration, and this feature's
clarification scoped the check to import. Recorded as a finding for the framework plan with a
recommendation that the schema adopt the same allow-list in its own change.

**Alternatives considered.** Full content sanitization — declined in clarification, and the reason
holds up: this framework renders nothing itself, so it would be sanitizing against a renderer it has
to guess at.

---

## R-07: How the host maps operations while the adapter still earns its place

**Decision.** The mapping supplies, per operation, how to **build a request**. The adapter owns
performing it, threading credentials and cancellation, and **interpreting the response** into the
four outcomes — through a classifier the host may replace but need not.

**The risk this avoids.** If "the host maps each operation" meant "the host supplies a function per
operation", the host would have written the adapter and the package would be an empty wrapper. The
value has to live somewhere, and it lives in the parts that are the same for every host: making the
call, not retrying, honouring cancellation, and turning a response into one of exactly four
meanings.

**The line against FR-019b, which this decision comes close to.** FR-019b forbids shipping "a
default mapping presented as the correct one". A default **status classifier** — 401/403 →
permission, 404 → not found, 409/412 → conflict, 5xx and network failure → unavailable — is not a
route mapping. It names no path, no method, and no resource. It encodes only the HTTP status
vocabulary, which is a published standard rather than our opinion about somebody's API. The ban is on
prescribing *where things live*; a classifier prescribes nothing about that, and a host whose API
signals a conflict differently replaces it.

**Alternatives considered.** No classifier at all, host interprets everything — rejected: it makes
the adapter a wrapper and puts the four-outcome discipline, which FR-022 makes load-bearing, in the
place least likely to get it right. A fixed classifier with no override — rejected: FR-019's whole
premise is that the host's API is not ours to shape.

---

## R-08: Retry, cancellation, and testing without a network

**Decision.** The adapter takes an injectable request function defaulting to the platform's `fetch`.
It never retries. It accepts a cancellation signal per request.

**Rationale.** Feature 008's save loop already owns retry and backoff, and its research recorded the
failure mode: two retry policies over one request is how a save is sent four times. FR-025 makes
this a requirement rather than a convention.

Injecting the request function is what makes SC-011 achievable — the entire suite runs with no
network, against a stub that returns whatever a test needs, including malformed success bodies
(FR-024) and responses the mapping does not describe (US4 scenario 4).

---

## R-09: The studio control, and how a package reaches it

**Decision.** One component with two controls. Export calls a supplied export function and hands the
resulting document to a host callback. Import invokes a **host-supplied** `requestPackage()` and
imports what comes back.

**Rationale.** The spec says "no file browser", and the reason is structural rather than aesthetic:
`packages/studio/src` may not read files any more than it may read a clock, and a file input inside
the studio would put the host's choice of where lessons come from inside a package that has no
business knowing. The host owns the picker; the example app supplies one built on a file input, which
is where a browser API belongs.

**`no-clock-in-studio` is not a problem here.** The rule bans `setTimeout`, `setInterval`,
`requestAnimationFrame`, `Date`, `Date.now`, and `performance.now`. Nothing in export or import needs
any of them — FR-030 already forbids reading a clock, so the constraint and the rule agree.

---

## R-10: The new package, and what has to be told about it

**Decision.** `packages/adapter-http`, published as `@cuestack/adapter-http`. Node-environment tests.

**What must be updated for a fifth package to exist**, checked against the configuration rather than
assumed:

| File | Change | Why |
|---|---|---|
| `vitest.config.ts` | add to the node project glob | otherwise its tests never run, and a suite that does not run is worse than none |
| `.dependency-cruiser.cjs` | add `adapter-http` to `no-core-in-schema` and `no-adapters-in-core` | FR-027: nothing existing may depend on it, and the rule lists packages by name |
| `packages/adapter-http/{package.json,tsconfig.json,tsdown.config.ts}` | new | matching the existing packages exactly |

`pnpm-workspace.yaml` needs no change — it already globs `packages/*`.

**The dependency direction.** The adapter depends on `@cuestack/core` for the interfaces it
implements, which is the established direction. Nothing depends on the adapter, which is FR-027 and
is what the dep-cruiser change enforces rather than documents.

---

## R-13: Encoding bytes, portably, with no dependency

**Decision.** A hand-written Base64 codec over `Uint8Array`, in `packages/core/src/packaging/base64.ts`.
Neither `btoa`/`atob` nor `Buffer`.

**Rationale, and this is a trap rather than a preference.** `@cuestack/core` ships to a server and to
a browser, and the two platform helpers are split between them:

| Helper | Where | Why it cannot be used |
|---|---|---|
| `Buffer.from(bytes).toString('base64')` | Node only | Typechecks, passes every Node test, breaks the browser build. The most likely wrong answer |
| `btoa(...)` | Browser only | Absent on the server, **and** it takes a Latin-1 string — feeding it arbitrary bytes silently corrupts anything above 0xFF |

Branching on the platform would put a `typeof Buffer !== 'undefined'` check inside the package whose
constitution keeps its dependency surface deliberately small, and would mean the two halves could
disagree about what a package contains. A codec is about twenty lines over a fixed alphabet, has no
platform surface at all, and is exactly testable: encode every byte value 0–255 and decode back.

**Alternatives considered.** A Base64 dependency — rejected: the constitution requires justification
for any new runtime dependency in core, and "we did not want to write twenty lines" is not one. Storing
content as an array of numbers instead of Base64 — rejected: it is roughly four times the size of the
bytes rather than four-thirds, and it stops the document being something a person can skim.

**The test that matters** is not "does it encode": it is a round trip over bytes that are not text —
every value 0–255, and a payload with a 0x00 in the middle. Both are where a Latin-1 assumption shows.

---

## R-12: What importing does to the lesson already open

**Decision.** It replaces the open draft, through the editor's existing `replace-draft` edit. The
caller passes the **open** lesson's identity to `importLesson`; the package's own is discarded.

**Rationale.** The alternative — creating a second lesson — needs a lesson list and routing by id
that no host is obliged to have, and the example app does not: it hard-codes one lesson id in six
places. Requiring a second lesson slot would make this feature responsible for building lesson
management, which is neither its scope nor anybody's ask.

**The route matters more than the decision.** `useDraftPersistence` binds to one `lessonId` at mount,
so handing that loop a lesson with a different identity writes one lesson's content into another's
slot. Going through `session.apply({ kind: 'replace-draft' })` instead means the autosave loop sees
an ordinary edit to the lesson it already owns, and FR-015's "exactly one route by which a lesson
reaches storage" stays true.

**Destructive, and undoable rather than confirmed.** Replacing somebody's work is destructive and
NFR-USA-003 requires such actions to be undoable or confirmed. It is undoable for free: `apply`
records a history step for **every** successful edit — not per-caller discipline, a property of the
function — and `every-kind.test.tsx` already asserts `replace-draft` reverses byte for byte. This is
the answer feature 008 established when it deleted all three of its confirmation dialogs, and
reaching for a fourth here would undo that decision quietly.

**Alternatives considered.** A confirmation dialog — rejected on the above. Import creating a second
lesson — rejected as out of scope; a host with a lesson list supplies a second identity and gets
exactly that, with no change to the framework.

---

## R-11: What this feature does *not* do, restated because it is easy to drift into

- **No server ships.** Any stub server exists inside the test suite.
- **Import does not persist.** It produces a lesson; the caller saves it through the save loop.
- **Export does not record itself.** It is a copy, not a publication event.
- **The adapter does not retry, refresh a credential, or cache anything.**
- **The schema is not tightened.** R-06's finding is recorded, not acted on.
