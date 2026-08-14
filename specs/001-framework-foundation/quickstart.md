# Quickstart: Validating the Framework Foundation

**Date**: 2026-08-14 · **Feature**: `001-framework-foundation`

How to prove this feature works, end to end. Each scenario maps to acceptance criteria in
[`spec.md`](./spec.md). Run these after implementation; they are the manual counterpart to the
CI gates in [`contracts/quality-gates.md`](./contracts/quality-gates.md).

## Prerequisites

- Node 22.12+ (CI runs Node 24 LTS 'Krypton') — `node --version`
- pnpm 11 — `corepack enable && corepack prepare pnpm@11 --activate`
- Nothing else. No global TypeScript, no editor plugin, no environment variables.

If a step below needs something not in this list, that is a defect against SC-001.

## Setup and build — US2, SC-001

```bash
git clone <repo> && cd cuestack
pnpm install
pnpm build
```

**Expected**: every package builds, no errors, no manual configuration.

SC-001's 10-minute budget is measured on the **reference environment** — the project's standard
CI runner (4 vCPU, 16 GB) — and **excludes** `pnpm install` download time, which depends on
network conditions the project does not control. A timing taken on your own laptop is
indicative, not authoritative: treat a slow local run as a prompt to check the CI measurement,
not as a finding on its own. If the reference measurement exceeds the budget, that is a
finding, not an inconvenience.

```bash
pnpm test
```

**Expected**: all suites pass; coverage for `@cuestack/schema` at or above 90% line and branch.

## Scenario 1 — The reference lesson is accepted (US1 #1, FR-007)

Write `probe.mjs` inside `packages/schema/` and run it:

```js
import { validate } from '@cuestack/schema/validate'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }

const result = validate(reference)
console.log(result.ok ? 'ACCEPTED' : JSON.stringify(result.issues, null, 2))
```

```bash
pnpm build && node packages/schema/probe.mjs
```

(An earlier draft of this step used `node -e` with a top-level `await import`, which needs
`--input-type=module` and fails as written. A file avoids the problem entirely.)

**Expected**: `ACCEPTED`.

## Scenario 2 — Malformed lessons are rejected with a location (US1 #2–3, SC-002)

```bash
pnpm exec vitest run invalid-corpus
```

**Expected**: every fixture under `fixtures/invalid/` is rejected, and each rejection carries a
`location` naming the slide, element, and field. The suite asserts the `code` for each fixture,
so a fixture rejected for the *wrong reason* fails too — rejection alone is not enough.

Spot-check one by hand: `fixtures/invalid/element-ends-before-start.json` must produce
`TIMING_END_BEFORE_START` with `rule: "BR-003"` and a `location` naming the element.

## Scenario 3 — Round-trip fidelity (US1 #4, SC-003)

```bash
pnpm exec vitest run roundtrip
```

**Expected**: the reference manifest, serialized and re-validated, is deep-equal to the
original. Field order may differ; content may not.

## Scenario 4 — Unknown fields are rejected (US1 #7, FR-019)

Add `"learnerId": "abc"` anywhere in a copy of the reference manifest and validate it.

**Expected**: `UNKNOWN_FIELD` with the path to the injected field. Not stripped, not preserved.

## Scenario 5 — Server and client entry points resolve (US2 #2, FR-013)

```bash
pnpm --filter @cuestack/example-nextjs build
```

**Expected**: the Next.js build succeeds and resolves the `react-server` condition in a server
component. Confirm with:

```bash
pnpm check:packaging
```

**Expected**: both clean. These catch a malformed `exports` map in seconds; the Next.js build
is the end-to-end proof but a slow way to learn the map is wrong.

## Scenario 6 — Core runs with no UI framework present (US2 #3, SC-007)

```bash
pnpm check:isolation
```

**Expected**: the tarball is packed, installed alone into a bare temp directory, imported, and
the installed tree is asserted to contain no UI framework.

## Scenario 7 — The boundary rule blocks a violation (US3 #2)

Add `import 'react'` to any file in `packages/core/src/`, then:

```bash
pnpm lint
```

**Expected**: failure naming the rule — `no-ui-in-core: @cuestack/core must not import a UI
framework…`. A generic "lint failed" does not satisfy FR-016. **Revert the edit afterward.**

Note this is an ESLint rule, not a dependency-cruiser rule. Under pnpm's isolated
`node_modules`, `react` is unresolvable from `packages/core`, so a resolver-based tool records
no edge at all and would be blind to exactly this import. dependency-cruiser owns cycles and
cross-package direction, which do resolve via workspace links.

The automated form of every gate probe in this document:

```bash
pnpm exec vitest run --project gates
```

## Scenario 8 — A schema change without a migration is blocked (US4, SC-006)

Add an optional field to any schema in `packages/schema/src/validate/` without adding a step
under `src/migrate/steps/`, then:

```bash
pnpm check:migrations
```

**Expected**: failure naming the changed file and stating that a migration step is required in
the same change. **Revert the edit afterward.**

## Scenario 9 — Version handling (US4 #1–4)

```bash
pnpm exec vitest run migrate
```

**Expected**, from the fixtures under `fixtures/legacy/`:

| Input | Result |
|---|---|
| Supported older version | Carried forward; content preserved; input object unmodified |
| Version newer than supported | Refused, `SCHEMA_VERSION_UNSUPPORTED`, nothing partially loaded |
| No `schemaVersion` | Refused, `SCHEMA_VERSION_ABSENT` |
| Chain with a missing step | Refused, `MIGRATION_CHAIN_INCOMPLETE` |

The chain-gap row is exercised against a synthetic step list, not a fixture: every version in
the real registry is reachable by construction, so a gap cannot be produced from it. The branch
still has to work the day someone lands a step and forgets its predecessor.

## Scenario 10 — Determinism (SC-008)

```bash
pnpm exec vitest run determinism
```

**Expected**: `validate(x)` deep-equals `validate(x)` across the whole corpus, valid and
invalid alike. Invalid inputs matter more here — error messages are where a timestamp or a
random id most plausibly leaks in.

## What this feature does *not* demonstrate

There is nothing to look at. No lesson renders, no slide advances, no page loads. The first
visible output arrives in Wave 2 (`examples/nextjs` rendering a real slide server-side). If
you are looking for something to show a stakeholder, this is not the wave.
