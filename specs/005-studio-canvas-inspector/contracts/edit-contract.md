# Contract: the draft reducer

**Feature**: `005-studio-canvas-inspector` · **Module**: `@cuestack/studio` → `draft/reducer.ts`

Every change a teacher makes to a lesson passes through one function. This is what it promises.

```
applyEdit(draft: LessonManifest, edit: Edit, ctx: EditContext): EditResult
```

```
EditContext = { readonly mode: 'edit' | 'read-only'; readonly nextId: IdSource }

EditResult =
  | { readonly ok: true;  readonly draft: LessonManifest; readonly idsCreated: readonly string[] }
  | { readonly ok: false; readonly reason: EditRefusal; readonly message: string; readonly elementId?: string }

EditRefusal = 'read-only' | 'locked' | 'invalid' | 'not-found' | 'unsupported'
```

## The five promises

**1. Purity.** `applyEdit` reads nothing but its arguments. No clock, no randomness, no DOM, no module
state. Identity comes from `ctx.nextId` and from nowhere else (FR-050). The same `(draft, edit, ctx)`
with the same id source yields the same result, every time — which is what makes SC-016's replay a
fold rather than a hope.

**2. The draft is never mutated.** A successful edit returns a new manifest; the input is untouched
and remains usable. A refused edit returns no manifest at all, so there is no path on which a caller
holds a partially applied draft.

**3. The result always validates.** Every `ok: true` result has passed `validate()` from
`@cuestack/schema/validate` (FR-045). An edit whose outcome would fail validation returns
`{ ok: false, reason: 'invalid' }` with the validator's message, and the draft does not change. This
is the requirement that makes "the editor cannot construct a lesson the player would refuse" a
property rather than an aspiration — and it is why the editor may depend on Zod while the player may
not (research R-03).

**4. Read-only refuses everything that mutates.** When `ctx.mode === 'read-only'`, every variant of
`Edit` returns `{ ok: false, reason: 'read-only' }`. Not "most variants" and not "the ones the UI
exposes" — the test enumerates the union and asserts each one, so a variant added later fails the test
until it is handled (FR-051, SC-017, research R-09).

**5. Locked elements are skipped, not fatal.** An edit naming a locked element applies to the unlocked
members of its selection and reports which were skipped and why (FR-008, BR-011). An edit naming
*only* locked elements returns `{ ok: false, reason: 'locked' }`. The mixed selection is the case the
specification's edge list calls out, and returning a refusal for the whole set would make one locked
element silently veto a five-element drag.

## Per-variant obligations

| Variant | Must | Must not |
|---|---|---|
| `add-element` | Produce a schema-valid element with a fresh id, geometry inside the canvas, positive extents, a `zIndex` above the current maximum, and a window spanning the slide | Consume more than one id; place the element outside the canvas |
| `transform-elements` | Write authored geometry only; clamp extents positive | Touch `startMs`/`endMs`; alter elements outside `ids` |
| `set-field` / `set-slide-field` | Reject a value the schema refuses, naming the field and the element (FR-023) | Leave the draft holding a rejected value |
| `set-text` | Write through the type's `textSurface` | Assume a payload shape; branch on element type |
| `reorder` | Keep `zIndex` values distinct and ordering deterministic (FR-028) | Reorder `slide.elements` array position as a substitute |
| `set-flag` | Set `locked` / `hidden` on each named element | Apply the `locked` guard to a `set-flag` that *unlocks* — otherwise a locked element could never be unlocked |
| `duplicate` / `paste` | Give each new element a distinct id and a visible offset | Reuse a source id |
| `delete` | Remove named elements | Be reachable without the confirmation the UI owns (FR-033) |
| `align` / `distribute` | Require ≥2 and ≥3 elements respectively; otherwise `'unsupported'` | Silently no-op |

Note the `set-flag` exception. It is the one place the locked guard must not apply, and it is the kind
of rule that is obvious once written down and invisible until a teacher locks an element and cannot
get it back.

## What is not an edit

Selection, hover, authoring time, snap guides, text-edit mode, and **copy** never reach this
function. They are session state (data-model.md §2), and keeping them out of the reducer is what
makes SC-007 — a manifest unchanged across a session of pure navigation — true by construction
rather than by audit.

Copy is the one that looks like it belongs in the variant table and does not. It is half of a pair
whose other half, `paste`, *is* an edit, so the instinct is to put both in the same place. But copy
writes to `session.clipboard` and changes no authored data, and routing it through `applyEdit` would
put it inside the very surface SC-007 requires to be inert.

That split has a consequence worth stating, because it is the kind that is otherwise discovered by a
reviewer: **read-only mode is enforced here, so it cannot reach copy.** Copy is permitted in
read-only — reading a lesson and taking a copy of part of it changes nothing — while `paste` is
refused by promise 4 like every other variant. The session action owns that distinction, and
`packages/studio/test/session/clipboard.test.ts` is where it is asserted.

## Test obligations

- Every `Edit` variant: one success case and one refusal case.
- Read-only: the full union, refused.
- Validity: a generated sequence of edits, with `validate()` asserted after each (SC-012).
- Determinism: the same sequence replayed against the same start with the same id source produces a
  byte-identical manifest (SC-016).
- BR-010: a hidden element remains in the draft and is absent from `resolve()`.
- BR-011: a locked element accepts `set-flag` and refuses `transform-elements`.
