# Phase 0 Research: Framework Foundation

**Date**: 2026-08-14 · **Feature**: `001-framework-foundation`

Registry versions verified against npm on 2026-08-14. Every version below was confirmed to
exist and be the current `latest` tag at that date.

---

## R-01: TypeScript version — 6.0.3, not 7.0.2

**Decision**: Pin TypeScript **6.0.3** for type-checking, declaration emit, and linting.

**Rationale**: TypeScript 7.0 shipped 2026-07-08 as the Go-native compiler with 8–12× faster
builds, and `latest` on npm now points at 7.0.2. It is nonetheless the wrong choice for this
feature, for two reasons that both bite a *published library* specifically:

1. **Declaration emit.** TypeScript 7.0 ships without a stable programmatic API — the Go
   implementation's interface is still in flux. Builds that depend on `--declaration` emit to
   publish packages stay on the 6.x line until that lands in a later 7.x release. Publishing
   `.d.ts` files is not optional for us; it is the entire value of a typed schema package.
2. **Lint.** typescript-eslint closed its TS7 support request as *not planned* on release day,
   because it depends on the same stable API. Constitution I requires typed lint rules in a
   blocking CI gate, so a compiler our linter cannot drive is a non-starter.

TypeScript 7.1 is in development (`next` tag is `7.1.0-dev.20260813.1`) and is expected to
carry the stable programmatic API.

**Alternatives considered**:
- *TypeScript 7.0.2 for type-checking, 6.x for emit* — two compilers in one pipeline, with the
  risk that they disagree about a program the gate then passes. The speed gain is not worth a
  gate that can lie.
- *Run TS7 as a fast local-only pre-check via `npm:typescript@7` alias* — genuinely attractive
  for the inner loop, but it adds a second toolchain to document and keep aligned before there
  is enough code for the 10× to matter. Deferred, not rejected.

**Re-open trigger**: TypeScript 7.1 stable, *and* typescript-eslint ships TS7 support, *and*
`tsdown`/`attw` verify declaration emit under 7.x. All three, not any one.

---

## R-02: Validation library — Zod 4.4.x, at a separate entry point

**Decision**: Zod **4.4.3** as the only runtime dependency of `@cuestack/schema`, reachable
solely through the `@cuestack/schema/validate` entry point. The package root exports types
only and compiles to zero runtime bytes.

**Rationale**: Types are inferred from the schemas rather than declared beside them, so the
two cannot drift — which is what makes `data-model.md` reviewable against a single definition.
The split entry point matters more than the library choice: a learner's browser receives a
manifest that was validated at author time and has no reason to carry a validation library.
Bundling one into the player would tax every lesson load for a check that already happened.
Authoring tools import `/validate`; the player imports types and gets nothing at runtime.

**Alternatives considered**:
- *TypeBox* — emits JSON Schema natively, which we will eventually want for cross-language
  validation of published packages. But its ergonomics for the discriminated unions that
  element types demand are worse, and JSON Schema output can be generated from Zod when Wave 5
  actually needs it.
- *Hand-rolled validators* — zero dependencies, full control over the located-error shape
  FR-003 requires. Rejected because the error-path machinery is the bulk of the work and Zod
  already models it; we wrap its issues into our own error shape rather than exposing them.
- *Valibot* — smaller bundle, but the bundle argument evaporates once validation is behind a
  separate entry point the player never imports.

---

## R-03: Boundary enforcement — dependency-cruiser, not lint rules alone

**Decision**: **dependency-cruiser 18.2.x** owns the architectural graph rules; ESLint owns
per-file rules.

**Rationale**: Constitution I requires that `@cuestack/core` cannot import a UI framework and
that the package graph stays acyclic — both are properties of the *graph*, not of any one
file. An `import/no-restricted-paths` rule sees one file at a time and cannot detect a cycle
that passes through three packages. dependency-cruiser evaluates the whole graph, reports the
offending path, and fails with the rule name FR-016 requires.

**Alternatives considered**:
- *`eslint-plugin-import-x` alone* — blind to transitive cycles.
- *Nx module boundaries* — would mean adopting Nx for one feature; Turborepo was already
  chosen for the workspace.

**Correction, found during implementation.** The split above is right in outline but wrong in
one particular, and the particular matters. Under pnpm's isolated `node_modules`, `react` is
not resolvable *from* `packages/core` at all — so dependency-cruiser records no edge and the
graph rule is blind to precisely the import it exists to forbid. Verified: a probe file
containing `import { useState } from 'react'` inside `packages/core/src` produced "0
dependencies cruised".

The core/UI boundary is therefore enforced by ESLint's `no-restricted-imports`, which works on
syntax and sees the specifier whether or not it resolves. dependency-cruiser keeps the rules it
is genuinely better at — cycles, and cross-package direction, which *do* resolve via workspace
links. Both are covered by negative controls in `tools/scripts/check-gates.test.ts`.

This is the failure mode the negative-control suite exists for: the original rule was green in
CI and enforcing nothing.

---

## R-04: Package correctness — publint + `@arethetypeswrong/cli` in CI

**Decision**: Both run as blocking gates on every package build.

**Rationale**: The single most consequential thing this feature ships is the `exports` map with
its `react-server` condition (FR-013). It is also the thing most likely to be silently wrong:
a malformed condition order does not throw, it just resolves the client bundle into a server
context, and the symptom surfaces two waves later as a hydration bug nobody can trace. publint
catches malformed maps; `attw` catches type resolution that works for the author's
`moduleResolution` and breaks for a consumer's. `examples/nextjs` provides the end-to-end
proof, but these two catch the failure in seconds rather than at app build time.

**Alternatives considered**: manual review of `package.json` — this is precisely the class of
error human review misses, since the file looks correct when it is wrong.

---

## R-05: Build tool — tsdown

**Decision**: **tsdown 0.22.x** for all package builds.

**Rationale**: Rolldown-based, ESM-first, and emits declarations as part of the normal build
rather than as a bolted-on step. tsup 8.5.1 has not published since 2025-11-12, and its esbuild
foundation does not emit declarations without delegating back to `tsc` anyway.

**Alternatives considered**:
- *tsup* — the incumbent, but the staleness plus the declaration detour makes it the worse fit.
- *Raw `tsc`* — sufficient for `schema` (which is nearly all types) but not for the adapters
  that arrive in Wave 2. One build tool across the workspace beats two.

---

## R-06: Test runner — Vitest 4.1.x

**Decision**: Vitest **4.1.10** with `@vitest/coverage-v8`.

**Rationale**: Native ESM, which matters because the packages are ESM-only and a runner that
transpiles to CJS would test something other than what ships. Coverage thresholds are
per-package, which is what lets `schema` carry the 90% floor while `core` stays exempt until
Wave 1 (see plan Complexity Tracking). The injectable-clock requirement of Constitution II is
a Wave 1 concern, but Vitest's fake timers are the mechanism it will use.

**Alternatives considered**: `node:test` — no dependency at all, but no coverage thresholds
per package and no watch ergonomics; the constitution's coverage gate would need building by
hand.

---

## R-07: Determinism of validation

**Decision**: Ban `Date.now()`, `new Date()`, `Math.random()`, and any ambient environment read
from `@cuestack/schema` and its migrations, enforced by an ESLint `no-restricted-globals` rule.

**Rationale**: SC-008 requires two consecutive validations of the same manifest to produce
byte-identical results. The realistic way that breaks is not a deliberate clock read but an
error message that interpolates a timestamp, or a migration that stamps `updatedAt` while
upgrading. Both look harmless in review. A lint rule catches them at authoring time; a test
asserting `validate(x)` deep-equals `validate(x)` catches what the lint misses.

**Alternatives considered**: relying on the test alone — it would catch the violation but only
after someone spent time writing the code that caused it.

---

## R-08: Runtime target and Node version

**Decision**: Node **24 LTS (Krypton)** for tooling and CI. Published packages target ES2022
and carry no Node-specific API.

**Rationale**: Node 26 is current but not LTS; a framework's CI should not track the current
line. ES2022 clears the constitution's browser matrix — latest two majors of Chrome, Edge,
Safari, Firefox — with room to spare, and avoids transpiling away language features the
targets support natively.

---

## Resolved unknowns

Every `NEEDS CLARIFICATION` from the Technical Context is resolved above. Two items were
*not* researched because they were settled earlier and are recorded as decisions rather than
open questions:

- **No backend** — settled in `docs/cuestack_framework_plan.md` Open Design Questions. Wave 0
  persists nothing.
- **DOM over canvas** — settled in the same table, on SSR and WCAG grounds. No rendering
  substrate is touched by this feature regardless.

## Sources

- [Announcing TypeScript 7.0 — TypeScript devblog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [Microsoft Releases TypeScript 7.0 with a Native Go Compiler — InfoQ](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [TypeScript 7.0.2 Support — typescript-eslint issue #12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518)
- [TypeScript 7 migration readiness — ecorpit](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/)
- npm registry `latest` tags and Node.js release index, queried 2026-08-14.
