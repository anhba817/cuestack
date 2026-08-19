---

description: "Task list for feature 009 — Validation and Immutable Publish (PB-1, PB-2)"
---

# Tasks: Validation and Immutable Publish

**Input**: Design documents from `/specs/009-validation-and-publish/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required, and test-first. Constitution II names the validation engine explicitly in its
test-first list, and every business rule must have a test named for its rule id. The engine is pure,
so most of this feature's suites need no DOM at all — if one starts reaching for happy-dom, something
has moved to the wrong side of the line.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1…US5, matching the spec's five user stories
- Every task names the exact file it touches

## Path conventions

Monorepo: `packages/{schema,core,react,studio}/src|test`, `examples/nextjs`, `tools/scripts`.

## Shared files

Eleven files are touched by more than one phase. The distinction below is what keeps the phases
genuinely parallel rather than nominally so — feature 008 learned this the expensive way, by
claiming a parallelism its file ownership did not support.

### Single-owner — one task writes it; other phases fold their changes in

| File | Owner | Why |
|---|---|---|
| `packages/core/src/publishing/index.ts` | T010 (Foundational) | The interface is declared once; later stories implement against it, never widen it |
| `packages/core/src/publishing/memory/index.ts` | T011 (Foundational), extended in order by T048, T054, T062 | One reference adapter, growing a capability per story |
| `packages/studio/src/persistence/useDraftPersistence.ts` | T014 (Foundational) | The only change this feature makes to a file feature 008 owns |
| `packages/core/src/validation/index.ts` | T032 (US1) | The composition. US2 calls it; nothing else edits it |
| `packages/studio/src/publishing/PublishControls.tsx` | T042 (US2), extended by T060 (US5) | Publish, withdraw, and restore are one control group; splitting them across two components would give a teacher two places to look |
| `packages/studio/src/publishing/usePublishing.ts` | T041 (US2) | The ordered flow. US5 adds actions to the same hook rather than a second one |

### Sequential, not concurrent

`packages/core/README.md` is written by T050 (US3) and completed by T066 in polish, which runs after
every story. They never overlap in time.

`packages/core/src/validation/severity.ts`, `validation/index.ts`, `publishing/memory/index.ts`, and
`publishing/usePublishing.ts` all appear in T069 as well. That task **breaks each on purpose and
restores it**, which is a negative control rather than an edit.

### Append-only — every phase adds a block, nobody edits another phase's

**Append at the end, never edit in place.** Four phases extend each of these, and a reformat is a
merge conflict for everybody.

| File | Phases that append |
|---|---|
| `packages/core/src/index.ts` | T012, T029c, T033, T050 |
| `packages/core/test/public-surface.test.ts` | T012, T029c, T033 |
| `packages/studio/src/registry/editors.ts` | T029b1 (US1) |
| `packages/studio/src/inspector/Inspector.tsx` | T029b2 (US1) |
| `packages/studio/src/index.ts` | T036 (US1), T043, T055, T061 |
| `packages/studio/src/styles/editor.css` | T036 (US1), T043, T055, T061 |
| `packages/studio/test/a11y/axe.test.tsx` | T027 (US1), T044, T055, T061 |
| `packages/studio/test/keyboard/publishing.test.tsx` | T044 (US2) creates, T055 and T061 append |

---

## Phase 1: Setup (Shared Fixtures and Doubles)

**Purpose**: The lessons and adapters every later phase drives. Nothing here ships.

- [X] T001 [P] Create a corpus of deliberately faulty lessons in `packages/core/test/harness/faulty.ts` — a dead-end question, a slide whose advance names a non-media element, an element outside its slide, an image with no alt text, a lesson with no slides, and one lesson that is entirely correct
- [X] T002 [P] Extend `packages/core/test/harness/plugins.ts` with a plugin for an invented element type whose `validate` returns a known issue, and a second whose `validate` throws — the two doubles that prove the engine has no type branch and survives a broken plugin
- [X] T003 [P] Create a recording `PublishingAdapter` double in `packages/core/test/harness/publishing.ts` — records every call, can be told to refuse with `permission`, `unavailable`, or `conflict`, and wraps the real in-memory reference so a test cannot pass because the double was more forgiving
- [X] T004 [P] Add a 50-slide / 300-element fixture accessor for core perf suites in `packages/core/test/harness/large.ts`, reading the same fixture the studio measures against
- [X] T005 Extend the studio harness in `packages/studio/test/harness/editor.tsx` with validation and publishing options, and handles for the report, the publish controls, and the version list — depends on T003

---

## Phase 2: Foundational (The Publishing Boundary)

**Purpose**: The fourth adapter, and the one change to feature 008's save loop.

**⚠️ Blocks US2, US3, US4, and US5.** It does **not** block US1 — validation touches no publishing at
all, which is what makes it the MVP and lets it proceed while this happens.

**Rebuild after this phase.** The studio resolves core through its package entry, and
`@cuestack/react` carries a freshness guard that will tell you if you forget.

- [X] T006 [P] Write the failing contract test for publication in `packages/core/test/publishing/publish.test.ts` — publishing returns a version carrying its publisher, its time, its version number, and the schema version it was published under; the time comes from the injected clock and never from the framework
- [X] T007 [P] Write the failing contract test for reading in `packages/core/test/publishing/load.test.ts` — `loadPublished` with no id returns the active version; with an id returns that one; **active, withdrawn, and not found are three distinguishable answers** (FR-029a)
- [X] T008 [P] Write the failing contract test for the record in `packages/core/test/publishing/record.test.ts` — every action appends one entry with its actor and time, entries are oldest first, and attempts to push, splice, or reassign an entry all fail
- [X] T009 [P] Write the failing contract test for immutability in `packages/core/test/publishing/frozen.test.ts` — a manifest from `loadPublished` throws on mutation at the top level and deep inside a slide's elements
- [X] T010 Declare `PublishingAdapter`, `PublishedVersion`, `RecordEntry`, and the result types in `packages/core/src/publishing/index.ts`, with a header stating what is deliberately absent: no update, no delete, no record edit, no arbitrary `setActive` (research R-04)
- [X] T011 Implement `createMemoryPublishing()` in `packages/core/src/publishing/memory/index.ts` — all six methods, an injected `now` so `publishedAt` is deterministic, and a deep freeze on read; makes T006–T009 pass
- [X] T012 Export the publishing types and the reference adapter from `packages/core/src/index.ts`, and add the new value exports to the list in `packages/core/test/public-surface.test.ts` — that guard exists because feature 002 shipped two capabilities that were "built, tested, and unreachable", and it checks names resolve rather than forbidding extras, so it will not fail on its own if this is forgotten
- [X] T013 [P] Write the failing test for the save loop's new return in `packages/studio/test/persistence/save-outcome.test.tsx` — `saveNow()` resolves once the save has landed, resolves with a failure when it has not, and an existing caller that ignores the promise behaves exactly as before
- [X] T014 Change `saveNow()` to return `Promise<SaveOutcome>` in `packages/studio/src/persistence/useDraftPersistence.ts` — additive, because publishing must know whether the save landed before it publishes anything (FR-018a, research R-08)
- [X] T015 Export `SaveOutcome` from `packages/studio/src/index.ts`

---

## Phase 3: User Story 1 — A teacher finds out what is wrong before anyone else does (P1) 🎯 MVP

**Goal**: A validation report — every issue, with severity, location, a message a teacher can act on,
and one action to reach the source.

**Independent test**: Open a lesson with several deliberate problems, validate it, and confirm each is
reported with its slide, its element where it has one, and a severity. Choose one and confirm the
editor goes to it.

**Depends on**: Phase 1 only.

### Tests (write first, expect red)

- [X] T015a [P] [US1] Write `packages/core/test/validation/shape.test.ts` — every issue carries a `source`; a code declared by both vocabularies (`UNKNOWN_ELEMENT_TYPE`) is distinguishable by it; a plugin's arbitrary code arrives under `source: 'plugin'` with a `path` and `location` the engine supplied, because `PluginIssue` carries neither (research R-03)
- [X] T016 [P] [US1] Write `packages/core/test/validation/composition.test.ts` — the engine **delegates**: a broken advance rule produces the code `checkReachability` produces, a structurally invalid lesson produces the schema's own codes, and an element outside its slide produces `collectProblems`' code. Assert the codes match the existing sources exactly, because the failure this guards against is a fourth opinion (research R-01)
- [X] T017 [P] [US1] Write `packages/core/test/validation/no-type-branch.test.ts` — register the invented-type plugin from T002 and assert its issues appear in the report. If the engine ever grows a `switch (element.type)`, a type it has never heard of silently stops being validated and this fails. Assert the other half too: all **seven** MVP types contribute their own checks, because a suite that only exercised an invented type would pass against an engine that validates nothing a teacher can author (SC-001)
- [X] T018 [P] [US1] Write `packages/core/test/validation/deterministic.test.ts` — validate one lesson twice and compare the **arrays**, not sets; slides in document order, elements within a slide in document order (FR-007)
- [X] T019 [P] [US1] Write `packages/core/test/interactions/dead-end.pure.test.ts` — `isDeadEnd` is true for `on_correct` with a finite `maxAttempts` and false for everything else: `on_first_attempt` completes on anything, `on_attempts_exhausted` completes by definition, and unlimited attempts cannot exhaust (research R-02)
- [X] T019a [P] [US1] Write `packages/core/test/elements/builtin.test.ts` — a table, one row per MVP type: what each `validate` reports and what it deliberately does not. `question` reports a single-option question and an empty prompt; it does **not** report a correct answer naming no option, because the format already does and two issues for one fault is the duplication this engine exists to avoid (FR-006c). Include registration itself: an incomplete builtin is refused by `assertComplete` with a message naming the missing member, exercised deliberately rather than discovered when an import fails (research R-15)
- [X] T019b [US1] Write `packages/core/test/elements/inert-resolve.test.ts` — registering the seven changes **zero** rendered output. Resolve the same slides with an empty registry and with `builtinElements`, and compare the `RenderState`s. This is Constitution V asserted across the change rather than assumed (FR-006b, SC-001a)
- [X] T019b1 [US1] Write `packages/studio/test/inspector/plugin-precedence.test.tsx` — the inspector panel is **identical** with and without the plugin registry, for all seven types. Then the case a cast would hide: a type whose editor entry carries a `fromStored`/`toStored` transform keeps it when a plugin also describes that type, because `EditorField extends InspectorField` and the plugin path is cast rather than converted. `fields.ts`'s header names the failure — a colour picker that "never works" — and no element type uses a transform yet, which is why this is the moment to pin it. Assert the field-level extra that **is** in use today: after derivation, `question`'s options field still mints a valid new option, because `itemDefaults` survived the merge (FR-006b, research R-13)
- [X] T019c [US1] Write `packages/core/test/elements/registry-cliff.test.ts` — with the seven registered, an **eighth** unregistered type is reported `UNKNOWN_ELEMENT_TYPE`, and an unregistered *required question* is reported as blocking rather than merely unknown. Both were unreachable before, because an empty registry treated every type as known. Then the case a host will meet: a registry holding **only** a custom plugin reports all seven MVP types as unknown, because `resolve` reads `context?.elements ?? DEFAULT_ELEMENTS` and a supplied registry replaces the default rather than extending it — so composing `[...builtinElements, mine]` moves from irrelevant to mandatory (research R-13)
- [X] T020 [P] [US1] Write `packages/core/test/validation/severity.test.ts` — a policy raises a governed code to error and lowers it to warning; **a policy cannot silence a rule**; it cannot move a schema issue out of `error`; and a plugin's arbitrary code defaults to `error` and can be lowered by name (FR-010a, FR-010b, research R-07)
- [X] T021 [US1] Write `packages/core/test/validation/resilience.test.ts` — a plugin whose `validate` throws produces one `PLUGIN_VALIDATE_FAILED` against that element, and every other issue in the lesson is still reported
- [X] T022 [US1] Write `packages/core/test/validation/completeness.test.ts` — every issue in one pass rather than the first (FR-001); a lesson with nothing wrong reports zero issues and `blocks: false` (FR-011); validation leaves the manifest byte-identical (FR-012)
- [X] T023 [US1] Write `packages/core/test/validation/assets.test.ts` — `collectAssetRefs` is pure and finds every reference; `checkAssets` reports unresolvable ones as warnings; **the engine completes with no asset resolver supplied at all**, returning every other issue (SC-002a, FR-016a)
- [X] T024 [US1] Write `packages/core/test/rules/BR-012.test.ts` — accessibility metadata is reported every time it is missing, at warning by default and at error under policy, and the policy cannot make it disappear. Assert it is reported for an element type whose plugin has **no** `validate` of its own: `accessibility` is a common field beside `payload`, so this is the engine's rule and must not depend on a plugin implementing it (research R-10)
- [X] T025 [US1] Write `packages/studio/test/validation/report.test.tsx` — the report groups errors and warnings, states severity **as a word**, and shows a lesson with no issues as a plain statement rather than an empty region
- [X] T025a [US1] Write `packages/core/test/validation/messages.test.ts` — every issue the engine can produce names the object it concerns and says what to do about it (FR-004, NFR-USA-004). A code is not a message, and the existing sources already write full sentences: this asserts the engine does not degrade them on the way through
- [X] T026 [US1] Write `packages/studio/test/validation/jump.test.tsx` — choosing an issue navigates to its slide and selects its element; an issue with no element navigates to the slide and selects **nothing**, because selecting the first element would point a teacher at the wrong thing confidently (FR-005)
- [X] T027 [US1] Add validation-report cases to `packages/studio/test/a11y/axe.test.tsx` — severity is not conveyed by colour alone, and the report has an accessible name

### Implementation

- [X] T028 [P] [US1] Declare the closed union of semantic codes and their inherent severities in `packages/core/src/validation/codes.ts` — **all eleven** from [data-model.md §3](./data-model.md), not a selection, because an omitted code is one the report cannot carry. Separate from `@cuestack/schema`'s `ISSUE_CODES` because that union is the schema package's public contract, and paired with a `source` discriminator because `UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE` are declared by **both** vocabularies and mean different things at the two tiers (research R-03)
- [X] T029 [P] [US1] Implement `severityFor(code, source, policy)` in `packages/core/src/validation/severity.ts` — pure, with no `off`, no way to move a schema issue, and plugin codes defaulting to `error` while remaining governable (research R-07)
- [X] T029a [P] [US1] Implement BR-012's rule in `packages/core/src/validation/accessibility.ts` — it reads `element.accessibility`, a **common** field beside `payload` that `ElementPlugin.validate(payload)` cannot see, which is why it is the engine's rule rather than every plugin author's (research R-10)
- [X] T029b [US1] Implement the seven MVP element plugins in `packages/core/src/elements/builtin/` — one file per type, each supplying the full contract Constitution I requires. **`resolve` returns `{ visible: true }` and contributes nothing**, which is exactly what the code already does when no plugin exists; a plugin that contributed geometry or style would change what every lesson renders inside a feature about adding checks. **`inspector` carries that type's canonical field list**, becoming the one place it is declared. **`schema` delegates to `@cuestack/schema`'s per-type validation** rather than hand-rolling a guard: nothing anywhere calls `schema`, so seven bespoke ones would be seven places to drift from the format they claim to check (research R-12, R-13, R-14)
- [X] T029b1 [US1] Derive `builtinElementEditors`' `inspector` from `builtinElements` in `packages/studio/src/registry/editors.ts` rather than restating it. **Merge per field, by key** — `defaults` and `textSurface` are type-level, but `fromStored`/`toStored` and `itemDefaults` hang off individual fields, and `question`'s options field carries an `itemDefaults` *function* that `InspectorField` has no room for. A type-level spread would drop it and "Add option" would silently do nothing, which is the exact failure its own comment records. Two hand-maintained lists joined by a cast is the two-sources-of-truth failure this whole engine is arranged against (research R-13)
- [X] T029b2 [US1] Merge rather than choose, in `packages/studio/src/inspector/Inspector.tsx`: a registered plugin's field list wins — feature 005's **FR-018** requires it and two of its suites assert it — and this package overlays **by key** only the three members that describe editing rather than the field (`toStored`, `fromStored`, `itemDefaults`). Overlaying the whole editor entry would let it override a plugin's own label, so a host registering a plugin to rename a field would find the rename ignored (research R-13)
- [X] T029c [US1] Build `DEFAULT_ELEMENTS` from `builtinElements` in `packages/core/src/resolve/index.ts`, and export `builtinElements` from `packages/core/src/index.ts`, adding it to `packages/core/test/public-surface.test.ts`. Note the new failure mode in the module's header: `createElementRegistry` validates at construction and **throws**, so building the default at module scope means a malformed builtin fails the *import* of `@cuestack/core` rather than a test. That is the right trade — a missing `validate` on a builtin is exactly what this feature exists to stop passing silently — and it is new, so it is written down (research R-15)
- [X] T029d [US1] Migrate every existing suite the registration breaks, **across the whole workspace** rather than core alone. Two kinds: suites relying on the empty-registry escape to use an invented element type, since `elements.types().length === 0` is now false and those types are reported unknown; and `packages/studio/test/inspector/fields.test.tsx` and `packages/studio/test/inspector/scope.test.tsx`, which already pass a plugin registry and are the only places the precedence T029b2 inverts is exercised today. Find them with `pnpm test` after T029c and fix each in place rather than re-emptying the registry
- [X] T030 [P] [US1] Add `isDeadEnd(policy, maxAttempts)` to `packages/core/src/interactions/policy.ts`, immediately below the `isUnsatisfiable` it mirrors — one rule asked at two moments, and separating them is how they come to disagree
- [X] T031 [P] [US1] Implement `collectAssetRefs` (pure) and `checkAssets` (async, optional) in `packages/core/src/validation/assets.ts` — both halves of FR-016 share the finder, because two rules disagreeing about which assets a lesson uses is a defect (FR-016b)
- [X] T032 [US1] Implement `checkLesson` in `packages/core/src/validation/index.ts` — compose `validate`, `checkReachability`, `collectProblems`, `ElementPlugin.validate`, `isDeadEnd`, and T029a's accessibility rule into one ordered report. It owns no rule of its own beyond arrangement, and it defaults its registry to `builtinElements` so a caller that passes none still gets the seven types' checks rather than silence
- [X] T033 [US1] Export the engine, the codes, the policy type, and the report type from `packages/core/src/index.ts`, adding the value exports to `packages/core/test/public-surface.test.ts` for the reason T012 gives
- [X] T034 [US1] Implement `useValidation` in `packages/studio/src/validation/useValidation.ts` — runs the engine on request, holds the report, and exposes a jump that uses the same `goToSlide` and `select` every other surface uses
- [X] T035 [US1] Implement `packages/studio/src/validation/ValidationReport.tsx` — errors and warnings grouped, each naming its slide and element, severity carried by a word
- [X] T036 [US1] Add report styles to `packages/studio/src/styles/editor.css` and export the hook, the component, and their types from `packages/studio/src/index.ts`

**Checkpoint**: validation is complete and useful on its own. A teacher can find the dead end, the overrun, and the unlabelled image before a learner does, with no publishing in the product at all.

---

## Phase 4: User Story 2 — A lesson with errors cannot be published (P2)

**Goal**: The gate. Errors stop a publish; warnings do not; and a refusal never touches the draft.

**Independent test**: Attempt to publish a lesson carrying an error and confirm nothing is published
and the errors are shown. Fix them, leaving a warning, and confirm publishing succeeds.

**Depends on**: Phase 2 and US1.

- [X] T037 [US2] Write `packages/studio/test/publishing/blocks.test.tsx` — an error stops the publish and the errors are shown; warnings alone do not stop it (FR-013, FR-014, SC-002)
- [X] T038 [US2] Write `packages/studio/test/publishing/fresh.test.tsx` — publishing validates immediately beforehand and never trusts an earlier report; edit a lesson into an invalid state after a clean report and confirm the publish is refused (FR-015)
- [X] T039 [US2] Write `packages/core/test/rules/BR-018.test.ts` — a published package references only assets that resolve; an unresolvable reference refuses the publish and names it
- [X] T040 [US2] Write `packages/studio/test/publishing/refusals.test.tsx` — **four paths, one assertion each way**: validation errors, an unresolvable asset, a permission refusal, and a save that could not land. Every one leaves the draft byte-identical and publishes nothing (FR-017, SC-012), and each says something the others do not — a teacher told "could not publish" about a network failure searches their lesson for a fault that is not there
- [X] T041 [US2] Implement `usePublishing` in `packages/studio/src/publishing/usePublishing.ts` — the ordered flow from [publishing-contract.md §6](./contracts/publishing-contract.md): save, validate, check assets, publish, and a distinct refusal at each step
- [X] T042 [US2] Implement `packages/studio/src/publishing/PublishControls.tsx` — publish, and what stopped it, reusing ED-5's four-word status vocabulary rather than growing a second one (Constitution III)
- [X] T043 [US2] Add publish styles to `packages/studio/src/styles/editor.css` and export the hook, the component, and their types from `packages/studio/src/index.ts`
- [X] T044 [US2] Add publish-control cases to `packages/studio/test/a11y/axe.test.tsx` and create a keyboard pass in `packages/studio/test/keyboard/publishing.test.tsx` — the refusal is announced rather than only rendered

**Checkpoint**: nothing broken reaches a learner.

---

## Phase 5: User Story 3 — What was published stays published (P3)

**Goal**: BR-008 and BR-009, enforced by the shape of the interface and caught by a freeze.

**Independent test**: Publish, edit the draft heavily, and confirm the published version is
byte-identical. Confirm no route through the framework can change it.

**Depends on**: Phase 2. T047's undo step needs US1 only for the fixture, not for behaviour.

- [X] T045 [US3] Write `packages/core/test/rules/BR-008.test.ts` — take the manifest `loadPublished` returned and attempt to mutate it at the top level, inside `slides`, and inside a slide's `elements`; all three must throw. Then assert by inspection that `PublishingAdapter` declares no method that modifies a version
- [X] T046 [US3] Write `packages/core/test/rules/BR-009.test.ts` — publish, then save many draft changes, and confirm the published version is byte-identical to what was published
- [X] T047 [US3] Write `packages/studio/test/publishing/immutable.test.tsx` — the same property through the editor: publish, then add, delete, undo, and restore a version, and compare byte for byte (SC-003). Include the other direction (FR-036): a **successful** publish leaves the draft, the undo history's depth, and the save state exactly as they were. Publishing runs a save, so it touches all three, and only the refusal path is covered elsewhere
- [X] T048 [US3] Write `packages/core/test/publishing/standalone.test.ts` — a published version plays with no draft present and no draft storage reachable (FR-021), and keeps the schema version it was published under rather than being migrated (FR-023)
- [X] T049 [US3] Implement the deep freeze in `packages/core/src/publishing/memory/index.ts` — applied on read rather than on write, because the object handed out is the one a renderer might mutate. The draft is deliberately not frozen: it is resolved sixty times a second (research R-05)
- [X] T050 [US3] Export `PublishedVersion` and the result types from `packages/core/src/index.ts`, and document in `packages/core/README.md` what the adapter deliberately lacks

**Checkpoint**: a teacher can edit a published lesson without fear, which is the behaviour the whole feature exists to make safe.

---

## Phase 6: User Story 4 — A newer version can be published (P4)

**Goal**: Publish again. Earlier versions stay; exactly one is active.

**Independent test**: Publish three times, confirm three versions exist, exactly one is active, it is
the newest, and the first two are unchanged.

**Depends on**: Phase 2 and US2.

- [X] T051 [US4] Write `packages/core/test/publishing/versions.test.ts` — three publishes produce three versions, exactly one active, the newest active, and the earlier two byte-identical to what they were. The last assertion is what catches an adapter that stores one version and overwrites it
- [X] T052 [US4] Write `packages/core/test/publishing/listing.test.ts` — versions are listed newest first, each carrying its publisher and its time, and listing never loads a version's content. Also FR-027: a version's id is stable across reads and across a later publish, and the framework's exported surface contains **no** URL builder — it provides the identifier a host puts behind a URL, and ships no server
- [X] T053 [US4] Implement version sequencing and the active pointer in `packages/core/src/publishing/memory/index.ts` — the pointer is a property of the lesson, not a field on a version, which is what lets withdrawal change availability without touching anything immutable
- [X] T054 [US4] Implement `packages/studio/src/publishing/VersionList.tsx` — published versions newest first, each naming its publisher and when it was published, formatted with `Intl.DateTimeFormat` because `new Date(ms)` fails `no-clock-in-studio` (feature 008's research R-13 — the rule and its remedy are unchanged here)
- [X] T055 [US4] Add version-list styles to `packages/studio/src/styles/editor.css`, export from `packages/studio/src/index.ts`, and add cases to `packages/studio/test/a11y/axe.test.tsx` and `packages/studio/test/keyboard/publishing.test.tsx`

**Checkpoint**: publishing is a habit rather than a demonstration.

---

## Phase 7: User Story 5 — Withdrawal, and the record (P5)

**Goal**: A lesson can be withdrawn without being destroyed, and every action is on a record nobody
can quietly edit.

**Independent test**: Publish, withdraw, and confirm nothing is active while both the version and the
record of both actions remain.

**Depends on**: Phase 2 and US4.

- [X] T056 [US5] Write `packages/core/test/publishing/withdraw.test.ts` — withdrawal leaves no version active, deletes nothing, and makes `loadPublished` answer **withdrawn** rather than **not found**; restoring makes it active again and creates no new version (FR-029a, FR-031)
- [X] T057 [US5] Write `packages/core/test/publishing/permission.test.ts` — a refused publish, withdrawal, or restoration changes nothing, says permission is what is missing rather than that something broke, and the framework holds no roles of its own (FR-032, FR-032a, SC-009a)
- [X] T058 [US5] Write `packages/core/test/publishing/uninterrupted.test.ts` — withdrawing while a version is being played does not interrupt it, and the state is discoverable so a host can decide (FR-029b). The framework cannot know whether this withdrawal is a correction or an end-of-term tidy-up
- [X] T059 [US5] Implement withdraw, restore, and the append-only record in `packages/core/src/publishing/memory/index.ts` — every action appends one entry; nothing removes or alters one
- [X] T060 [US5] Implement withdraw and restore controls in `packages/studio/src/publishing/PublishControls.tsx`, and the record view in `packages/studio/src/publishing/PublicationRecord.tsx`
- [X] T061 [US5] Add record styles to `packages/studio/src/styles/editor.css`, export from `packages/studio/src/index.ts`, and add cases to `packages/studio/test/a11y/axe.test.tsx` and `packages/studio/test/keyboard/publishing.test.tsx`

**Checkpoint**: all five stories delivered.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T062 Write `packages/core/test/validation/inert.test.ts` — validating a lesson leaves it byte-identical, and the report holds no reference that would let a caller mutate the manifest through it (FR-012)
- [X] T063 Write `packages/core/test/perf/validation.test.ts` — the 50-slide / 300-element fixture validated within one second, with the asset pass excluded because it is network-bound and would measure the host rather than the engine (SC-005)
- [X] T064 Update `tools/scripts/check-rule-coverage.mjs` — move BR-008, BR-009, BR-012, and BR-018 out of the deferred set and into `EXPECTED`, taking the gate from 14 of 18 to **18 of 18** (SC-007). Every business rule in the specification now has a rule-named test
- [X] T065 Wire validation and publishing into `examples/nextjs/app/edit/editor-view.tsx` over the in-memory publishing adapter — validate, publish, withdraw, restore, and the version list, all working with no backend (FR-037)
- [X] T066 [P] Update `packages/core/README.md` with the engine, the fourth adapter, and — the item a host will otherwise learn the hard way — that a supplied element registry **replaces** the default rather than extending it, so a custom type must be composed as `createElementRegistry([...builtinElements, mine])` or the seven MVP types are reported unknown. Update `packages/studio/README.md` with the report, the publish flow, and the order publishing runs in
- [X] T067 [P] Update `docs/cuestack_framework_plan.md` — PB-1 and PB-2 to ✅, the dead-end obligation discharged, `ElementPlugin.validate` recorded as the ninth declared-with-no-producer member to gain a consumer, and the three-validator overlap recorded as a finding
- [X] T068 Run `pnpm build && pnpm typecheck && pnpm lint && pnpm test && pnpm gates && pnpm check:rules` from the repository root and confirm every gate is green; verify by inspection that `tools/scripts/check-rule-coverage.mjs` now reports 18 of 18 and that no rule remains in its deferred set
- [X] T069 Verify the negative controls by deliberate breakage, restoring each afterwards: remove the `ElementPlugin.validate` call from `packages/core/src/validation/index.ts` (T017 must fail), let the policy silence a code in `packages/core/src/validation/severity.ts` (T020 must fail), drop the freeze in `packages/core/src/publishing/memory/index.ts` (T045 must fail), return the newest version from `loadPublished` while withdrawn in the same file (T056 must fail), have the publish flow reuse a cached report in `packages/studio/src/publishing/usePublishing.ts` (T038 must fail), make one builtin plugin's `resolve` contribute a style in `packages/core/src/elements/builtin/text.ts` (T019b must fail — the guard that keeps seven new plugins invisible to playback), and drop a field from one plugin's `inspector` in the same directory (T019b1 must fail — the guard that keeps them invisible to authoring)

  **Result: five of seven fired; two did not, and both were real gaps.** (a) The cached-report
  break passed T038, because `usePublishing.report` is null on a first publish so there was nothing
  stale to reuse — the case that bites is publish, break, publish again, and it is now the first
  test in `fresh.test.tsx`. (b) Dropping an inspector field passed T019b1, because since T029b1 the
  studio *derives* its list from the plugins: removing a field removes it from both sides and the
  parity assertion stays true. Parity cannot catch that by construction, so the canonical field
  list is now pinned per type in `packages/core/test/elements/builtin.test.ts`. Both breaks fail
  their suites now.
- [ ] T070 Perform the manual keyboard and screen-reader pass from [quickstart.md §11](./quickstart.md) — eight steps, with a screen reader running — and record the result in the pull request

---

## Dependencies

```text
Phase 1 (Setup)
   ├─────────────────────────────► Phase 3 (US1 — validation)     ── shippable alone
   └──► Phase 2 (Foundational: the fourth adapter)
           └──► Phase 4 (US2 — the gate)         ── also needs US1
                   ├──► Phase 5 (US3 — immutability)   ── needs Phase 2 only
                   └──► Phase 6 (US4 — newer versions)
                           └──► Phase 7 (US5 — withdrawal and the record)
```

**US1 does not depend on Phase 2.** Validation touches no publishing, which is what makes it the MVP
and lets it proceed while the fourth adapter is built alongside.

**Inside US1, the plugins come before the engine.** T029b and T029c supply the producers T032's
composition calls, and T029d migrates the suites that turning off the empty-registry escape breaks.
An engine written first would pass its own tests against a seam with nothing behind it.

**US3 is nearly independent.** Immutability is a property of the adapter rather than of the editor, so
Phase 5 needs Phase 2 and little else — it can run concurrently with Phase 4.

## Parallel opportunities

**Phase 1** — T001 through T004 are four separate files; only T005 waits.

**Phase 2** — the four contract tests (T006–T009) are four files and can be written at once; T010 and
T011 then serialise because both are the adapter. T013 and T014 are a separate package entirely and
run alongside all of it.

**Phase 3** — the biggest fan-out in the feature. T016–T020 are five independent test files, and
T028–T031 are four independent implementations. Only T032 onwards serialises.

**Across phases** — one developer can take Phase 3 end to end while another takes Phase 2 then Phase 5.
They meet at the four append-only files, and the append convention is what keeps that cheap.

## Implementation strategy

**MVP is Phase 1 + Phase 3.** Thirty-five tasks, entirely inside `@cuestack/core` and the studio's
report surface, with no new adapter and no publishing. It grew by nine when the analysis found the
type-specific seam had no producers: seven plugins, the parity guard that keeps them invisible to
playback, and the migration that turning off the empty-registry escape forces. It gives an author the dead end, the overrun,
the unlabelled image, and every plugin's own checks — before a learner meets any of them. If the
feature had to stop somewhere, this is the place, and it is the half that discharges the carried
obligation.

**Then Phase 2 + Phase 4**, which turns the report from advice into a gate.

**Then 5, 6, and 7 in order.** Each is a distinct promise: what was published stays published, a
newer version can replace it, and a wrong one can be withdrawn.

**Test-first throughout, and the tests are expected to fail when written.** The engine is pure, so its
suites are tables: a lesson in, a report out, no clock and no DOM. That is not a style preference —
it is the property that makes a validation engine trustworthy, and Constitution II names this engine
specifically.

**T069 is not optional.** Seven of this feature's guarantees pass by accident if nobody checks: an
engine that quietly stops calling plugins, a policy that can silence a rule, a version that is not
really frozen, a withdrawn lesson that still hands out its newest version, a publish that trusts a
stale report, a builtin plugin that starts contributing to what a lesson renders, and one that
quietly changes what a teacher sees while authoring. Every one of those leaves the rest of the suite
green.
