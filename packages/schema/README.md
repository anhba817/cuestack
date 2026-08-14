# @cuestack/schema

The Cuestack lesson format: types, validators, and forward-only migrations.

## Two entry points, and the split matters

```ts
import type { LessonManifest } from '@cuestack/schema'   // zero runtime bytes
import { validate } from '@cuestack/schema/validate'     // pulls in Zod
import { migrate } from '@cuestack/schema/migrate'       // pulls in the chain
```

The root entry exports **types only** and compiles to nothing. A learner's browser
receives a manifest that was already validated at author time, so shipping a validation
library to the player would tax every lesson load for a check that already happened.
Authoring tools import `/validate`; the player imports types and gets nothing at runtime.

Adding a runtime export to the root is a breaking change to this contract.

## Validating

```ts
const result = validate(untrustedInput)

if (!result.ok) {
  for (const issue of result.issues) {
    console.error(issue.code, issue.location, issue.message)
  }
} else {
  result.lesson // typed LessonManifest
}
```

`validate` never throws — an invalid lesson is an expected outcome, not an exceptional one.
It is deterministic: `validate(x)` deep-equals `validate(x)` for every `x`.

Branch on `code`, not on `message`. Codes are part of the contract; messages are for humans
and may be reworded in a patch release. Every issue carries a `location` naming the slide,
element, and field, so a caller can navigate to the fault without parsing text.

Validation runs in two tiers. Structural rules (types, required fields, ranges, unknown-field
rejection) come first; referential rules that need the whole document — duplicate ids, an
advance rule naming a media element that exists on this slide — run only once the structure
is sound, because referential errors over a malformed document are noise rather than
information.

## Migrating

```ts
const result = migrate(manifestFromStorage)
if (result.ok) result.manifest // now at the current version
```

Forward-only. The input is structurally cloned before any step runs, so the object you
passed in — which may be the draft a teacher is editing — is never touched. A version newer
than supported is refused rather than partially loaded, and a gap in the chain is refused
rather than skipped: a skipped step produces a manifest that looks current and is quietly
wrong, which is the worst available outcome.

## Strictness

Unknown fields are **rejected** — not ignored, not preserved. Silently preserving them would
let a host smuggle learner identifiers into a lesson; silently stripping them would break the
round-trip guarantee. Rejecting is the only choice that keeps both.

The format has no field capable of holding a learner identifier, an author credential, or a
timestamp. That is asserted by a test that walks the schema definition, not merely by
convention.

## Fixtures

```ts
import reference from '@cuestack/schema/fixtures/valid/reference.json'
```

`fixtures/valid/reference.json` exercises every element type, both interaction types, all four
advance modes, and all three effect phases. It is validated in CI by the same code path that
validates user content.
