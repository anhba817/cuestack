# Contract: CI quality gates

**Date**: 2026-08-14 · **Feature**: `001-framework-foundation`

The contract between a contributor and the project: what is checked, what blocks, and what
each failure message must say. Implements constitution §"Development Workflow & Quality Gates"
and FR-015 through FR-018.

## Gates, in order

| # | Gate | Tool | Blocks on | Wave 0 status |
|---|---|---|---|---|
| 1 | Typecheck | `tsc` 6.0.3, strict | any error | **active** |
| 2a | Lint — per-file | ESLint 10 + typescript-eslint 8 | any error | **active** |
| 2b | Lint — graph boundary | dependency-cruiser 18 | forbidden import, cycle | **active** |
| 2c | Lint — no hardcoded theme values | ESLint custom rule | literal color/font/spacing in an element implementation | **placeholder** (no element implementations yet) |
| 3 | Tests | Vitest 4 | any failure | **active** |
| 4 | Coverage floors | `@vitest/coverage-v8` | `schema` below 90% line **and** branch | **active for `schema`**; `core` enabled in Wave 1 |
| 5 | Parity fixtures | — | element rendering differing between editor and player | **placeholder** (no renderer) |
| 6 | Accessibility checks | — | WCAG 2.2 AA violation on a learner-facing component | **placeholder** (no components) |
| 7 | Performance fixture | — | any budget regressed >10% | **placeholder** (no playback) |
| 8 | Package correctness | publint + attw | malformed `exports`, unresolvable types | **active** |
| 9 | Determinism | Vitest | `validate(x)` not deep-equal to `validate(x)` | **active** |
| 10 | Schema/migration pairing | custom check | schema change without a migration step | **active** |

## Placeholder gates

Gates 2c, 5, 6, and 7 have no subject matter in Wave 0. FR-017 requires them to be **present
and passing** rather than absent. A placeholder gate is a real CI job that runs a script
exiting 0 with a one-line note naming the wave that will give it teeth.

The reason is narrow and worth stating: enabling a gate later must be a change to one script,
not the creation of new infrastructure under deadline pressure. A gate that does not exist
when its feature lands is a gate that gets postponed.

A placeholder MUST NOT be marked `continue-on-error` or `allow_failure`. It exits 0 honestly
because it checked nothing, not because failures are tolerated.

## Failure message contract

Every blocking failure names the rule it broke (FR-016). Concretely:

- Boundary violation prints the offending import path *and* the dependency-cruiser rule name,
  e.g. `no-ui-in-core: packages/core/src/x.ts → react`.
- Coverage failure prints the package, the metric, the floor, and the actual.
- Determinism failure prints the first differing path between the two results.
- Schema/migration pairing failure names the changed schema file and states that a step under
  `packages/schema/src/migrate/steps/` is required in the same change.

A failure that says only "job failed" does not satisfy FR-016.

## Boundary rules enforced by gate 2b

1. `@cuestack/core` MUST NOT import `react`, `react-dom`, `vue`, `svelte`, or any package
   depending on them. (Constitution I.)
2. `@cuestack/schema` MUST NOT import `@cuestack/core` or any adapter. Dependencies flow
   `schema` ← `core` ← adapters, one direction only.
3. No cycles between packages, and none within a package's `src`.
4. `@cuestack/schema` root entry MUST NOT reach `zod`. Only `/validate` may.

## Timing

Full CI feedback under 5 minutes (SC-005). If the suite approaches that, the response is to
parallelize jobs, not to move a gate out of the blocking set.
