# Contract: `@cuestack/schema` public API

**Date**: 2026-08-14 · **Feature**: `001-framework-foundation`

The public surface of the only package this feature publishes with behavior. Everything not
listed here is internal and may change without a major version.

## Entry points

| Specifier | Runtime cost | Purpose |
|---|---|---|
| `@cuestack/schema` | **zero bytes** | Types only. Every export is erased at compile time. |
| `@cuestack/schema/validate` | Zod | `validate`, `ValidationIssue`, issue codes. |
| `@cuestack/schema/migrate` | migration chain | `migrate`, `currentVersion`, `supportedVersions`. |

The split exists because a learner's browser receives a manifest validated at author time.
Importing the player must not pull a validation library into the lesson bundle. Any change
that adds a runtime export to the root entry is a breaking change to this contract, and the
`bundle-size: 0` assertion in CI is what enforces it.

## `@cuestack/schema` — types

```ts
export type LessonManifest, LessonMeta, Slide, Element, Effect, Interaction,
              Advance, AssetRef, Background, Transition, ElementStyle,
              ElementType, EffectType, EffectPhase, InteractionType, AspectRatio
```

Shapes are defined in [`../data-model.md`](../data-model.md). Types are *inferred from* the
validators rather than declared alongside them, so a schema change that the types do not
follow is impossible.

## `@cuestack/schema/validate`

```ts
function validate(input: unknown): ValidationResult

type ValidationResult =
  | { ok: true;  lesson: LessonManifest }
  | { ok: false; issues: ValidationIssue[] }

type ValidationIssue = {
  code:     IssueCode
  rule?:    string                    // "BR-003" where a business rule applies
  path:     (string | number)[]
  location: {
    slideId?: string;    slideIndex?: number
    elementId?: string;  elementIndex?: number
    field?: string
  }
  message:  string
}
```

**Guarantees**

1. `validate` never throws for any input, including `undefined`, cyclic objects, and values
   that are not objects at all. Invalid input is an expected outcome.
2. `validate` is pure and deterministic. `validate(x)` deep-equals `validate(x)` for every `x`
   (SC-008). No clock, no randomness, no environment reads.
3. When `ok` is false, `issues` is non-empty and every issue carries a `location` resolved as
   far as the document structure permits (FR-003).
4. When `ok` is true, `lesson` is a new value; the input is not mutated or retained.
5. Unknown fields are rejected, never stripped and never passed through (US1 scenario 7).

**Stability**: `code` values are stable identifiers and are part of this contract — callers
branch on them. `message` is human-facing and may be reworded in a patch release.

## `@cuestack/schema/migrate`

```ts
function migrate(input: unknown, target?: string): MigrationResult

type MigrationResult =
  | { ok: true;  manifest: LessonManifest; applied: string[] }
  | { ok: false; issues: ValidationIssue[] }

const currentVersion: string           // "1.0"
const supportedVersions: readonly string[]
```

**Guarantees**

1. Forward-only. There is no downgrade path and no plan for one.
2. The input is never mutated (FR-011). `applied` lists the steps run, in order.
3. A declared version newer than `currentVersion` is refused with code
   `SCHEMA_VERSION_UNSUPPORTED` and nothing is partially loaded (US4 scenario 2).
4. A missing version is refused with `SCHEMA_VERSION_ABSENT`. It is never assumed current.
5. A gap in the step chain is refused with `MIGRATION_CHAIN_INCOMPLETE` rather than skipped.
6. Deterministic, per the same rule as `validate`.

## Issue codes (initial set)

Structural: `SCHEMA_VERSION_ABSENT`, `SCHEMA_VERSION_UNSUPPORTED`, `UNKNOWN_FIELD`,
`REQUIRED_FIELD_MISSING`, `TYPE_MISMATCH`, `ENUM_VALUE_INVALID`, `LESSON_HAS_NO_SLIDES`,
`UNKNOWN_ELEMENT_TYPE`, `UNKNOWN_EFFECT_TYPE`.

`UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE` are deliberately distinct from
`ENUM_VALUE_INVALID`. The spec's edge case requires an unrecognized element type to be
reported *naming the type*, not as a generic parse failure — and a generic enum error is
exactly the failure mode it forbids. Their `message` includes the offending type string, and
their `location` names the element.

Geometry: `GEOMETRY_NOT_NUMERIC` (FR-004). Distinct from `TYPE_MISMATCH` for the same
reason the unknown-type codes are distinct from `ENUM_VALUE_INVALID`: a string like
`"120px"` in a coordinate is a specific, recognisable authoring mistake, and saying so is
more useful than reporting that a number was expected.

Timing: `TIMING_NOT_INTEGER` (BR-001), `TIMING_NEGATIVE` (BR-002),
`TIMING_END_BEFORE_START` (BR-003), `EFFECT_DURATION_NOT_POSITIVE` (BR-004).

Referential: `DUPLICATE_ID`, `ADVANCE_MEDIA_NOT_FOUND` (BR-006), `ADVANCE_MEDIA_WRONG_TYPE`,
`ADVANCE_INTERACTION_NOT_FOUND`, `ADVANCE_INTERACTION_NOT_REQUIRED`,
`CORRECT_RESPONSE_UNKNOWN_OPTION`.

Migration: `MIGRATION_CHAIN_INCOMPLETE`, `MIGRATION_STEP_FAILED`.

Adding a code is a minor release. Removing or repurposing one is major.

## Package metadata contract

- ESM only. No CommonJS entry, no `main` field.
- `exports` map declares `types`, `react-server`, and `default` conditions per entry.
- `sideEffects: false`.
- `zod` is a dependency of the package but is reachable only through `/validate`.
- Verified in CI by publint and `@arethetypeswrong/cli` (research R-04).
