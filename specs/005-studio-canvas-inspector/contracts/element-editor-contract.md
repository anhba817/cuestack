# Contract: the element editor registration

**Feature**: `005-studio-canvas-inspector` · **Modules**: `@cuestack/studio` → `registry/editors.ts`,
`@cuestack/core` → `elements/contract.ts`

This contract completes FR-FWK-002. The constitution requires a plugin to supply five things before
merge — data schema, editor component, player renderer, inspector configuration, and validator — and
until now the editor component had nowhere to live.

## Where the five members are

| Member | Package | Since |
|---|---|---|
| Data schema | `@cuestack/core` → `ElementPlugin.schema` | Wave 1 |
| Inspector configuration | `@cuestack/core` → `ElementPlugin.inspector`, with `@cuestack/studio` → `ElementEditor.inspector` as the fallback | Wave 1 — **no consumer *or producer* until now**; see below |
| Validator | `@cuestack/core` → `ElementPlugin.validate` | Wave 1 — **still no consumer; PB-1 owes it one** |
| Player renderer | `@cuestack/react` → `ElementRenderer` | Wave 2 |
| Editor component | `@cuestack/studio` → `ElementEditor` | **this feature** |

The split follows the one Wave 2 established: `@cuestack/core` holds what is framework-agnostic,
adapters hold components. Core may not import React (Constitution I), so an editor component was never
placeable there.

## `ElementEditor`

```
interface ElementEditor<TPayload = unknown> {
  readonly type: string
  readonly defaults: ElementDefaults
  readonly textSurface?: TextSurface<TPayload>
}

interface ElementDefaults {
  readonly width: number       // logical units
  readonly height: number
  readonly payload: unknown    // must satisfy the type's schema
}

interface TextSurface<TPayload> {
  read(payload: TPayload): string
  write(payload: TPayload, text: string): TPayload
}
```

**`defaults`** supplies what `add-element` needs to produce a valid element immediately (FR-014).
Position is computed by the canvas — centred, offset from any element already there — because it
depends on the slide, which a registration must not see.

**`textSurface`** is the whole of FR-015's "which types those are MUST come from the type's
registration". Its presence *is* the answer to "is this type editable on canvas". The canvas asks the
registry; it never asks the element's type. A type that omits it is edited through the inspector, which
is the correct outcome for an image or a shape and requires no code to express.

`read` and `write` keep the canvas ignorant of payload shape. `text` has `payload.text`; `button` has
`payload.label`. Both are one line of registration and zero lines of branching.

## Scoped access, unchanged

An `ElementEditor` receives its own element's payload and nothing else — no lesson, no slide, no
siblings, no selection, no session. The same restriction `ElementPlugin` and `ElementRenderer` already
make, for the reason both state: a plugin *able* to reach the lesson becomes one that does, and then
the lesson shape cannot change without breaking third-party code (FR-025, FR-FWK-011).

Note what this means for `write`: it returns a new payload rather than mutating the draft. The
registration cannot reach the draft, so it cannot corrupt it.

## Where a type's fields actually come from — changed during implementation

This contract originally said type-specific fields come from `ElementPlugin.inspector` in
`@cuestack/core`, unchanged. Building the inspector found the flaw: **the seven built-in types have
no `ElementPlugin`, and never have.** Core's plugin registry is empty by default. The built-ins are
served by the schema's per-variant validation, by the resolver's own path, and by the React renderer
registry, so `inspector` had neither a consumer *nor a producer*.

Authoring seven plugins to hold seven field lists was the alternative, and it is worse: each would
need `schema`, `resolve`, and `validate` for types core already handles internally — a second source
of truth for what a text element is.

The resolution keeps FR-018 literally true where it can be. **The inspector reads
`ElementPlugin.inspector` first, and falls back to `ElementEditor.inspector`.** A third-party type
that registers a plugin gets its own spec used verbatim; the built-ins have a home. Both are
registrations, so Constitution I's actual requirement — types added through registries rather than
through a switch — holds either way, and `SC-010`'s "zero per-type branches" is unaffected.

`ElementEditor.inspector` is therefore required, alongside `type` and `defaults`.

## The core change: `InspectorField` gains `list`

`InspectorField.kind` is currently `'text' | 'number' | 'boolean' | 'select' | 'asset' | 'colour'`.
None of these describes a question's options — a repeating group of `{ id, label }` with one marked
correct — and `question` is one of the seven MVP types.

FR-019 dictates the response: extend the contract rather than special-case the type. So:

```
kind: 'text' | 'number' | 'boolean' | 'select' | 'asset' | 'colour' | 'list'

// when kind === 'list'
readonly of: readonly InspectorField[]   // the fields of one item
readonly minItems?: number
```

**Blast radius.** `InspectorSpec` is authoring metadata. It is consumed by nothing on the playback
path, serialized into no manifest, and carried in no `RenderState`. Adding a union member is additive
to a type the lesson format never sees, so no `schemaVersion` bump and no migration (FR-047 holds).

The alternative — `if (element.type === 'question')` inside the inspector — is the switch statement
Constitution I calls a defect, and it would make the seventh element type the one proving the registry
does not work.

## Registration completeness

`createElementEditorRegistry` refuses an incomplete registration at registration time, in the manner
`createRendererRegistry` already does: a missing `type` or `defaults` throws with a message naming what
is absent and what it costs. Core's `ElementPlugin` comment sets the precedent and the reasoning —
"a plugin missing `inspector` is invisible in the editor and one missing `validate` passes publication
checks it should fail. Both are discovered two waves later, by a teacher."

## Test obligations

- All seven MVP types register an `ElementEditor`, and a test enumerates the registry against
  `ELEMENT_TYPES` from the schema so a new type fails until it is registered.
- Every type's `defaults.payload` validates against that type's schema.
- Adding each type produces a draft that passes `validate()` (SC-011).
- Types with a `textSurface` round-trip: `write(payload, read(payload))` is the identity.
- The inspector renders every field kind including `list`, with zero branches on element type
  (SC-010).
- An unregistered type is still selectable and shows common settings only (FR-026).
