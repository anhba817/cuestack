---

description: "Task list for feature 010 — portable packages and the HTTP adapter"
---

# Tasks: Portable Packages and the HTTP Adapter

**Input**: Design documents from `/specs/010-portable-packages-http/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Required, not optional. Constitution II is NON-NEGOTIABLE and this feature is unusually
well suited to it — export and import are pure functions from a value to a value, and the adapter's
request function is injected. Every suite here is a table with no clock and no network.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on incomplete work
- **[Story]**: US1 export, US2 import, US3 the adapter, US4 the mapping

---

## Phase 1: Setup

**Purpose**: the fifth package, and the three configuration files that have to be told it exists.

- [X] T001 Create `packages/adapter-http/` with `package.json`, `tsconfig.json`, and `tsdown.config.ts` copied in shape from `packages/core/` — ESM-only, `"sideEffects": false`, `exports` map with `.` and `./package.json`, and **both `@cuestack/core` and `@cuestack/schema`** as workspace dependencies (research R-10). Two, not one: `@cuestack/core` re-exports no schema types, and every adapter interface takes `LessonManifest`, which lives in schema — `@cuestack/studio` depends on all three for exactly this reason. A single dependency fails typecheck on the adapter's first file
- [X] T002 [P] Make `vitest.config.ts` see this feature, in both the ways it has to. **Add `packages/adapter-http` to the node-environment project glob** — currently `packages/{schema,core,element}`; a suite that never runs is worse than no suite, and this is the line that decides whether it does. **And widen the coverage `include` to cover `packages/core/src/packaging/**/*.ts`**, because the floor is scoped to `{resolve,effects,time,advance}` and this feature's code would otherwise land outside a 90% floor Constitution II states plainly. Both edits are in this one file, which is why they are one task rather than two competing for it. Verify the second with `pnpm test:coverage` — `pnpm test` runs no coverage, so a shortfall is invisible to every other command in this feature
- [X] T003 [P] Add a `no-http-adapter-dependents` rule to `.dependency-cruiser.cjs` with `from: ^packages/(schema|core|react|element|studio)/src` and `to: ^(packages/adapter-http/|@cuestack/adapter-http($|/))`, and name `adapter-http` in the existing `no-core-in-schema` and `no-adapters-in-core` `to:` lists. **A new rule is needed, not just two additions**: those two rules' `from:` clauses are `packages/schema/src` and `packages/core/src` only, so extending them would leave `react` and `studio` free to import the adapter — and FR-027 says *any* existing package. A rule naming the wrong importer reads as protection while providing none
- [X] T004 [P] Add packaging fixtures to `packages/core/test/harness/packages.ts` — a lesson with assets, one with none, one carrying a button address, and one that fails validation. The last exists because FR-008 requires export to work on a broken lesson and a corpus of only valid lessons cannot show it
- [X] T005 Create the stub request function in `packages/adapter-http/test/harness/request.ts` — records what was sent, returns whatever a test dictates including a malformed success body, and can fail at the transport layer. Every adapter suite runs through it, which is how SC-011 is met rather than hoped for
- [X] T006 Create two deliberately dissimilar API shapes in `packages/adapter-http/test/harness/shapes.ts` — differing in path structure, in how the version token travels (body vs header), and in how a conflict is signalled (409 vs 412 vs a body flag). **Two, not one**: a single shape cannot demonstrate the adapter is not quietly built around it (SC-008)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the document's shape, which both export and import are defined in terms of.

**⚠️ Blocks US1 and US2.** US3 and US4 do not depend on this and may start after Phase 1.

- [X] T007 Write `packages/core/test/packaging/format.test.ts` — the guard accepts a well-formed document and rejects each malformation one at a time: absent `packageVersion`, absent `assetMode`, `assetMode: 'files'` with an asset carrying no content, an asset with no `mediaType`. **One malformation per case**, so a regression names itself rather than moving a count
- [X] T008 Implement `packages/core/src/packaging/format.ts` — `PACKAGE_FORMAT_VERSION`, the `LessonPackage` and `PackagedAsset` shapes from [data-model.md §2–3](./data-model.md), the structural guard, and the package-version comparator. The comparator is packaging's own and covers **only** the package format version; the lesson version is `migrate`'s entirely (research R-05)

**Checkpoint**: the document has a definition. Export and import can both be written against it.

---

## Phase 3: User Story 1 — A teacher takes their lesson with them (Priority: P1) 🎯 MVP

**Goal**: a lesson leaves this framework in a form anybody can read.

**Independent Test**: export a lesson and reconstruct it from the package alone, with no access to
the system that produced it. Useful with no importer anywhere — the value of a copy is that somebody
else can read it.

**Depends on**: Phase 2.

### Tests for User Story 1

- [X] T009 [P] [US1] Write `packages/core/test/packaging/export.test.ts` — the document carries the lesson unmodified, both version fields, `kind`, and `assetMode`; a published version exports as `kind: 'published'` and a draft as `'draft'` (FR-002, FR-003, FR-004)
- [X] T010 [P] [US1] Write `packages/core/test/packaging/pure.test.ts` — reference-mode export with **no content provider supplied at all** is synchronous and complete. SC-002a is a structural claim rather than a time bound: an export that awaited anything would have acquired a dependency on the outside world the default mode must not have
- [X] T011 [P] [US1] Write `packages/core/test/packaging/deterministic.test.ts` — two exports of one lesson are byte-identical (SC-002b). If they are not, "the framework fixes the format" is untrue and two systems produce two formats again
- [X] T012 [P] [US1] Write `packages/core/test/packaging/inventory.test.ts` — each distinct asset appears exactly once however many elements reference it (FR-009), and `mediaType` is present on every entry because a reader cannot infer it (data-model §3)
- [X] T013 [P] [US1] Write `packages/core/test/packaging/secrets.test.ts` — a package contains no credential, no learner identifier, and nothing about the host's storage, asserted by walking the whole document rather than by checking named fields (FR-005, SC-003). A field-name check passes the day somebody adds a field
- [X] T013a [P] [US1] Write `packages/core/test/packaging/base64.test.ts` — a round trip over bytes that are **not text**: every value 0–255, and a payload with a `0x00` in the middle. Both are where a Latin-1 assumption shows, and "does it encode a string" is the test that would pass against the broken implementation (research R-13)
- [X] T014 [P] [US1] Write `packages/core/test/packaging/files-mode.test.ts` — files mode carries content that reconstructs the original bytes; an asset whose content the provider cannot supply **fails the export naming the asset** (FR-006c). A package silently missing one image is worse than no package
- [X] T015 [P] [US1] Write `packages/core/test/packaging/broken-lesson.test.ts` — a lesson that fails validation exports successfully (FR-008). Exporting is not publishing, and refusing to hand somebody their own broken work is the lock-in this feature exists to prevent
- [X] T016 [P] [US1] Write `packages/studio/test/portability/export-control.test.tsx` — the control produces a document and hands it to its callback; it is keyboard-operable with an accessible name and states nothing by colour alone (FR-040, FR-042)

### Implementation for User Story 1

- [X] T016a [P] [US1] Implement `packages/core/src/packaging/base64.ts` — a hand-written codec over `Uint8Array`, and **neither `Buffer` nor `btoa`**. `Buffer.from(...).toString('base64')` typechecks, passes every Node test, and breaks the browser build; `btoa` is browser-only and silently corrupts any byte above `0xFF`. Twenty lines over a fixed alphabet has no platform surface at all, and the constitution requires justification for a dependency that would only save writing them (research R-13, FR-006f)
- [X] T017 [US1] Implement `exportLesson` in `packages/core/src/packaging/index.ts` — reference mode pure and synchronous, files mode taking a caller-supplied content provider that returns **`Uint8Array`**; export encodes, so no caller ever encodes (FR-006e). It also takes the `kind` from the caller, because a draft and a published version are both exportable and the framework cannot tell which it was handed (FR-004d). **The framework never fetches** (research R-02): `AssetAdapter.resolve` returns an address rather than bytes, and turning one into the other needs the network and credentials the framework is forbidden to hold
- [X] T018 [US1] Export the packaging surface from `packages/core/src/index.ts` and add the value exports to `packages/core/test/public-surface.test.ts`
- [X] T019 [US1] Implement the export half of `packages/studio/src/portability/PortabilityControls.tsx` — a control that exports and hands the document to a host callback. **No file browser**: `packages/studio/src` may not read files any more than it may read a clock, and where a lesson is written is the host's choice (research R-09)
- [X] T020 [US1] Add portability styles to `packages/studio/src/styles/editor.css` and export the component and its types from `packages/studio/src/index.ts`
- [X] T021 [US1] Wire export into `examples/nextjs/app/edit/editor-view.tsx`, with the example supplying the download — the file API belongs in the host, which is exactly what R-09's split is for. **Offer both kinds** (FR-043): the working draft, and the version learners currently receive, fetched with the `loadPublished` and `activeId` the page already holds from feature 009. Without the second, `kind: 'published'` is a value nothing produces and the eleventh instance of this project's declared-with-no-producer pattern lands in the export path

**Checkpoint**: a teacher can take their lesson with them. Shippable with no importer in existence.

---

## Phase 4: User Story 2 — A lesson arrives from somewhere else (Priority: P2)

**Goal**: a package becomes a lesson, safely, whoever sent it.

**Independent Test**: import a package produced by US1 and confirm the result equals the original;
then import a deliberately damaged one and confirm the failure is explained rather than silent.

**Depends on**: Phase 2. Its round-trip test additionally needs US1.

### Tests for User Story 2

- [X] T022 [P] [US2] Write `packages/core/test/packaging/roundtrip.test.ts` — every lesson in the corpus exports and imports back identical apart from the identity the caller supplied (SC-001). The whole feature in one assertion, and if it holds for the corpus the rest of export is unlikely to be very wrong
- [X] T023 [P] [US2] Write `packages/core/test/packaging/inspectable.test.ts` — the suite parses the document itself and rebuilds the lesson from what it finds, with **no adapter, no registry, and no framework state** (SC-002). If this needs anything from the producing system, the package is not portable
- [X] T024 [P] [US2] Write `packages/core/test/packaging/harden.test.ts` — oversized, over-nested, and executable-address packages are each refused with the reason named (FR-016a, FR-016b, SC-003a). **Assert size is refused before parsing** by supplying a parse spy that must never be called. Also assert the boundary that is *not* defended: an embedded asset that could carry a script is imported unexamined, because FR-016c requires that limit to be honest rather than implied
- [X] T025 [P] [US2] Write `packages/core/test/packaging/import.test.ts` — every path, success and all six refusals, run **with no storage adapter in existence**. SC-005 is met by construction if this suite can run at all, which is the point of making import pure
- [X] T026 [P] [US2] Write `packages/core/test/packaging/identity.test.ts` — the package's lesson id is discarded for the caller's (FR-015a); identifiers *within* the lesson are untouched (FR-015b); the same package imported twice with two identities yields two independent lessons (SC-005a). The second matters most: rewriting inner ids would mean rewriting every reference to one, including a question's correct answer
- [X] T027 [P] [US2] Write `packages/core/test/packaging/remap.test.ts` — a files-mode package imported into a store that deliberately assigns identifiers unlike the package's produces a lesson whose every reference resolves (SC-005b); a mapping covering only some assets resolves those and **reports the rest unresolved** rather than dropping them or keeping a reference nobody can follow (FR-014c). Include the mode that has no assets to map at all: a **reference-mode** package imported into a system that has never held those assets still produces the lesson, with every reference reported unresolved — FR-006d's exact sentence, and the ordinary case rather than an error
- [X] T027a [P] [US2] Write `packages/core/test/packaging/registry.test.ts` — the two reachable halves of FR-017a: a registry omitting a type the lesson uses reports the **cliff**, and a host's own plugin contributes its `validate` issues where without the option they never arrive. **Not** the case first written here — a lesson with an unregistered *custom* type — because the format's element union is closed and `migrate` ends with an unconditional `validate`, so such a lesson never reaches a registry at all. Found by implementing it
- [X] T028 [P] [US2] Write `packages/core/test/packaging/versions.test.ts` — an older lesson version migrates and reports which steps ran; a newer one is refused **carrying `migrate`'s own issues**, asserted by comparing against what `migrate` returns directly. A second message about the same fact is how two version checks come to disagree (research R-05). Separately, an unknown *package* version is refused by packaging's own check
- [X] T029 [P] [US2] Write `packages/core/test/rules/NFR-SEC-007.test.ts` — the address-scheme allow-list, named for the requirement it discharges: `https:`, `http:`, and `mailto:` pass; `javascript:` and `data:` are refused with the field and the scheme named
- [X] T030 [P] [US2] Write `packages/studio/test/portability/import-control.test.tsx` — the control invokes a host-supplied package source and reports what happened — imported, migrated, or refused and why — rather than leaving a teacher to infer it from whether the editor changed (FR-041). **And assert the import is undoable**: import a package over an edited lesson, undo once, and confirm the previous draft returns byte for byte (FR-015c). `every-kind.test.tsx` already proves `replace-draft` reverses; this proves the import path goes through it rather than around it

- [X] T030a [P] [US2] Write `packages/core/test/packaging/messages.test.ts` — every one of the six `PackageRefusal` reasons names the problem, the object it concerns, and what to do about it (FR-031, NFR-USA-004). A code is not a message: "too-deep" tells a teacher nothing, and the refusals are the only thing they will see when a package does not open. Feature 009 shipped the same suite for its report and it caught real degradation

### Implementation for User Story 2

- [X] T031 [P] [US2] Implement `packages/core/src/packaging/harden.ts` — size checked before parsing, depth immediately after, addresses before the lesson is produced. **The address check walks by key, never by element type.** The only address-bearing field today is a button's `url`, and the shortest correct-looking implementation — `if (element.type === 'button')` — is a switch on element type inside core, which Constitution I calls a defect outright; it would also miss a third-party plugin carrying one. Mirror `idsIn`'s shape: any string value under a key named `url` or `href`, at any depth. **The linter will not catch the mistake**: `no-switch-on-element-type` matches `SwitchStatement` only, so an `if (element.type === ...)` chain passes cleanly — this task text is the only protection, so assert it directly with a third-party element type carrying a `url`. **Record the deviation in the module header**: depth cannot be checked before parsing without a streaming parser, `JSON.parse` throws `RangeError` rather than hanging, and the check turns an engine limit into a named refusal (research R-06)
- [X] T032 [P] [US2] Add `remapAssetIds` to `packages/core/src/validation/assets.ts` and widen the file header from "which assets a lesson references" to "asset references, found and rewritten". **Extract the shared rule first — co-location is not sharing.** `idsIn` collects into an array, so a rewriter that must build a new object cannot reuse it; what has to be shared is the *predicate* (`key === 'assetId'`, a non-empty string value) and the *descent rule*, both currently inline. Note the quirk the rewriter must reproduce exactly: the finder does **not** recurse into a value whose key is `assetId`, because of the `else if`. Assert the agreement directly — a payload with a nested object under an `assetId` key must be seen the same way by both, which is the one input where a re-implemented walk diverges and no other test would notice (research R-04)
- [X] T033 [US2] Implement `readPackage` in `packages/core/src/packaging/index.ts` — the separable first step yielding versions, kind, mode, and asset content **as decoded `Uint8Array`** (FR-006e), so a host meets a storage failure **before** it has a lesson to save and stores bytes rather than text it would have to decode itself (FR-014a, data-model §4)
- [X] T034 [US2] Implement `importLesson` in `packages/core/src/packaging/index.ts` — takes the caller's lesson identity and the asset mapping, delegates the lesson version entirely to `migrate`, and surfaces `checkLesson`'s issues without ever refusing for them (FR-017). **Take the host's element registry as an option and pass it through** (FR-017a): a supplied registry *replaces* the default rather than extending it, so a host with custom types that could not pass one would get every custom element reported as unknown — a lesson called broken because the reader knew about seven types. `registry-cliff.test.ts` already asserts that exact cliff. **FR-013 is discharged by `migrate` and must not be re-implemented**: it ends with an unconditional `validate(working)` whose own comment says "the result must be a valid current-version manifest, not merely a transformed one". A second `validate` call here would be redundant work and a second place to disagree about what valid means — record that in the function header so the next reader does not add one back
- [X] T035 [US2] Export the import surface from `packages/core/src/index.ts` and add it to `packages/core/test/public-surface.test.ts`
- [X] T036 [US2] Implement the import half of `packages/studio/src/portability/PortabilityControls.tsx` — invoking a host-supplied `requestPackage()` rather than reading a file itself, and announcing the outcome
- [X] T037 [US2] Wire import into `examples/nextjs/app/edit/editor-view.tsx` with a file input as the host-supplied source, and apply the imported lesson through **`session.apply({ kind: 'replace-draft', manifest })`** — passing the *open* lesson's identity to `importLesson`, never the package's. The autosave loop then persists it as an ordinary edit, which is FR-015's "one route by which a lesson reaches storage" and also what makes the import undoable: `apply` records a history step for every successful edit, so Ctrl+Z returns the lesson that was open (FR-015c). **Do not save the imported lesson through the persistence loop directly** — that loop is bound to one `lessonId` at mount, so handing it a lesson with a different identity writes one lesson's content into another's slot
- [X] T038 [US2] Add portability cases to `packages/studio/test/a11y/axe.test.tsx` and a keyboard pass in `packages/studio/test/keyboard/portability.test.tsx` — both controls reachable and operable, the outcome announced rather than only rendered (SC-012)

**Checkpoint**: packages round-trip. SCH-3 is complete and demonstrable with no backend.

---

## Phase 5: User Story 3 — A host persists to its own API (Priority: P3)

**Goal**: the editor saves, loads, and publishes against a host's server through a shipped adapter.

**Independent Test**: run the same scenarios against the HTTP adapter over a stub and against the
in-memory reference, and confirm the outcomes match.

**Depends on**: Phase 1 only. Shares nothing with US1/US2 but the adapter interfaces, so it may run
concurrently with either.

### Tests for User Story 3

- [X] T039 [P] [US3] Write `packages/adapter-http/test/outcomes.test.ts`, **and establish the parameterised shape every adapter suite uses from here on** — each suite takes an API shape as a parameter rather than hard-coding the stub's. T053 runs all of them against a second, deliberately dissimilar shape, and a suite written against one shape is a suite T053 rewrites rather than reuses. Then the assertions: — sweep the status space and assert every response lands in exactly one of `permission`, `not-found`, `conflict`, `unavailable`, with none falling through to a fifth meaning (FR-022, SC-007). Include the two that are not statuses: a transport failure, and **a 200 whose body cannot be read**, which must be a failure because a save reported as Saved that was not is the outcome FR-DAT-003 exists to prevent (FR-024)
- [X] T040 [P] [US3] Write `packages/adapter-http/test/discipline.test.ts` — a failing request is attempted **once**, counted (FR-025); a cancelled request settles rather than leaving the editor reporting Saving forever (FR-026); credentials are requested per call and appear in no field the adapter retains (FR-020)
- [X] T041 [P] [US3] Write `packages/adapter-http/test/storage.test.ts` — the save handshake: every save returns a **new** token whether or not it is a checkpoint, a non-checkpoint save still persists, and `loadVersion` returns **the current draft's** token rather than the loaded version's. That last one is the easiest thing in the contract to get subtly wrong and turns the next save into a phantom conflict
- [X] T042 [P] [US3] Write `packages/adapter-http/test/publishing.test.ts` — publish, list newest-first, load, withdraw, restore, and read the record, each mapped and each interpreted; **withdrawn is distinguished from not-found**, because one says a decision was made and can be reversed
- [X] T043 [P] [US3] Write `packages/adapter-http/test/analytics.test.ts` — a failed report is swallowed rather than surfaced, and never interrupts anything. **Assert the failure mode the signature creates**: `AnalyticsAdapter.record(event): void` is synchronous, so an HTTP implementation must start a promise and drop it — a rejecting transport must produce **no unhandled rejection**, asserted by listening for one rather than by trusting the implementation. An unhandled rejection is a process warning or a crash depending on flags, in the one operation whose whole purpose is never to interrupt a lesson
- [X] T044 [US3] Write `packages/adapter-http/test/parity.test.ts` — save, conflict, version history, and publish produce the same outcomes through the HTTP adapter as through `createMemoryStorage` and `createMemoryPublishing` (SC-006). A difference means a host swapping adapters gets different behaviour, which is what the interfaces exist to prevent

- [X] T044a [P] [US3] Write `packages/adapter-http/test/messages.test.ts` — each of the four outcomes carries a message a caller can put in front of a teacher, and the four are distinguishable in words rather than only in a discriminant (FR-031). A host that maps all four to "something went wrong" has discarded the distinction FR-022 exists for, one layer above where T039 can see it

### Implementation for User Story 3

- [X] T045 [P] [US3] Implement `packages/adapter-http/src/mapping.ts` — the `OperationMapping` type covering every operation in [contracts/http-operations.md §2](./contracts/http-operations.md)
- [X] T046 [P] [US3] Implement `packages/adapter-http/src/classify.ts` — the default status classifier, replaceable by the host. **Record why this does not breach FR-019b** in the module header: a classifier names no path and no resource, and encodes the published HTTP status vocabulary rather than an opinion about anybody's API (research R-07)
- [X] T047 [US3] Implement `packages/adapter-http/src/request.ts` — perform once, thread credentials, honour cancellation, never retry, and treat an unreadable success body as a failure. The injectable request function defaults to the platform `fetch` and is what makes SC-011 achievable
- [X] T048 [P] [US3] Implement `packages/adapter-http/src/storage.ts` — `StorageAdapter` over the mapping
- [X] T049 [P] [US3] Implement `packages/adapter-http/src/assets.ts` — `AssetAdapter` over the mapping
- [X] T050 [P] [US3] Implement `packages/adapter-http/src/analytics.ts` — `AnalyticsAdapter`, fire-and-forget, **with the rejection caught at the boundary**. `record` returns `void`, so the promise is dropped by the interface's own shape rather than by choice; catching it is what makes "fire and forget" mean forgotten rather than unhandled
- [X] T051 [P] [US3] Implement `packages/adapter-http/src/publishing.ts` — `PublishingAdapter` over the mapping
- [X] T052 [US3] Implement `createHttpAdapters(mapping, options)` in `packages/adapter-http/src/index.ts`, returning all four adapters from one construction

**Checkpoint**: a host can persist to its own API. PB-3's capability exists.

---

## Phase 6: User Story 4 — Connecting the API you already have (Priority: P4)

**Goal**: the adapter works against an API that was not designed for it.

**Independent Test**: point it at a stub with deliberately unusual routes, headers, and response
shapes; supply only the mapping; confirm the full suite passes with no change to the adapter.

**Depends on**: US3.

### Tests for User Story 4

- [X] T053 [US4] Write `packages/adapter-http/test/shapes.test.ts` — run the suites T039–T044 established as parameterised against **both** shapes from T006, with only the mapping differing (SC-008). One shape proves nothing; the second is what demonstrates the adapter is not quietly built around the first
- [X] T054 [P] [US4] Write `packages/adapter-http/test/completeness.test.ts` — an incomplete mapping is refused **at construction**, naming every missing operation rather than the first (FR-019a, SC-008a). A mapping discovered to be incomplete an hour into somebody's work is the worst moment to discover it
- [X] T055 [P] [US4] Write `packages/adapter-http/test/unmapped.test.ts` — a response the mapping does not describe produces a failure the caller can act on rather than being treated as success

### Implementation for User Story 4

- [X] T056 [US4] Implement the construction-time completeness check in `packages/adapter-http/src/mapping.ts`, collecting every missing operation before reporting
- [X] T057 [US4] Write `packages/adapter-http/README.md` — what the package is, how to supply a mapping, and a worked example that is **plainly an example**. FR-019b forbids a default mapping presented as correct, and a README example that reads like a specification is that default arriving by another route
- [X] T058 [US4] Verify [contracts/http-operations.md](./contracts/http-operations.md) matches what was built, operation by operation, and correct whichever is wrong. The contract was written before the code; a contract that has drifted from the adapter is worse than none, because a host will implement it

**Checkpoint**: all four stories delivered. SCH-3 and PB-3 complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T059 [P] Write `packages/core/test/perf/packaging.test.ts` — reference-mode export of the 50-slide / 300-element fixture well inside three seconds, reached through `packages/core/test/harness/large.ts` so the number is comparable with feature 009's (SC-010)
- [X] T060 [P] Update `packages/core/README.md` with the package format, the two asset modes, the two-step import, and the point a host will otherwise learn the hard way: **import produces a lesson and stores nothing**, so the caller saves it through the path it already uses
- [X] T061 [P] Update `packages/studio/README.md` with the two controls and why neither reads a file
- [X] T062 Update `docs/cuestack_framework_plan.md` — SCH-3 and PB-3 to ✅, `migrate` recorded as gaining its second consumer and its first untrusted input, **the coverage-scope gap written down**: the floor's `include` list is meant to widen "as each lands" and has been skipped for `validation/`, `publishing/`, and `elements/`, so most of `@cuestack/core` sits outside a floor the constitution states plainly — T002 widened it for `packaging/` only and closing the rest is a decision somebody should make deliberately. And **research R-06's finding written down**: `elementSchema` permits `javascript:` in a button's address today, for any lesson, and this feature deliberately did not fix it because tightening the schema rejects manifests that are valid now and needs its own decision about versioning and migration
- [X] T062a Verify the example end to end (FR-043, SC-013) — build `examples/nextjs`, export a lesson from `/edit`, import the result back, and confirm the lesson returns with no backend and no network. **Export both kinds** and confirm each package's `kind` matches what was asked for (FR-004d, FR-043). Wiring is not demonstration: T021 and T037 connect the controls and nothing yet proves the round trip survives the host boundary they cross
- [X] T063 Confirm SC-009 by inspection and by build: no existing package depends on `@cuestack/adapter-http`, `pnpm lint` passes the boundary rules, and every existing suite passes with the new package present
- [X] T064 Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage && pnpm gates && pnpm check:rules && pnpm check:packaging && pnpm check:isolation && pnpm check:studio-isolation && pnpm check:data-model && pnpm check:migrations` from the repository root and confirm every one is green. **The last five are what CI runs and earlier features' equivalents of this task omitted** — and `check:packaging` matters here specifically: this is the first feature to add a package since it was written, and a malformed `exports` map is exactly what it catches and exactly what the shorter command list would miss. `check:rules` must still read **18 of 18** — this feature adds no business rule and must remove none. Note one honest limit: `check:data-model` defaults to `specs/001-framework-foundation/data-model.md`, so it is a repository-wide check that must stay green rather than a check of *this* feature's data model.

  **Result: eleven of twelve green.** `pnpm test:coverage` fails on branch coverage at 89.03% against
  a 90% floor — **pre-existing**, measured at 88.57% with this feature's code removed, so `packaging/`
  (95.58% branches) improved it. CI runs this gate, so it is red there too. Recorded in the framework
  plan; the fix is a repo-wide decision rather than this feature's to make
- [X] T065 Verify the negative controls by deliberate breakage across `packages/core/src/packaging/`, `packages/core/src/validation/assets.ts`, and `packages/adapter-http/src/`, restoring each afterwards: make export mutate the manifest it was given (T022 must fail); drop the `mediaType` from a packaged asset (T012 must fail); let import reuse the package's lesson id (T026 must fail); accept `javascript:` in the allow-list (T029 must fail); let the adapter retry once on failure (T040 must fail); make `loadVersion` return the loaded version's token instead of the current draft's (T041 must fail); and let the completeness check report only the first missing operation (T054 must fail).

  **Result: all seven fired**, first attempt, with no gaps of the kind feature 009 found. Each break was restored and the suite reverified afterwards.
- [ ] T066 Perform the manual keyboard and screen-reader pass from [quickstart.md §18](./quickstart.md) — four steps, with a screen reader running — and record the result in the pull request

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)
   ├──► Phase 2 (the document's shape)
   │       ├──► Phase 3 (US1 — export)   ── shippable alone, MVP
   │       └──► Phase 4 (US2 — import)   ── round-trip test additionally needs US1
   └──────────► Phase 5 (US3 — the adapter)
                   └──► Phase 6 (US4 — the mapping)
```

**US3 does not depend on Phase 2.** The adapter shares nothing with packaging but the adapter
interfaces, which already exist — so the two halves of this feature can be built by two people who
never touch the same file.

**US2 depends on Phase 2 rather than on US1.** Only its round-trip test (T022) needs export, and that
is one test rather than a phase ordering.

**Within US2, the harden and remap modules come before the import path.** T031 and T032 are what T033
and T034 compose; an import written first would pass its own tests against checks that do not exist.

## Parallel opportunities

**Phase 1** — T002, T003, and T004 are three separate files; T005 and T006 wait on T001.

**Phase 3** — T009 through T016 are eight independent test files, the largest fan-out in the feature.

**Phase 5** — T039 through T043 are five independent suites, and T048 through T051 are four
independent adapters over one shared request path.

**Across phases** — one developer can take US1 and US2 end to end while another takes US3 and US4.
They meet only at the root configuration files, all three of which are touched in Phase 1.

**One shared file inside that split**: T019 and T036 both edit `PortabilityControls.tsx`, in different
phases. Safe as planned, because US1 and US2 belong to the same person above — but it is the one place
where splitting them differently would collide.

## Implementation strategy

**MVP is Phase 1 + Phase 2 + Phase 3.** Twenty-one tasks, entirely inside `@cuestack/core` and one
studio control. It delivers §7.7's anti-lock-in promise on its own: a teacher can take their lesson
somewhere else, and a package that can be read by hand needs no importer to be worth having.

**Then Phase 4**, which makes the promise round-trip and is where the risk lives — this is the first
untrusted input this framework has ever read.

**Then 5 and 6**, which can equally have run alongside everything above.

**Test-first throughout, and the tests are expected to fail when written.** Packaging is pure and the
adapter's request function is injected, so every suite is a table with no clock and no network. That
is not a style preference: it is what lets SC-005 ("import writes nothing") be met by construction —
the suite runs with no storage adapter in existence, so there is nothing a failure could strand.

**T065 is not optional.** Seven of this feature's guarantees pass by accident if nobody checks: an
export that mutates what it was given, a package missing the media type nobody can infer, an import
that reuses an id and overwrites somebody's lesson, an allow-list that lets an executable address
through, an adapter that retries beside a save loop that already does, a token handshake that turns
every save into a phantom conflict, and a completeness check that reports one missing operation out
of six. Every one of those leaves the rest of the suite green.
