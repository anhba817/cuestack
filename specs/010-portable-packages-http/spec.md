# Feature Specification: Portable Packages and the HTTP Adapter

**Feature Branch**: `010-portable-packages-http`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "start SCH-3 and PB-3"

Wave 5 of [`docs/cuestack_framework_plan.md`](../../docs/cuestack_framework_plan.md), second
tranche: **SCH-3** (portable export/import package) and **PB-3** (`@cuestack/adapter-http`, the
reference REST adapter). They are specified together because they are the same promise looked at
from two sides.

The plan states the promise as a settled question: *"Does the framework ship a backend? No. We ship
an in-memory reference and an HTTP reference adapter; we never run a server. The user can always
export the design as a portable package — no lock-in."* Both halves of that sentence are unbuilt.
Today a host can persist a lesson **only** by writing an adapter itself, and a teacher can get a
lesson out of the system **not at all**.

That makes this the feature where the framework's central claim is either honoured or quietly
abandoned. §7.7 asks for "exportable, versioned lesson packages rather than storing lessons in an
opaque editor-only format", and the framework currently has no way to hand anybody a lesson. The
in-memory adapters are honest reference implementations, but every one of them loses everything when
the tab closes — so "works with no backend" has meant "works until you reload".

Two things about this feature are unlike everything before it:

- **It is the first code that talks to a network.** Nine features have kept every port injected and
  every clock injectable precisely so that nothing in the framework had to. PB-3 is the first
  deliberate exception, and it is deliberate: an adapter that speaks HTTP is the one place where
  talking to a network is the entire job. Which is why it is a **separate package** — a host that
  wants none of it installs none of it.
- **It ships an expectation about somebody else's API.** Every other contract here constrains our
  own code. A REST adapter constrains the host's server, and getting that wrong is expensive in a
  way a wrong internal type is not: an interface we dislike can be changed, and a route contract
  a host has already implemented cannot.

It also settles one debt the project has been carrying since Wave 1. **`migrate()` has exactly one
consumer**, added in feature 008 for draft recovery. Import is its second, and the more demanding
one: a package handed over from another system is the first lesson this framework will ever read
that it has no reason to believe was written by a version of itself.

## Clarifications

### Session 2026-08-19

- Q: Does an exported package carry the asset files themselves, or only references to them? → A: Both, as a mode the caller chooses. References by default — export stays pure, instant, and small. Files on request, for a package that must be readable by a system that has never seen those assets. The package states which mode produced it, so a reader can never mistake one for the other.
- Q: Does the framework define the routes a host's server must expose, or does the host map each operation onto its own API? → A: The host maps them. The framework describes what each operation needs to send and to learn, and the host says how that reaches its API. The framework never guesses at somebody else's routing.
- Q: Does this feature include editor screens for export and import, or only the capability? → A: A minimal studio control — a way to trigger an export and to hand over a package for import — wired into the example app. No panel, no progress display, no file browser. An export nobody can reach is hard to believe in; a third publishing-adjacent panel in two features is more than this needs.
- Q: Is a package a single serialized document, or a structured value the host serializes however it likes? → A: One JSON document, always, with files-mode asset content embedded as text. If the framework does not fix the serialized form then two hosts produce two incompatible formats and the anti-lock-in promise fails in a new place.
- Q: In an editor that holds one lesson, what does importing do to the lesson already open? → A: It replaces the open draft. The alternative — creating a second lesson — needs a lesson list and routing by id that no host is obliged to have. Replacing is destructive, and it is **undoable rather than confirmed**: `replace-draft` goes through `apply`, which records a history step for every successful edit, so Ctrl+Z takes an import back. That is the answer feature 008 established when it deleted all three confirmation dialogs.
- Q: Does importing write the new lesson to storage, or hand back a lesson for the host to save? → A: It hands it back. Every write in this framework goes through the save loop that already owns conflict, offline, and acknowledgement, and a second writing path would be the first thing to disagree with it. Import stays pure and needs no adapter.
- Q: In files mode, how do imported asset files reach the host's asset store without breaking the lesson's references? → A: The host stores them however it likes and tells the framework which new id replaced which old one; the framework rewrites the references. Most asset stores mint their own ids, and rewriting is still a pure transformation, so import keeps the purity just chosen for it. Import therefore has two steps: read the package, then produce the lesson once the assets have landed.
- Q: What should the framework do about a package that is deliberately hostile rather than merely damaged? → A: Harden against the realistic attacks and say plainly where the line is. Bound size and nesting depth before parsing, and restrict URL-bearing fields to safe schemes, refusing the package and naming what was rejected. Full content sanitization is declined: this framework renders nothing itself and would be sanitizing against a renderer it has to guess at.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A teacher takes their lesson with them (Priority: P1)

A teacher has spent a term building lessons. Their school is changing systems, or they are moving to
another school, or they simply want a copy of their own work somewhere they control. They ask for the
lesson and receive a single self-contained package — one document, everything in it, nothing that
only makes sense inside the system that produced it.

**Why this priority**: This is §7.7 and it is the anti-lock-in promise. Without it every other
guarantee in this framework is conditional on the host staying in business and staying cooperative.
It is also the half that works alone: exporting is useful with no importer anywhere, because the
value of a copy is that somebody else can read it.

**Independent Test**: Export a lesson, close the system, and confirm the resulting package contains
everything needed to reconstruct it — read entirely by inspection, with no access to the system that
produced it.

**Acceptance Scenarios**:

1. **Given** a lesson with slides, elements, timing, and interactions, **When** the teacher exports
   it, **Then** they receive one package containing the lesson and the format version it was written
   under.
2. **Given** a lesson referencing images and audio, **When** the teacher exports it in the default
   mode, **Then** the package carries the references and states that it carries references.
3. **Given** the same lesson, **When** the teacher exports it with files included, **Then** the
   package carries the asset content and states that it does, and a system that has never seen those
   assets can reconstruct the lesson completely.
4. **Given** an export, **When** anybody inspects the package, **Then** it contains no author
   credential, no learner identifier, and nothing about the host's storage (NFR-PRV-004).
5. **Given** a lesson that fails validation, **When** the teacher exports it, **Then** the export
   still succeeds — exporting is not publishing, and refusing to hand somebody their own broken work
   is the lock-in this feature exists to prevent.

---

### User Story 2 - A lesson arrives from somewhere else (Priority: P2)

A teacher receives a package — from a colleague, from their old system, from a shared bank of
material. They import it and it becomes the draft they are editing — replacing what was open, which
one press of undo takes back. If it was written under an older format, it is brought forward without
being asked. If it cannot be read, they are told what is wrong with it rather than being shown an
empty editor.

**Why this priority**: An export nobody can import is a backup, not portability. Second only because
a package that can be read by hand already delivers most of the promise, and because import is where
the risks live — this is untrusted input in a way nothing else in the framework has been.

**Independent Test**: Import a package produced by US1 and confirm the result is a lesson equal to
the original. Then import a deliberately damaged one and confirm the failure is explained rather than
silent.

**Acceptance Scenarios**:

1. **Given** a package exported from this framework, **When** it is imported, **Then** the resulting
   lesson is identical to the one exported, apart from the identity the caller gave it.
2. **Given** a package written under an earlier format version, **When** it is imported, **Then** it
   is migrated forward and the teacher is told it was.
3. **Given** a package written under a *newer* format version than this system knows, **When** it is
   imported, **Then** it is refused with an explanation, rather than being partially read.
4. **Given** a package that is damaged, truncated, or not a lesson package at all, **When** it is
   imported, **Then** the import fails with a message naming what is wrong, and nothing is written.
5. **Given** a package whose lesson id matches one that already exists here, **When** it is imported,
   **Then** the package's id is discarded in favour of the one the caller supplied, so a package from
   a stranger cannot land on an unrelated lesson that happens to share an id.
5a. **Given** a teacher with unsaved work open, **When** they import a package that replaces it,
   **Then** one press of undo returns the lesson they had — the import is a reversible edit like any
   other, not a special action with its own confirmation.
6. **Given** a files-mode package, **When** the host has stored its assets and reports where they
   landed, **Then** the lesson's references point at the stored assets rather than at the exporting
   system's.
7. **Given** a package built to exhaust or attack the reader — oversized, deeply nested, or carrying
   an executable address — **When** it is imported, **Then** it is refused before being parsed
   further, naming what was rejected.

---

### User Story 3 - A host persists lessons to its own API without writing an adapter (Priority: P3)

A developer integrating Cuestack has a REST API and does not want to write four adapters against
four interfaces to find out whether the framework works. They point the shipped HTTP adapter at their
base URL, supply how requests are authenticated, and the editor saves, loads, and publishes against
their server.

**Why this priority**: The framework's "works with no backend" story currently ends at the first
page reload. This is what turns nine features of adapter interfaces into something a developer can
use in an afternoon. Third because the interfaces already exist and a determined host can implement
them today — this removes work rather than removing an impossibility.

**Independent Test**: Run the editor against the HTTP adapter pointed at a stub server implementing
the documented routes, and confirm autosave, conflict refusal, version history, and publishing all
behave exactly as they do against the in-memory reference.

**Acceptance Scenarios**:

1. **Given** the HTTP adapter configured with a base address, **When** the editor autosaves, **Then**
   the draft is sent to the host's API and is not reported Saved until the server acknowledges it
   (FR-DAT-003).
2. **Given** two editors on one lesson, **When** the second saves against a version the server has
   already moved past, **Then** the adapter reports a conflict rather than overwriting, and the
   existing conflict handling applies unchanged (FR-DAT-006, FR-DAT-007).
3. **Given** a server that refuses an action for permission, **When** the editor attempts it,
   **Then** the adapter reports it as a permission refusal and not as a failure (FR-032a).
4. **Given** a server that is unreachable, **When** the editor autosaves, **Then** the adapter
   reports it as unavailable, and the existing offline behaviour applies unchanged.
5. **Given** a host whose API needs a credential, **When** the adapter makes a request, **Then** the
   credential is supplied by the host and never held, cached, or logged by the framework.

---

### User Story 4 - A developer connects the adapter to the API they already have (Priority: P4)

A developer has an API that was not designed for Cuestack — its lesson endpoint is nested under a
course, its version token is a header nobody else uses, and its publish action is a POST to something
called `/releases`. They describe how each operation reaches their API, and the adapter works against
it unchanged.

**Why this priority**: This is what makes the adapter worth shipping. A host with no API can write
one to any shape; a host with an existing API cannot reshape it, and there are far more of the
second. Fourth because it is the configuration surface of US3 rather than separate behaviour — but it
is not optional, because without it the adapter serves only hosts who have not built anything yet.

**Independent Test**: Point the adapter at a stub server with deliberately unusual routes, headers,
and response shapes, supply only the mapping, and confirm the adapter's full suite passes with no
change to the adapter.

**Acceptance Scenarios**:

1. **Given** an API whose paths, methods, and headers differ from any default, **When** the developer
   supplies the mapping for each operation, **Then** every operation works with no change to the
   adapter.
2. **Given** the framework's description of an operation, **When** a developer reads it, **Then** it
   states what the operation needs to send and what it must be able to learn from the response —
   including how a conflict, a permission refusal, and an absence are recognised — without prescribing
   a path or a status code.
3. **Given** a mapping that does not cover every operation, **When** the adapter is constructed,
   **Then** the gap is reported immediately rather than at the first save.
4. **Given** a server that returns something the mapping does not describe, **When** the adapter
   receives it, **Then** it reports a failure the caller can act on rather than treating an
   unrecognised response as success.

---

### Edge Cases

**Export**

- What happens when a lesson references an asset that no longer resolves? It depends on the mode,
  and it has to. Files mode fetches, so it finds out and fails naming the asset. Reference mode
  fetches nothing — it *cannot* find out without becoming impure, which is the one thing the default
  mode must not be — so it names the asset and says, in `assetMode`, that naming is all it did. The
  teacher learns the asset is gone from the validation report, which asks that question already.
- What happens when an asset cannot be fetched during a files-mode export? The export fails naming
  the asset; a package silently missing one image is worse than no package.
- What happens when a lesson is very large? The framework produces one document and the host writes
  it wherever it likes; the framework must not assume it fits anywhere in particular.
- What happens when a files-mode export of a media-heavy lesson exceeds what fits in memory? This is
  the known cost of one inspectable document, and it must fail in a way that says so rather than
  exhausting memory silently. Reference mode remains available and is the default.
- What happens when the same asset is referenced by twelve elements? It appears once.
- Can a *published* version be exported, or only a draft? Both, and the package must say which it
  was, because a package claiming to be a published lesson when it was a draft is a lie a teacher
  cannot detect. **Both must be reachable, not merely representable**: a `kind` field with one value
  anybody can actually produce is the declared-with-no-producer pattern this project keeps finding,
  and the export path is where it would appear next.

**Import**

- What happens when a package's declared format version does not match its actual contents? The
  declared version is a claim, not a fact, and the contents are validated regardless.
- What happens when a package contains an asset the host has no room for, or refuses? Import stores
  nothing, so the failure is the host's — and because reading a package is separable from producing
  its lesson, the host meets that failure before it has a lesson to save rather than after.
- What happens when a host stores only some of the assets? The lesson is still produced; the ones
  that landed are rewritten and the ones that did not are reported unresolved. A partial import is a
  lesson with known gaps, which is more useful than no lesson and safer than a silent one.
- What happens when a reference-mode package is imported? There are no assets to store and the
  mapping is empty; the references are kept as they are, and any the host cannot resolve are
  reported.
- What happens when an import is interrupted half way? Nothing was written, so nothing is stranded.
- What happens when an imported lesson's id collides with a lesson that already exists? It cannot:
  the caller supplies the new lesson's identity and the package's own is discarded.
- What happens when the same package is imported twice? That is the caller's choice, and the two
  answers are both correct. A host with a lesson list supplies two identities and gets two lessons.
  A host holding one lesson — which the example is — supplies the open lesson's identity twice and
  the second import replaces the first, exactly as re-opening a file would.
- What happens when a package was produced by a *newer* version of this framework? Refused, named,
  and not partially read.
- What happens when a package is enormous, or nested thousands of levels deep, on purpose? Refused
  on sight, before parsing, because the cost of finding out by parsing is the attack.
- What happens when a button in an imported lesson carries a `javascript:` address? The package is
  refused and the field is named. A learner clicking it would run somebody else's script inside the
  host's application.
- What happens when an embedded asset is a document that could carry a script of its own? Import does
  not inspect asset content, and says so: the framework renders nothing itself, and what is safe to
  serve is a property of how the host serves it.

**HTTP adapter**

- What happens when the server returns a success status with a body the adapter cannot read? Treated
  as a failure, because a save reported as Saved that was not is the one outcome FR-DAT-003 exists
  to prevent.
- What happens when the network drops mid-request? Reported as unavailable, and the existing save
  loop's retry applies. The adapter does not retry on its own — two retry policies over one request
  is how a save is sent four times.
- What happens when the server responds slowly? A request that never returns must not leave the
  editor reporting Saving forever.
- What happens when the host's credential expires mid-session? Reported as a permission refusal, and
  the host re-supplies it; the framework never refreshes a credential it does not own.
- What happens when a host's API cannot express one of the operations at all — no version token, no
  way to list earlier versions? The adapter must fail at construction rather than at the first save,
  because a mapping discovered to be incomplete an hour into a teacher's work is the worst moment to
  discover it.
- What happens when a host's mapping is wrong rather than absent — it reports a conflict as a plain
  failure? The framework cannot detect this, and the operation contract must say plainly which
  distinctions the host is responsible for preserving and what breaks when they are not.

## Requirements *(mandatory)*

### Functional Requirements

**The package (US1, US2)**

- **FR-001**: The system MUST be able to export a lesson as a single self-contained package
  (FR-PUB-013).
- **FR-002**: A package MUST record the lesson format version its contents were written under, so a
  reader knows what it is holding without inspecting it.
- **FR-003**: A package MUST record its own package-format version, separately from the lesson format
  version. The two change for different reasons and a package that conflated them could not describe
  a future in which either moved alone.
- **FR-004**: A package MUST record whether its lesson was a draft or a published version at the
  moment of export.
- **FR-004a**: A package MUST be a single document in one interchange format, identical whoever
  produced it. The framework fixes the form rather than leaving it to the host: a format each host
  serialized its own way would be portable within a system and nowhere else, which is the lock-in
  this feature exists to prevent, arriving by a different door.
- **FR-004b**: A package MUST be readable by inspection — a person or a program with no access to
  the producing system, and no special tool, can open it and see the lesson.
- **FR-004c**: In files mode, a package MUST carry each asset's content inline, together with enough
  about it — its identity and its media type — for a reader to reconstruct the asset without asking
  anybody anything.
- **FR-004d**: A caller MUST be able to export a **published** version as well as a draft. A `kind`
  field with only one value anybody can produce records a distinction that does not exist, and the
  format's promise that a package says what it is becomes untestable in practice. Which host
  surfaces offer which is FR-043's business; the capability is this one's.
- **FR-005**: A package MUST NOT contain any credential, any learner identifier, or any detail of the
  host's storage (NFR-PRV-004, NFR-PRV-002).
- **FR-006**: Export MUST support two modes: **references**, carrying only the identity of each
  asset, and **files**, carrying the asset content itself. References is the default.
- **FR-006a**: A package MUST state which mode produced it. A reader that cannot tell a
  reference-mode package from a files-mode one would treat an incomplete package as complete, which
  is the failure the mode distinction exists to prevent.
- **FR-006b**: Reference-mode export MUST be pure — no network, no waiting. It is the default
  precisely because it is the one a teacher can ask for without consequence, and because every other
  core operation in this framework has this property.
- **FR-006c**: Files-mode export MUST fail, naming the asset, when any asset's content cannot be
  obtained. A package missing one image while claiming to be self-contained is worse than no package.
- **FR-006d**: Import MUST accept both modes. A reference-mode package imported into a system that
  does not hold those assets MUST still produce the lesson, with the unresolvable references reported
  — the same treatment FR-017 gives a lesson that arrives with problems.
- **FR-006e**: Asset content MUST cross both boundaries as **bytes**, not as text a caller has
  already encoded. Export takes bytes from the content provider and encodes them; reading a package
  hands bytes back, decoded. Encoding is the format's business and a caller that had to do it would
  be reimplementing half the format to use it — and would be the second place a mistake could live.
- **FR-006f**: The encoding MUST work identically wherever this framework runs, and MUST NOT add a
  dependency. `@cuestack/core` ships to a server and a browser; the platform helpers are split
  between them and one of them silently corrupts bytes outside Latin-1, so neither may be reached
  for.
- **FR-007**: Export MUST never claim a completeness it does not have — and the two modes discharge
  that differently, because only one of them can ask. In **files mode** the content is fetched, so an
  asset that cannot be supplied fails the export (FR-006c). In **reference mode** nothing is fetched,
  so export makes **no claim about resolvability at all**: `assetMode: 'references'` is the claim, and
  a reader knows from the top of the document that the assets are named rather than carried.
- **FR-007a**: A teacher learns that an asset is missing from **validation**, not from export.
  `checkAssets` already reports an unresolvable reference (feature 009, FR-016a) and is the pass built
  for exactly this question. Reference-mode export MUST NOT acquire a second, weaker copy of that
  check — a rule that runs only when someone exports would disagree with the report the moment an
  asset disappeared between the two.
- **FR-008**: Export MUST NOT require a lesson to be valid. Exporting is not publishing, and a
  teacher's broken lesson is still theirs.
- **FR-009**: Export MUST include each distinct asset once, however many elements reference it.
- **FR-010**: The system MUST be able to import a package, producing a lesson equal to the one
  exported.
- **FR-011**: Import MUST migrate a package written under an earlier lesson format version, and MUST
  report that it did.
- **FR-012**: Import MUST refuse a package written under a lesson format version or a package format
  version newer than the system understands, naming the versions involved.
- **FR-013**: Import MUST validate a package's contents rather than trusting its declared version.
- **FR-014**: Import MUST refuse a damaged, truncated, or unrecognisable package with a message
  naming what is wrong, and MUST create nothing.
- **FR-014a**: Reading a package MUST be separable from producing its lesson. A caller MUST be able
  to learn what a package contains — its versions, its origin, and its asset inventory — and to
  obtain any asset content it carries, before committing to anything.
- **FR-014b**: Producing the lesson MUST accept a mapping from the asset identity the package used
  to the identity the host stored it under, and MUST rewrite the lesson's references accordingly.
  Most asset stores mint their own identifiers, and a lesson pointing at the exporting system's ids
  is a lesson whose every image is blank while its manifest remains perfectly valid — a failure
  nothing would report.
- **FR-014c**: An asset the mapping does not cover MUST keep its original reference and MUST be
  reported as unresolved, the same treatment FR-006d gives a reference-mode package. Silently
  dropping the element, or silently keeping a reference nobody can follow, are both worse than
  saying so.
- **FR-014d**: Rewriting references MUST remain pure and MUST cover every place an asset identity can
  appear, not a list of the places it appears today.
- **FR-015**: Import MUST produce a lesson rather than store one. The caller saves it through the
  path it already uses, so there is exactly one route by which a lesson reaches storage and exactly
  one place conflict, offline, and acknowledgement are handled.
- **FR-015a**: Import MUST take the lesson's identity from the caller, and MUST NOT reuse the
  identity the package carries. A package's id belongs to whatever system produced it, and honouring
  it would let a package sent by a stranger land on top of an unrelated lesson that happens to share
  it. The framework generates no identifiers of its own (FR-030), so the caller is the only
  participant that can supply one.
- **FR-015b**: Import MUST NOT alter identifiers *within* the lesson — slide ids, element ids, effect
  ids. They are unique only within their lesson, so they need no re-minting, and rewriting them
  would mean rewriting every reference that points at one, including a question's correct answer.
- **FR-015c**: A host that imports **into** an open lesson — replacing the draft rather than creating
  a second one — MUST do so reversibly. Replacing somebody's work is destructive, and NFR-USA-003
  requires destructive actions to be undoable or confirmed; this framework has answered that with
  *undoable* since feature 008 deleted its last confirmation dialog. The editor's existing
  `replace-draft` edit already satisfies this, because every successful edit records a history step —
  so the obligation is to route an import through that path rather than around it.
- **FR-016**: A failed import MUST leave nothing behind, which follows from FR-015 rather than being
  arranged: import writes nothing anywhere, so there is nothing a failure could strand.
- **FR-016a**: Import MUST bound what it will read — the size of a package and the depth of its
  nesting — and MUST refuse anything beyond those bounds **before** parsing it. A package is a file
  somebody was emailed, and a parser that discovers a problem by exhausting memory has already lost.
- **FR-016b**: Import MUST restrict address-bearing fields to schemes that cannot execute, and MUST
  refuse a package carrying any other, naming the field and the scheme. The lesson format's button
  action carries an address a learner's click follows; a `javascript:` address there is a script the
  host will run on behalf of whoever sent the package. This is the check that discharges NFR-SEC-007
  for this path.
- **FR-016c**: The framework MUST state plainly what import does **not** defend against, so a host
  accepting packages from strangers knows what remains its own responsibility. An undocumented
  boundary is read as a guarantee.
- **FR-017**: Import MUST NOT require the imported lesson to be valid, and MUST make any validation
  issues available to the caller — a lesson that arrives with problems is a lesson to be fixed, not
  one to be refused.
- **FR-017a**: Import MUST accept the host's element registry and use it when producing those
  issues, for two reasons — and the first one this requirement gave turned out to be unreachable.
  **What it carries**: each registered plugin's own `validate`, so a host's plugin reports faults
  core has never heard of; without the option those never reach the result at all. **And the cliff**:
  a supplied registry *replaces* the default rather than extending it (feature 009, research R-13),
  so a host passing only its own plugins has every other type reported unknown, and must compose
  `[...builtinElements, mine]`.
  **Not** the case originally written here — a lesson carrying an *unregistered custom type* being
  reported unknown. The format's element union is closed and `migrate` ends with an unconditional
  `validate`, so such a lesson is refused before any registry is consulted. Implementation found it.

**The HTTP adapter (US3, US4)**

- **FR-018**: The framework MUST ship an adapter implementing the persistence, asset, analytics, and
  publishing contracts over HTTP, in a package a host may install or not install.
- **FR-019**: The adapter MUST take, from the host, how each operation reaches the host's API. The
  framework MUST NOT require any particular path, method, or status code — it describes what an
  operation needs to send and what it must be able to learn, and the host says how that happens.
- **FR-019a**: The adapter MUST report an incomplete mapping when it is constructed, naming the
  operations that are missing, rather than failing at the first use of one.
- **FR-019b**: The framework MUST NOT ship a default mapping presented as the correct one. A default
  becomes the shape hosts build to, which is the outcome this decision rejected — any example mapping
  MUST be plainly an example, and MUST live in documentation or tests rather than in the adapter's
  own construction path.
- **FR-020**: The adapter MUST obtain credentials from the host for every request, and MUST NOT
  store, cache, refresh, or log them.
- **FR-021**: The adapter MUST report a conflicting save as a conflict, carrying what the server says
  the current version is, so existing conflict handling applies unchanged (FR-DAT-006, FR-DAT-007).
- **FR-022**: The adapter MUST distinguish, in what it reports, between: the action was refused for
  permission, the service could not be reached, the thing was not found, and the request conflicted.
  A caller that cannot tell these apart cannot say anything useful to a teacher.
- **FR-023**: The adapter MUST NOT report a save as successful unless the server acknowledged
  persistence (FR-DAT-003).
- **FR-024**: The adapter MUST treat an unreadable or unexpected success response as a failure.
- **FR-025**: The adapter MUST NOT retry on its own. Retry and backoff belong to the save loop that
  already owns them.
- **FR-026**: The adapter MUST allow a request to be abandoned, so an editor is never left reporting
  Saving indefinitely.
- **FR-027**: The adapter MUST NOT be required by any existing package. A host using none of it MUST
  be able to install none of it, and nothing in the existing packages may begin depending on it.
- **FR-028**: The framework MUST document, for every operation, what it sends, what it must be able
  to learn from a response, which distinctions the host's mapping is responsible for preserving
  (conflict, permission, absence, unavailability), and what the adapter does with a response the
  mapping does not describe.
- **FR-029**: The adapter MUST be exercisable in tests without a network, so its behaviour is
  asserted rather than assumed.

**Reaching it (US1, US2)**

- **FR-040**: The editor MUST offer a control that exports the current lesson and a control that
  accepts a package for import. Minimal by intent: no panel, no progress display, and no file
  browser — the framework has no filesystem and choosing where a package goes is the host's job.
- **FR-041**: The import control MUST report what happened — migrated, imported with problems, or
  refused and why — rather than leaving a teacher to infer it from whether the editor changed.
- **FR-042**: Both controls MUST be operable from the keyboard with an accessible name, and MUST
  NOT convey their state by colour alone (Constitution III, NFR-ACC-001).
- **FR-043**: The example application MUST demonstrate export and import end to end with no
  backend, alongside the in-memory adapters it already uses (FR-037 of feature 009, unchanged), and
  MUST offer **both** kinds of export — the working draft and the version learners currently receive
  — because it already holds the publishing adapter and the active version's identity.

**Both**

- **FR-030**: Neither export, import, nor the adapter may read a clock, generate randomness, or
  reach the network except where the operation is defined by doing so. Where a time or an identifier
  is needed, the host supplies it — the rule established for checkpoints and published versions.
- **FR-031**: Every failure MUST state the problem, the object it concerns, and what to do about it
  (NFR-USA-004).

### Key Entities

- **Lesson package**: A self-contained representation of one lesson, carrying its manifest, its
  lesson format version, its package format version, whether it was a draft or a published version,
  its asset mode, and its assets as either references or content. It is a value the framework
  produces and consumes; where it is written and what it is called are the host's business.
- **Package manifest entry**: What the package says about itself — versions, origin kind, and the
  inventory of what it contains. Read before the lesson is, so a reader can refuse early.
- **Operation contract**: For each operation the adapter performs — what it sends, what it must be
  able to learn back, and which four distinctions the response must preserve. Not routes: it
  describes the conversation, not its address.
- **Operation mapping**: The host's answer to the operation contract — how each operation reaches
  their API. Supplied whole at construction, so an incomplete one is caught before a teacher relies
  on it.
- **Request context**: What the host supplies per request — at minimum credentials and a way to
  abandon the request. Held by nobody.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A lesson exported and re-imported is identical to the original **as data**, for every
  lesson in the test corpus, with no field lost and no field invented. Key order is not preserved and
  is not part of the claim: `importLesson` delegates to `migrate`, which ends with `validate`, and the
  schema rebuilds objects in its own field order. Found by running the round trip on the reference
  lesson, where a byte comparison failed and a field comparison did not.
- **SC-002**: A files-mode package can be read and understood with no access to the system that
  produced it, no access to its asset store, and no special tool — demonstrated by reconstructing a
  lesson, images and all, from the package alone.
- **SC-002b**: Two packages exported from the same lesson by different callers are byte-identical,
  so a package's form is a property of the framework rather than of who asked for it.
- **SC-002a**: A reference-mode export of a 50-slide lesson performs no network request and no
  waiting, asserted rather than measured.
- **SC-003**: 100% of packages contain no credential and no learner identifier, asserted rather than
  reviewed.
- **SC-003a**: Every hostile package the suite can construct — oversized, over-nested, or carrying an
  executable address — is refused with the reason named, and none of them is parsed further than the
  point of refusal.
- **SC-004**: Every lesson format version the framework can migrate from imports successfully, and
  every version it cannot is refused with both versions named.
- **SC-005**: A malformed package writes nothing anywhere — measured across every way a package can
  be malformed that the suite can construct, with import exercised against no storage adapter at all.
- **SC-005a**: Importing the same package twice with two identities yields two independent lessons,
  neither affecting the other.
- **SC-005b**: A files-mode package imported into a store that mints its own identifiers produces a
  lesson whose every asset reference resolves — asserted against a store that deliberately assigns
  identifiers unlike the ones the package carries.
- **SC-006**: The editor behaves identically against the HTTP adapter and against the in-memory
  reference, for saving, conflict, version history, and publishing — asserted by running the same
  scenarios against both.
- **SC-007**: Every failure the host's API can produce maps to exactly one of the four outcomes
  FR-022 names, with no response falling through to a fifth meaning.
- **SC-008**: The adapter's full suite passes against at least two deliberately dissimilar API
  shapes, differing in path structure, in how the version token travels, and in how a conflict is
  signalled — with no change to the adapter, only to the mapping. One shape proves nothing; the
  second is what demonstrates the adapter is not quietly built around the first.
- **SC-008a**: An incomplete mapping is reported at construction in 100% of cases, naming every
  missing operation rather than the first.
- **SC-009**: Installing the framework without the HTTP adapter package leaves every existing test
  passing and adds nothing to what a host must download.
- **SC-010**: Exporting a 50-slide lesson completes in under three seconds, excluding any time spent
  transferring asset files.
- **SC-011**: The adapter's entire test suite runs with no network access.
- **SC-012**: A teacher can export a lesson and import a package using the keyboard alone, and the
  controls report no accessibility violations.
- **SC-013**: The example application exports a lesson and imports the result back with no backend
  and no network, demonstrated end to end.

## Assumptions

- **The framework fixes the format and not the filing.** Export produces one document in a form the
  framework defines — that part cannot be the host's choice, or packages stop being interchangeable.
  Where that document is written, what it is called, and how it is transported are entirely the
  host's business; the framework has no filesystem and never will. Every prior feature has drawn the
  second half of this line the same way, and this feature is the first that has to draw the first.
- **Files mode costs size, and that is the accepted trade.** Embedding asset content in a text
  document is larger than the bytes it carries. One inspectable document was judged worth it, and
  the mode is opt-in, so nobody pays the cost without asking for it.
- **The studio surface is deliberately thin.** Export has no state to manage and import is a single
  answer; the panels features 008 and 009 needed exist because saving and publishing have states
  that change over time. A third panel here would be symmetry rather than need.
- **Export is a copy, not a handover.** Exporting changes nothing, removes nothing, and does not
  record itself in the publication record. A teacher taking a copy of their work is not an event
  their institution needs an audit trail of.
- **The package format is versioned from the start**, because the one thing certain about a
  portability format is that it will need to change while old packages still exist.
- **The asset mapping is the host's answer, not the framework's guess.** The framework cannot know
  what identity a host's asset store will assign, and asking it to preserve one is asking it to have
  a feature many stores do not. So the host stores first and reports back, which also means the
  framework never has to be told an asset store's rules.
- **Import produces rather than persists.** It is a pure transformation from a package to a lesson,
  and the host saves the result the way it saves everything else. This is the safer default and the
  one consistent with FR-DAT-010, where restoring a version creates a new one rather than deleting
  later history — a host wanting replacement composes it from an import and its own action.
- **References is the default because it is the harmless one.** A teacher asking for a copy of their
  work should not trigger a media transfer they did not ask for. Files mode is the deliberate choice,
  made by someone who knows why they want it.
- **The framework ships no default route mapping**, and this is a constraint rather than an omission.
  A default becomes the shape hosts build to, and shipping one would reintroduce by convention the
  coupling this decision rejected. Examples live in documentation and tests, where they are plainly
  examples.
- **A mapping that lies cannot be detected.** If a host maps a conflict onto a plain failure, the
  framework will report a plain failure and the editor will do the wrong thing. This is stated rather
  than defended against: the alternative is inferring meaning from status codes, which is exactly the
  route-defining the host-mapping decision rejected.
- **Import hardens against the realistic attacks and no further.** Size, depth, and executable
  addresses are checked. Asset *content* is not inspected, text is not rewritten, and no attempt is
  made to sanitize markup — this framework renders nothing itself, so it would be sanitizing against
  a renderer it has to guess at, and a check that guesses wrong reads as protection while providing
  none. FR-016c makes that boundary something a host is told rather than something it discovers.
- **The framework holds no credentials, ever.** Established by FR-032a in feature 009 and unchanged:
  permission is discovered by attempting, and authentication is supplied per request by whoever owns
  it.
- **The HTTP adapter is a reference, not the recommended path.** A host with an existing API is
  expected to implement the interfaces directly. The adapter exists to make the first hour easy and
  to prove the interfaces are implementable by someone who did not design them.
- **Analytics over HTTP is fire-and-forget.** A failed analytics call must never interrupt a lesson;
  a learner's progress does not depend on a report being delivered.
- **No server ships.** Any stub server in this work exists inside the test suite and is never
  published, per the plan's settled answer.

## Dependencies

- **SCH-2** (schema and migration) — complete. Export writes the format version; import calls
  `migrate`, which gains its second consumer and its first untrusted input.
- **EN-6** (adapter interfaces) — complete. The HTTP adapter implements them; it does not extend
  them. Any gap found while implementing is a finding about the interfaces, which is the pattern this
  project has hit ten times and should expect an eleventh.
- **PB-2** (publishing) — complete. Exporting a published version depends on the publishing adapter
  existing, and the HTTP adapter must implement it as well as the other three.
- **Feature 008's save loop** — complete, and it owns retry, backoff, and offline queueing. The
  adapter must not acquire a second copy of any of them.
