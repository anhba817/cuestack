# Implementation Plan: Framework Foundation

**Branch**: `001-framework-foundation` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-framework-foundation/spec.md`

## Summary

Establish the lesson format contract and the workspace that publishes it. `@cuestack/schema`
becomes the single definition of what a lesson is — types, validators, and the forward-only
migration chain — and the monorepo around it enforces the constitution's boundaries
mechanically from the first commit rather than by convention.

The technical approach turns on one decision: **validation is opt-in at a separate entry
point**. `@cuestack/schema` exposes type-only exports at its root (compiling to nothing at
runtime) and Zod-backed validators at `@cuestack/schema/validate`. A learner's browser
receives a manifest that was already validated at author time, so shipping a validation
library to the player would be dead weight on every lesson load. Splitting the entry point
keeps the runtime cost where the work happens and zero everywhere else.

## Technical Context

**Language/Version**: TypeScript 6.0.3, `strict`, ES2022 target, `moduleResolution: bundler`.
**Not** TypeScript 7 — see the Phase 0 research finding; 7.0 cannot emit the declarations a
published library needs and typescript-eslint declined to support it. Revisit at 7.1.

**Primary Dependencies**: Zod 4.4.x (in `@cuestack/schema/validate` only). Build: tsdown
0.22.x. Test: Vitest 4.1.x with `@vitest/coverage-v8`. Lint: ESLint 10.8.x + typescript-eslint
8.67.x. Boundary enforcement: dependency-cruiser 18.2.x. Package correctness: publint 0.3.x +
`@arethetypeswrong/cli` 0.18.x. Release: Changesets 3.0.x. Workspace: pnpm 11.21.x + Turborepo
2.10.x.

**Storage**: N/A. Wave 0 persists nothing; adapter interfaces are Wave 1 (EN-6).

**Testing**: Vitest 4.1.x. Fixture-driven — a corpus of valid and deliberately malformed
lesson definitions under `packages/schema/fixtures/`, plus rule-traceable tests named for the
business rules they prove.

**Target Platform**: Node 24 LTS (Krypton) for tooling and tests; published packages are
ESM-only and must run unchanged in the latest two major versions of Chrome, Edge, Safari, and
Firefox.

**Project Type**: TypeScript monorepo publishing a family of libraries. No application, no
service, no user interface in this feature.

**Performance Goals**: Full CI feedback under 5 minutes (SC-005). Validating a manifest of 50
slides and **300 elements in total** (matching NFR-PERF-001's stated ceiling, not 300 per
slide) completes in under 500 ms. This is a Wave-0 sub-budget of NFR-PERF-001's 3-second
editor-interactive target, chosen so validation can never be the reason that budget is missed
later.

**Reference environment for all timing budgets**: the project's standard GitHub-hosted CI
runner (4 vCPU, 16 GB). Every duration in this plan and in spec.md's success criteria is
measured there, so a number is reproducible rather than a claim about someone's laptop.
SC-001's 10-minute clone-to-build budget **excludes** dependency download time, which varies
with network conditions the project does not control.

**Constraints**: ESM-only, no CommonJS build. `@cuestack/core` carries zero runtime
dependencies and no UI framework import. Root entry of `@cuestack/schema` must compile to zero
runtime bytes. No `Date.now()`, `Math.random()`, or ambient clock reads anywhere in schema or
migrations — SC-008 requires two consecutive validations of the same input to be byte-identical.

**Scale/Scope**: 4 published packages + 1 example app + 2 internal tool configs. 19 functional
requirements. One reference manifest, one malformed corpus, one synthetic legacy-version
fixture for the migration chain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Assessment |
|---|---|---|
| **I. Code Quality & Modular Boundaries** | Yes — centrally | PASS. This feature *is* the boundary enforcement. `strict` on, no `any` in exports, dependency-cruiser blocks a UI import from core, and `exports` maps are validated by publint + attw in CI. Registry and plugin-contract clauses have no subject matter yet (Wave 1). |
| **II. Test-First & Deterministic Verification** | Yes | PASS with a phasing note. Schema validation and the migration chain are built test-first against the fixture corpus. Only BR-001–004 (timing invariants) and BR-006 (media-end advance references an existing media element) have subject matter in Wave 0. BR-008/009 do **not** — data-model.md places publication state outside the manifest entirely, so there is nothing here to test. The traceability harness is built to hold all 18 and covers the rules that exist. Coverage floor applies to `@cuestack/schema`; see Complexity Tracking for `@cuestack/core`. |
| **III. User Experience Consistency** | No | N/A. Wave 0 produces no user-facing surface. Theme tokens, WCAG conformance, and save-status vocabulary have no subject matter until Wave 2. Claiming compliance here would be vacuous. |
| **IV. Performance as a Contract** | Partially | PASS. The seven playback budgets have no subject matter. Two obligations do apply and are honored: CI feedback under 5 minutes, and the perf fixture gate exists as a passing placeholder per FR-017 so enabling it in Wave 3 is a one-line change. |
| **V. Preview-Player Parity** | Partially | PASS. No renderer exists to diverge. The principle's third clause *is* in scope: "the lesson manifest is the single source of truth." The format defined here must be complete enough that no editor-only state is ever needed outside it — enforced by FR-006's round-trip requirement and by rejecting undefined fields (US1 scenario 7). |

**Post-Phase-1 re-check**: PASS. The design added no new dependency to `@cuestack/core`
(it stays empty of runtime deps), and the type-only root entry strengthens Principle I's
"small dependency surface" clause rather than straining it. No gate moved.

## Project Structure

### Documentation (this feature)

```text
specs/001-framework-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── schema-package-api.md
│   ├── lesson-manifest.md
│   └── quality-gates.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/
├── schema/                      # @cuestack/schema — the format contract
│   ├── src/
│   │   ├── index.ts             # type-only root; compiles to zero runtime bytes
│   │   ├── types/               # Lesson, Slide, Element, Effect, Interaction, Asset
│   │   ├── validate/            # Zod schemas + validate(); separate entry point
│   │   │   └── index.ts
│   │   └── migrate/             # forward-only version chain
│   │       ├── index.ts
│   │       └── steps/
│   ├── fixtures/
│   │   ├── valid/               # reference manifest + variants
│   │   ├── invalid/             # malformed corpus, one file per rejection reason
│   │   └── legacy/              # synthetic older-version manifests for migration
│   └── test/
│       ├── rules/               # BR-*.test.ts — one file per business rule
│       ├── validate.test.ts
│       └── migrate.test.ts
├── core/                        # @cuestack/core — stub; kernel lands Wave 1
├── react/                       # @cuestack/react — stub; adapter lands Wave 2
└── element/                     # @cuestack/element — stub; web components Wave 5
examples/
└── nextjs/                      # minimal app proving server/client condition resolution
tools/
├── eslint-config/               # shared flat config incl. boundary rules
└── tsconfig/                    # shared strict base
```

**Structure Decision**: pnpm workspace monorepo. The four published packages mirror the
dependency direction the constitution mandates — `schema` ← `core` ← adapters — so that
dependency-cruiser can enforce it as a graph rule rather than a review habit. `core`, `react`,
and `element` ship as stubs in this feature: they exist so the workspace graph, the `exports`
maps, and the boundary lint are all real and tested from day one, rather than being retrofitted
onto code that already violates them. `examples/nextjs` exists for exactly one reason in Wave
0 — to prove the `react-server` export condition resolves correctly (US2 scenario 2), which
cannot be verified without a real Next.js build.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution II's 90% line+branch coverage floor is applied to `@cuestack/schema` only; `@cuestack/core` is exempted for this feature | `core` ships as an empty stub in Wave 0. A coverage gate over a package with no statements either passes vacuously or fails on a division by zero, and neither outcome carries information. | Writing token code in `core` purely to have something to cover would be worse — it inverts the principle into a metric-gaming exercise. The gate is configured with `core` listed and its threshold enabled in Wave 1 (EN-1), so the change is a config line, not new infrastructure. |
| Two source-of-truth artifacts for required/optional fields: the Zod schemas and `data-model.md` | The product spec §27 lists "key fields" without marking optionality, so the inference has to be recorded somewhere a non-implementer can review it. | Letting the Zod schemas be the only record would make the riskiest assumption in this feature reviewable only by reading code. `data-model.md` is the reviewable artifact; a test asserts the two agree, so they cannot drift silently. |
