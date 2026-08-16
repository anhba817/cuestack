# Phase 1 Data Model: Studio Canvas and Properties Inspector

**Date**: 2026-08-16 · **Feature**: `005-studio-canvas-inspector`

Two populations of data, and the boundary between them is the feature's central invariant.

**Authored data** is the lesson manifest. It is the single source of truth, it is what a learner
receives, and every field the editor writes already exists in it — this feature adds nothing to the
lesson format and triggers no `schemaVersion` bump (FR-047).

**Session data** is what the teacher is currently doing. Selection, authoring time, edit mode,
in-flight gestures. None of it is serialized, none of it influences playback (FR-044), and the
verification is mechanical: SC-007 compares a manifest before and after a session that changes only
session data and requires them identical.

Nothing below is a new manifest type. Everything below except §1 lives in `@cuestack/studio`.

---

## 1. Authored data — what the editor writes, and where it already lives

No new fields. Recorded here so the claim in FR-047 is checkable rather than asserted.

| What the teacher changes | Manifest location | Already present? |
|---|---|---|
| Position, size | `Element.x`, `.y`, `.width`, `.height` | Yes — `logicalNumber` / `logicalExtent` |
| Rotation | `Element.rotation` | Yes — optional finite number |
| Layer order | `Element.zIndex` | Yes — `z.int()` |
| Lock, hide | `Element.locked`, `.hidden` | Yes — optional booleans, BR-011 / BR-010 |
| Timing | `Element.startMs`, `.endMs` | Yes — `msInt`, with `endMs > startMs` checked |
| Text content | `Element.payload.text` | Yes — `z.string().max(20000)` |
| Alt text, captions | `Element.accessibility.altText`, `payload.caption` | Yes |
| Type-specific payload | `Element.payload` per variant | Yes |
| Slide name, duration | `Slide.name`, `.durationMs` | Yes |
| Background, transition | `Slide.background`, `.transition` | Yes — both optional |
| Slide accessibility | `Slide.accessibility` | Yes |

**Not written by this feature**: `Slide.advance` (deferred to ED-3/ED-4 with BR-005 and BR-006),
`Slide.elements` ordering beyond `zIndex`, `lesson` metadata, `schemaVersion`.

**Validation rules inherited, not restated.** `endMs > startMs` (BR-003), positive extents,
integer milliseconds (BR-001, BR-002), and rejection of unknown fields are all enforced by
`@cuestack/schema`. The editor's obligation (FR-045) is to run that validation after every edit, not
to reimplement any of it.

---

## 2. `EditorSession`

The complete session state. Held by `useEditorSession`; every field except `draft` is discarded when
the teacher leaves.

| Field | Type | Notes |
|---|---|---|
| `draft` | `LessonManifest` | Authored data. Replaced wholesale by each edit; never mutated. |
| `slideId` | `string` | Which slide is being edited. |
| `selection` | `readonly string[]` | Element ids, in selection order. Empty means the slide is selected (FR-024). |
| `authoringTime` | `Record<string, number>` | Milliseconds within a slide, keyed by slide id. Per-slide (FR-012); absent means the slide's start. |
| `mode` | `'edit' \| 'read-only'` | FR-051. Checked in the reducer (R-09), not the UI. |
| `textEditing` | `string \| null` | The element whose text surface is mounted, if any (FR-016). |
| `clipboard` | `readonly Element[]` | What `copy` last captured, and what `paste` inserts (FR-032). Session data: copying changes no authored data, so it is not an `Edit`. Holds detached copies, so editing or deleting the source afterwards does not change what pastes. |

**State transitions.**

- `selection` — set by click, keyboard traversal, or an add. An added element becomes the selection
  (FR-014's "selected"). An element that leaves the slide leaves the selection in the same edit; a
  selection referencing a deleted id is an invariant violation, not a state to handle downstream.
- `authoringTime` — clamped to `[0, slide.durationMs]`. When a duration shrinks below the current
  authoring time, the time clamps; the *elements* do not (FR-052).
- `textEditing` — entered explicitly, left explicitly. Leaving commits. It is cleared by any change of
  `selection` or `slideId`, and the pending text commits first — the edge case where an in-flight edit
  must not land on a different element.
- `mode` — supplied by the host at construction. Not a runtime toggle in this feature.

**Invariants.**

1. Every id in `selection` exists in the current slide.
2. `textEditing`, when non-null, is in `selection` and its type declares a text surface.
3. `mode === 'read-only'` implies `draft` is referentially unchanged for the session's lifetime.
   `clipboard` is exempt: copying is permitted in read-only because it changes no authored data,
   while `paste` is refused by the reducer like every other edit (FR-051).

---

## 3. `Edit` — the mutation union

Every change to the draft is one of these. The union is the enumeration SC-017 tests against and the
seam ED-5 will later wrap (R-07).

| Variant | Payload | Requirements |
|---|---|---|
| `add-element` | `type`, `at?` | FR-013, FR-014 |
| `transform-elements` | `ids`, `geometry` per id | FR-003, FR-007 |
| `set-field` | `id`, `path`, `value` | FR-020, FR-023 |
| `set-slide-field` | `path`, `value` | FR-024 |
| `set-text` | `id`, `text` | FR-015 |
| `reorder` | `ids`, `direction` | FR-027 |
| `set-flag` | `ids`, `flag: 'locked' \| 'hidden'`, `value` | FR-029 |
| `duplicate` | `ids` | FR-032 |
| `paste` | `elements` — supplied from `session.clipboard` | FR-032 |
| `delete` | `ids` | FR-032, FR-033 |
| `align` | `ids`, `edge` | FR-006 |
| `distribute` | `ids`, `axis` | FR-006 |

**Not edits**: selecting, hovering, scrubbing the authoring time, entering text-edit mode, showing a
snap guide, and **copying**. They change no authored data, so they are session transitions and never
reach `applyEdit`. This is the line SC-007 measures. Copy is the one that looks like it belongs in the
table above and does not: it is half of a pair whose other half (`paste`) *is* an edit, which is
exactly why it needs saying.

**Reducer contract.** `applyEdit(draft, edit, ctx) -> Result`, where `ctx` supplies the `IdSource` and
the mode. Detailed in [contracts/edit-contract.md](./contracts/edit-contract.md). Three properties
hold for every variant: the result validates against the schema (FR-045); read-only refuses (FR-051);
and locked elements are skipped rather than the whole edit failing (FR-008, and the mixed-selection
edge case).

---

## 4. `IdSource`

```
type IdSource = () => string
```

Injected (FR-050, R-08). Default `crypto.randomUUID()`; tests inject a counter. Constrained only by
the schema's `identifier` — 1 to 128 characters — so no format negotiation is needed. Called once per
element created by `add-element`, `duplicate`, and `paste`; never anywhere else, so an edit's id
consumption is countable and SC-016's replay is exact.

---

## 5. Geometry values

Pure data, logical units throughout, no DOM (R-04).

| Type | Shape | Notes |
|---|---|---|
| `Geometry` | `{ x, y, width, height, rotation }` | Mirrors the manifest's element fields. |
| `TransformRequest` | `{ kind: 'move' \| 'resize' \| 'rotate', delta, handle? }` | Deltas in logical units. |
| `SnapCandidate` | `{ axis: 'x' \| 'y', at: number, source }` | Derived from sibling edges/centres and canvas edges/centre. |
| `SnapResult` | `{ geometry, guides: readonly SnapCandidate[] }` | Guides are session data — drawn, never stored. |

**Constants** (`geometry/constants.ts`), named and bounded per FR-005 and FR-035:

| Constant | Value | Bound |
|---|---|---|
| `SNAP_THRESHOLD_UNITS` | 8 | 0 disables snapping — a valid configuration and the negative control. Above ~24 on a 1600-unit canvas, unrelated edges capture. |
| `NUDGE_UNITS` | 1 | The smallest change the manifest can express meaningfully. |
| `NUDGE_UNITS_COARSE` | 10 | Modifier-held. |

**Invariants.** `width` and `height` stay positive — a resize clamps at the minimum rather than
producing a manifest the schema rejects (FR-007). Rotation does not alter stored `x`/`y`. Snapping
compares *authored* edges; a rotated element's visual bounds are not its geometry, and the editor does
not pretend otherwise.

---

## 6. `ElementEditorRegistry`

The fifth member of FR-FWK-002's plugin contract, finally given a home (see plan.md's Constitution
observation). Keyed by element type, registered in `@cuestack/studio`.

| Member | Purpose |
|---|---|
| `type` | The element type this entry edits. |
| `textSurface?` | Present when the type is editable on canvas (FR-015). Reads text from a payload and returns an updated payload. Absent means no on-canvas text editing — which is how the canvas knows, rather than by branching on type. |
| `defaults` | The geometry and payload a newly added element of this type starts with (FR-014). |

Type-specific *field* definitions are not here — they come from `ElementPlugin.inspector` in
`@cuestack/core`, unchanged (FR-018).

---

## 7. Ghost

Derived session data, computed per render, never stored.

```
Ghost = { elementId, geometry, reason: 'not-yet' | 'no-longer' | 'hidden', label }
```

Produced by diffing `slide.elements` against `RenderState.elements` (R-02). `reason` distinguishes
the two time cases by comparing the authoring time against the element's window, and `hidden` takes
precedence when both apply. Rendered by the overlay, selectable and focusable like any element, and
structurally unable to reach playback.

---

## 8. What deliberately has no model

- **Undo history.** No journal, no stack, no patch stream. Deletion is confirmed instead (FR-033).
  ED-5 owns this, and R-07 explains why the reducer is the seam it will wrap.
- **Persistence state.** No dirty flag, no save status, no version token. `StorageAdapter` exists and
  is not wired; ED-5 owns it.
- **Roles.** No Owner, Editor, Reviewer, or Viewer. `mode` is the only distinction and the host
  decides it (FR-051).
- **Groups.** No persistent grouping. A multiple selection is session data that does not survive
  deselection (FR-CAN-019 is out of scope).
- **A second timeline model.** `authoringTime` is one number per slide. ED-3's playhead must set this
  same value rather than introducing its own.
