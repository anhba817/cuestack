---

description: "Task list for Framework Foundation (Wave 0)"
---

# Tasks: Framework Foundation

**Input**: Design documents from `/specs/001-framework-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks ARE included and are mandatory. Constitution Principle II
("Test-First & Deterministic Verification") is marked NON-NEGOTIABLE and names schema
validation and the migration chain explicitly. Tests are written first and must fail before
the implementation task that satisfies them.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: US1–US4 from spec.md
- Exact file paths are included in every task

## Path Conventions

Monorepo per plan.md: `packages/{schema,core,react,element}/`, `examples/nextjs/`, `tools/`.
All paths below are repository-relative.

## Priority vs. execution order

spec.md ranks US1 (format contract) above US2 (buildable workspace) by **value**. Execution
order differs: the workspace has to exist before schema code can be written. The mechanical
parts of the workspace therefore live in Phases 1–2, and US2's own phase holds only what
*distinguishes* it — proving the exports maps resolve correctly. This is deliberate and is
noted in spec.md's Dependencies section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository scaffolding. Nothing here is specific to any user story.

- [X] T001 Create root workspace files: `pnpm-workspace.yaml`, root `package.json` (private, `packageManager: pnpm@11`), `.npmrc` with `engine-strict=true`, and `.gitignore`
- [X] T002 [P] Create shared strict TypeScript base at `tools/tsconfig/base.json` — `strict: true`, `target: ES2022`, `moduleResolution: bundler`, `declaration: true`, `noUncheckedIndexedAccess: true`
- [X] T003 [P] Create shared ESLint flat config at `tools/eslint-config/index.js` with typescript-eslint 8 recommended-type-checked
- [X] T004 [P] Create `turbo.json` with `build`, `test`, `lint`, `typecheck` pipelines and correct `dependsOn` topology
- [X] T005 [P] Create root `vitest.config.ts` defining the workspace projects only — **no coverage thresholds yet**. A 90% floor here would fail against a workspace with no tests and break T015's green baseline. T041 adds `schema`'s floor once its tests exist; T053 adds `core`'s disabled entry
- [X] T006 Pin toolchain versions in root `package.json` devDependencies per research.md: typescript 6.0.3, vitest 4.1.x, eslint 10.8.x, typescript-eslint 8.67.x, tsdown 0.22.x, dependency-cruiser 18.2.x, publint 0.3.x, `@arethetypeswrong/cli` 0.18.x, `@changesets/cli` 3.0.x
- [X] T007 [P] Initialize Changesets at `.changeset/config.json` with the four publishable packages
- [X] T008 [P] Write `README.md` at repo root documenting the single-command setup path required by SC-001

**Checkpoint**: `pnpm install` succeeds on a clean clone.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The package graph and build wiring every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 Create `packages/schema/package.json` with ESM-only `exports` map declaring `.` (types-only), `./validate`, and `./migrate` entries, each with `types`/`react-server`/`default` conditions; `sideEffects: false`; `zod` as a dependency
- [X] T010 [P] Create stub `packages/core/package.json` + `src/index.ts` — ESM-only, `sideEffects: false`, **zero** dependencies
- [X] T011 [P] Create stub `packages/react/package.json` + `src/index.ts` with `react` as a peer dependency only
- [X] T012 [P] Create stub `packages/element/package.json` + `src/index.ts`
- [X] T013 [P] Add `tsdown.config.ts` to each of the four packages, emitting ESM + declarations
- [X] T014 Add per-package `tsconfig.json` extending `tools/tsconfig/base.json` with project references matching the `schema ← core ← adapters` direction
- [X] T015 Verify `pnpm build && pnpm test` runs green across the empty workspace by exercising `turbo.json` and root `vitest.config.ts`, establishing the baseline all later gates measure against

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 — A lesson has one trustworthy definition (Priority: P1) 🎯 MVP

**Goal**: `@cuestack/schema` accepts a valid lesson and rejects an invalid one with an error
naming the slide, element, and field at fault.

**Independent Test**: Feed the fixture corpus to `validate()` and assert accept/reject plus the
located issue for each. Requires no other user story.

### Fixtures and tests for User Story 1 ⚠️

> **Write these FIRST. Every one must fail before its implementation task begins.**

- [X] T016 [US1] Author the reference manifest at `packages/schema/fixtures/valid/reference.json` — extends spec §28 to cover every element type, both interaction types, all four advance modes, all three effect phases
- [X] T017 [P] [US1] Author the malformed corpus under `packages/schema/fixtures/invalid/`, one file per rejection reason, each named for the issue code it must produce (e.g. `element-ends-before-start.json`, `unknown-field.json`, `lesson-has-no-slides.json`, `unknown-element-type.json`, `unknown-effect-type.json`)
- [X] T018 [P] [US1] Rule test BR-001 (integer milliseconds) in `packages/schema/test/rules/BR-001.test.ts`
- [X] T019 [P] [US1] Rule test BR-002 (start time ≥ 0) in `packages/schema/test/rules/BR-002.test.ts`
- [X] T020 [P] [US1] Rule test BR-003 (end after start) in `packages/schema/test/rules/BR-003.test.ts`
- [X] T021 [P] [US1] Rule test BR-004 (effect duration > 0) in `packages/schema/test/rules/BR-004.test.ts`
- [X] T022 [P] [US1] Contract test in `packages/schema/test/validate.contract.test.ts` asserting `validate()` never throws for `undefined`, `null`, primitives, and cyclic objects, and always returns a result
- [X] T023 [P] [US1] Corpus test in `packages/schema/test/invalid-corpus.test.ts` asserting every `fixtures/invalid/` file is rejected **with its expected issue code** — rejection for the wrong reason must fail
- [X] T024 [P] [US1] Location test in `packages/schema/test/location.test.ts` asserting every issue carries `slideId`, `elementId`, and `field` resolved as far as the document permits (FR-003)
- [X] T025 [P] [US1] Round-trip test in `packages/schema/test/roundtrip.test.ts` — reference manifest serialized and re-validated is deep-equal to the original (FR-006, SC-003)
- [X] T026 [P] [US1] Unknown-field test in `packages/schema/test/unknown-field.test.ts` — an injected `learnerId` is rejected, not stripped and not preserved (US1 #7, FR-019)
- [X] T027 [P] [US1] Format-definition privacy check in `packages/schema/test/no-identity-fields.test.ts` — walk the schema definition itself and assert no field exists whose name or shape could hold a learner identifier, author credential, or timestamp (SC-009 first clause; the complement to T026, which tests injected fields rather than defined ones)
- [X] T028 [P] [US1] Unknown-type test in `packages/schema/test/unknown-type.test.ts` — an unrecognized element or effect type produces `UNKNOWN_ELEMENT_TYPE` / `UNKNOWN_EFFECT_TYPE` with the offending type string in the message, **not** a generic `ENUM_VALUE_INVALID` (spec Edge Cases)
- [X] T029 [P] [US1] Geometry test in `packages/schema/test/geometry.test.ts` — element position and size accept only bare logical numbers; any viewport-relative unit (`px`, `%`, `vw`, `vh`) or string form is rejected, so display-independence is enforced rather than merely intended (FR-004, US1 #6)
- [X] T030 [P] [US1] Determinism test in `packages/schema/test/determinism.test.ts` — `validate(x)` deep-equals `validate(x)` across the whole corpus, valid and invalid alike (SC-008)
- [X] T031 [P] [US1] Referential tests in `packages/schema/test/referential.test.ts` — duplicate ids, `after_media_ends` naming a missing or non-media element (BR-006), `after_interaction` naming a non-required question, `correctResponse` naming an unknown option

### Implementation for User Story 1

- [X] T032 [P] [US1] Define `ValidationIssue`, `ValidationResult`, and the issue-code union (including `UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE`) in `packages/schema/src/validate/issues.ts` per contracts/schema-package-api.md
- [X] T033 [P] [US1] Zod schemas for `LessonManifest`, `LessonMeta`, and `Slide` in `packages/schema/src/validate/lesson.ts`, strict-mode so unknown keys are rejected
- [X] T034 [P] [US1] Zod schemas for `Element` and its per-type payload discriminated union in `packages/schema/src/validate/element.ts`, with a custom unrecognized-discriminant path producing `UNKNOWN_ELEMENT_TYPE`
- [X] T035 [P] [US1] Zod schemas for `Effect`, `Interaction`, `Advance`, and `AssetRef` in `packages/schema/src/validate/effect.ts`, `interaction.ts`, `advance.ts`, `asset.ts`
- [X] T036 [US1] Implement the Zod-issue → `ValidationIssue` mapper in `packages/schema/src/validate/map-issue.ts`, resolving `location` from the issue path (depends on T032–T035)
- [X] T037 [US1] Implement the Tier-2 referential pass in `packages/schema/src/validate/referential.ts` — runs only when Tier 1 is clean, per data-model.md
- [X] T038 [US1] Compose `validate()` in `packages/schema/src/validate/index.ts` from the structural and referential tiers
- [X] T039 [US1] Export inferred types from `packages/schema/src/types/` and re-export from the type-only root `packages/schema/src/index.ts`, asserting the root compiles to zero runtime bytes
- [X] T040 [US1] Add the data-model agreement check at `tools/scripts/check-data-model.mjs` — asserts the required/optional status of every field matches the table in `specs/001-framework-foundation/data-model.md`. **Lives in `tools/`, not in the package**, so a published package never depends on the specs directory (plan.md Complexity Tracking row 2)
- [X] T041 [US1] Add the `@cuestack/schema` coverage threshold — 90% line and branch — to root `vitest.config.ts`, and confirm the suite from T018–T031 clears it. Constitution II ties this floor to schema's own tests, so it belongs in the story that creates them, not in a later phase

**Checkpoint**: US1 is functionally complete and meets its coverage floor. `@cuestack/schema`
is **not yet publishable** — the `exports` map is unverified until T042–T043 in US2. Ship the
package only after US2.

---

## Phase 4: User Story 2 — A contributor can build the project on first try (Priority: P2)

**Goal**: A clean clone builds with one command, and packages resolve the correct entry point
for server and client contexts.

**Independent Test**: Build from a clean checkout on a machine with no project-specific setup;
confirm the `react-server` condition resolves and that core loads with no UI framework present.

### Tests for User Story 2 ⚠️

- [X] T042 [US2] Add `publint --strict` over every package in `tools/scripts/check-packaging.mjs`
- [X] T043 [US2] Add the `attw --pack` type-resolution check for all four packages to `tools/scripts/check-packaging.mjs`
- [X] T044 [P] [US2] Add isolated-install test at `tools/scripts/check-core-isolation.mjs` — install `@cuestack/core` alone into a bare temp directory with no React and assert it imports (SC-007, US2 #3)

### Implementation for User Story 2

- [X] T045 [US2] Create `examples/nextjs/` — minimal App Router app that imports `@cuestack/schema` from a server component and `@cuestack/react` from a client component (proves US2 #2)
- [X] T046 [US2] Correct the `exports` maps in all four `package.json` files until T042–T044 pass, including condition ordering
- [X] T047 [US2] Wire `pnpm build` at the repo root to build every package and the example app in dependency order via `turbo.json`
- [X] T048 [US2] Document the setup path in `README.md` and time a clean clone-to-build on the reference CI runner against the 10-minute budget, excluding dependency download (SC-001, plan.md "Reference environment"); record the measurement in the README

**Checkpoint**: US1 and US2 both work independently. `@cuestack/schema` is now publishable —
functionally complete, at its coverage floor, with a verified `exports` map.

---

## Phase 5: User Story 3 — Quality rules are enforced without anyone remembering them (Priority: P3)

**Goal**: The gates in contracts/quality-gates.md run on every change and block on failure
with a message naming the rule broken.

**Independent Test**: Propose deliberately non-compliant changes — a type error, a
core→React import, a dropped test — and confirm each is rejected by name.

### Tests for User Story 3 ⚠️

- [X] T049 [P] [US3] Negative-control fixtures under `tools/scripts/gate-fixtures/` — one deliberately broken input per gate, used to prove each gate actually fails
- [X] T050 [P] [US3] Test in `tools/scripts/check-gates.test.ts` asserting every gate rejects its negative control **and** that the failure text names the rule (FR-016)

### Implementation for User Story 3

- [X] T051 [P] [US3] Configure boundary rules in `.dependency-cruiser.cjs`: no UI framework in `core`, `schema` must not import `core` or adapters, no cycles, and `schema` root must not reach `zod` (contracts/quality-gates.md §"Boundary rules")
- [X] T052 [P] [US3] Add a `no-restricted-globals` override in `tools/eslint-config/index.js` scoped to `packages/schema/**`, banning `Date.now`, `new Date`, and `Math.random` per research.md R-07
- [X] T053 [US3] Add `@cuestack/core`'s coverage entry to root `vitest.config.ts` — listed but disabled, with a comment naming Wave 1 as when it is enabled (plan.md Complexity Tracking row 1). `schema`'s threshold was already set by T041; this task adds only `core`'s entry
- [X] T054 [US3] Implement the schema/migration pairing check at `tools/scripts/check-migrations.mjs` — a diff touching `packages/schema/src/validate/` without a new step under `src/migrate/steps/` fails (FR-018, SC-006)
- [X] T055 [P] [US3] Create passing placeholder gates at `tools/scripts/gates/{theme-values,parity,a11y,perf}.mjs`, each exiting 0 with a one-line note naming the wave that gives it teeth (FR-017)
- [X] T056 [US3] Create `.github/workflows/ci.yml` running every gate as a blocking job in the documented order; no `continue-on-error` anywhere
- [X] T057 [US3] Parallelize the job graph in `.github/workflows/ci.yml` until full feedback lands under 5 minutes on the reference runner (SC-005), recording the measured time as a comment in that file

**Checkpoint**: All three stories work; the constitution is now machine-enforced.

---

## Phase 6: User Story 4 — The format can change without breaking existing lessons (Priority: P4)

**Goal**: A lesson written against a supported older version opens and is carried forward; an
unsupported or absent version is refused cleanly.

**Independent Test**: Run the migration suite against synthetic legacy fixtures and a
registered upgrade step.

### Tests for User Story 4 ⚠️

- [X] T058 [P] [US4] Synthetic legacy fixtures under `packages/schema/fixtures/legacy/` — a supported older version, a version newer than current, one with no `schemaVersion`, and one whose chain has a gap
- [X] T059 [P] [US4] Migration tests in `packages/schema/test/migrate.test.ts` covering the four rows of the quickstart Scenario 9 table
- [X] T060 [P] [US4] Immutability test in `packages/schema/test/migrate-immutability.test.ts` — the caller's input object is byte-identical after `migrate()` returns (FR-011, US4 #4, SC-010)
- [X] T061 [P] [US4] Determinism test for migrations in `packages/schema/test/migrate-determinism.test.ts` — re-running a step on the same input is byte-identical

### Implementation for User Story 4

- [X] T062 [P] [US4] Define `MigrationStep` and the step registry in `packages/schema/src/migrate/steps/index.ts`
- [X] T063 [US4] Implement chain resolution in `packages/schema/src/migrate/chain.ts` — resolve declared version to current, detect gaps, refuse newer-than-supported and absent versions with the codes in contracts/schema-package-api.md
- [X] T064 [US4] Implement `migrate()` in `packages/schema/src/migrate/index.ts`, structurally cloning input before any step runs so the caller's object is never touched
- [X] T065 [US4] Register the v1.0 identity step in `packages/schema/src/migrate/steps/v1_0.ts` and export `currentVersion` and `supportedVersions` from `packages/schema/src/migrate/index.ts`

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T066 [P] Write `packages/schema/README.md` covering both entry points and the runtime-cost split
- [X] T067 [P] Add a Changesets entry at `.changeset/initial-release.md` declaring the `0.1.0` release of all four packages
- [X] T068 Verify the 500 ms validation budget in `packages/schema/test/perf.test.ts` against a generated manifest of 50 slides and 300 elements **in total**, measured on the reference CI runner (plan.md Performance Goals)
- [X] T069 [P] Hostile-input test in `packages/schema/test/pathological.test.ts` — deeply nested structures, multi-megabyte strings, arrays with hundreds of thousands of entries, and self-referential objects each complete or fail with a bounded error rather than hanging or exhausting memory (spec Edge Cases)
- [X] T070 Run every scenario in `specs/001-framework-foundation/quickstart.md` by hand and correct any step that does not work as written
- [X] T071 Flip IN-1, IN-2, SCH-1, and SCH-2 to ✅ in `docs/cuestack_framework_plan.md` and confirm the Wave 1 critical path still holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2; T042–T044 are more meaningful once `schema` has real exports (T039), but can be written against the stubs first
- **US3 (Phase 5)**: depends on Phase 2. T053 depends on T041 having created the coverage block; T054 only bites once US4 exists but is written to fail correctly beforehand
- **US4 (Phase 6)**: depends on US1's types (T039) for its return type
- **Polish (Phase 7)**: depends on all four stories

### Within Each User Story

- Fixtures and tests are written before the implementation that satisfies them, and must be
  observed failing first (Constitution II)
- Types before schemas, schemas before the issue mapper, structural tier before referential
- Story complete before moving to the next priority

### Single-owner files

Two tasks must never both write the same config block. Ownership is explicit:

| File / block | Owner | Note |
|---|---|---|
| root `vitest.config.ts` — project list | T005 | Creates the file, no thresholds |
| root `vitest.config.ts` — `schema` threshold | T041 | Set once US1's tests exist |
| root `vitest.config.ts` — `core` entry | T053 | Extends; disabled until Wave 1 |
| `tools/scripts/check-packaging.mjs` | T042 creates, T043 extends | Sequential, not parallel |
| `tools/eslint-config/index.js` | T003 creates, T052 extends | Sequential, not parallel |

### Parallel Opportunities

- T002–T005, T007–T008 in Setup
- T010–T013 in Foundational
- T017–T031 — the entire US1 test suite, fifteen independent files
- T032–T035 — the four schema modules, different files
- T044 in US2; T049–T050 in US3; T058–T061 in US4
- US3 can be worked largely in parallel with US1 by a second contributor — it touches only
  `tools/`, `.github/`, and config files, with no overlap into `packages/schema/src/`. The one
  ordering constraint is T053, which extends the coverage block T041 creates

---

## Parallel Example: User Story 1

```bash
# Fifteen independent US1 test files — write them together:
Task: "Rule test BR-001 in packages/schema/test/rules/BR-001.test.ts"
Task: "Rule test BR-002 in packages/schema/test/rules/BR-002.test.ts"
Task: "Rule test BR-003 in packages/schema/test/rules/BR-003.test.ts"
Task: "Rule test BR-004 in packages/schema/test/rules/BR-004.test.ts"
Task: "Contract test in packages/schema/test/validate.contract.test.ts"
Task: "Corpus test in packages/schema/test/invalid-corpus.test.ts"
Task: "Round-trip test in packages/schema/test/roundtrip.test.ts"
Task: "Privacy check in packages/schema/test/no-identity-fields.test.ts"
Task: "Unknown-type test in packages/schema/test/unknown-type.test.ts"
Task: "Geometry test in packages/schema/test/geometry.test.ts"
Task: "Determinism test in packages/schema/test/determinism.test.ts"

# Then the four schema modules, also independent:
Task: "Lesson/Slide schemas in packages/schema/src/validate/lesson.ts"
Task: "Element schemas in packages/schema/src/validate/element.ts"
Task: "Effect/Interaction/Advance/Asset schemas in packages/schema/src/validate/*.ts"
Task: "Issue types in packages/schema/src/validate/issues.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — blocks everything
3. Phase 3: US1
4. **STOP and VALIDATE**: run quickstart Scenarios 1–4

At this checkpoint the format contract is complete, tested, and meets its coverage floor. It
is **not shippable yet**: nothing has verified the `exports` map, so a consumer could install
the package and resolve the wrong entry point. Publishing requires US2 as well.

### Incremental Delivery

1. Setup + Foundational → workspace exists
2. US1 → the format contract works and is covered (**MVP**)
3. US2 → the packages resolve correctly everywhere they will be consumed (**first publishable point**)
4. US3 → the constitution stops depending on anyone remembering it
5. US4 → the format becomes safe to change

### Parallel Team Strategy

US3 is the natural second track: it touches only `tools/`, `.github/`, and config, so one
contributor can build the gates while another builds the schema. They meet at T056, where the
CI workflow first runs the real suite.

---

## Notes

- Constitution II is non-negotiable here: a test that was never observed failing has proven nothing
- Commit after each task or logical group
- The two Complexity Tracking deviations in plan.md are implemented by T053 (core coverage
  deferral) and T040 (data-model agreement) — neither is optional
- Stop at any checkpoint to validate a story independently
