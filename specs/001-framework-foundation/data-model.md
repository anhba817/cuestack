# Phase 1 Data Model: Lesson Manifest v1.0

**Date**: 2026-08-14 · **Feature**: `001-framework-foundation`

This document is the reviewable record of the riskiest assumption in the spec: product spec
§27 lists "key fields" per entity without saying which are required. Everything below resolves
that, field by field. A test asserts the Zod schemas agree with this document, so the two
cannot drift.

---

## Two decisions that shape everything below

**1. The manifest carries no identity, ownership, or timestamps.**

Product spec §27.1 lists `workspaceId`, `ownerId`, `draftVersionId`, `publishedVersionId`,
`createdAt`, and `updatedAt` on the Lesson entity. None of them enter the manifest. They are
records the *host application* keeps about a lesson, not properties of the lesson itself.

Keeping them out does three things at once: it satisfies FR-019 without a special case, since
there is simply no field an identifier could occupy; it makes the manifest portable, which
Wave 5's export package needs; and it keeps the round-trip in FR-006 honest, because a
manifest containing `updatedAt` could never round-trip through a system that touches it.

**2. Order is array position, not a field.**

§27.3 lists `order` on Slide. The manifest omits it. Array index *is* the order. A separate
`order` field can disagree with array position, and every such disagreement is a bug with no
correct resolution — you cannot know which one the author meant. FR-SLD-012 ("recalculate
order after a move") becomes vacuously satisfied. The same reasoning applies to `Effect.order`
with one exception, noted in that section.

---

## Entity: LessonManifest (root)

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | string | **yes** | Exactly `"1.0"` at v1. Absence is a rejection, not a default (US4 scenario 3). |
| `lesson` | LessonMeta | **yes** | |
| `slides` | Slide[] | **yes** | Minimum length 1. An empty lesson is a blocking error per §31. |

## Entity: LessonMeta

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Opaque, host-assigned. A stable reference, not a person. |
| `title` | string | **yes** | 1–200 characters after trim. |
| `description` | string | no | |
| `language` | BCP-47 tag | **yes** | Required, no default. It drives the document language for assistive technology; a wrong default is worse than a rejection (NFR-ACC, NFR-LOC-001). |
| `aspectRatio` | `"16:9" \| "4:3" \| "9:16"` | **yes** | All three accepted by the format at v1. Renderer support for 4:3 and 9:16 is FR-LSN-009 ("Should") and arrives later; the format not blocking them costs nothing now and avoids a migration later. |
| `themeId` | string | no | Defaults to `"default"` when absent, matching §28. |

## Entity: Slide

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique within the lesson. |
| `name` | string | no | Internal author-facing label (FR-SLD-004 is "shall be able to", i.e. author's choice). |
| `durationMs` | integer ≥ 0 | **yes** | BR-001. |
| `background` | Background | no | Color, gradient, or image variant. Absent means the theme's default. |
| `transition` | Transition | no | Absent means an instant cut. |
| `advance` | Advance | **yes** | Every slide has a progression rule. A slide without one cannot be played, and the teacher journey's stage-4 success signal is literally "every slide has a valid progression rule". |
| `elements` | Element[] | **yes** | May be empty — a slide with no content is a §31 *warning*, not an error, and warnings are Wave 5. |
| `accessibility` | SlideA11y | no | |
| `metadata` | Record<string, string> | no | Constrained to string values. Free-form nested data would defeat the reject-unknown-fields rule. |

## Entity: Element

Discriminated on `type`. Fields common to every element:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique within the slide. |
| `type` | ElementType | **yes** | `text \| image \| shape \| video \| audio \| button \| question` — the MVP set from FR-CAN-001. |
| `x`, `y`, `width`, `height` | number | **yes** | Logical canvas units, display-independent (FR-004, FR-CAN-017). |
| `rotation` | number | no | Degrees, defaults to 0. |
| `zIndex` | integer | **yes** | Explicit, not derived from array position — FR-CAN-008 lets an author reorder layers without reordering the array, so unlike slide order these genuinely differ. |
| `locked` | boolean | no | Defaults false. Authoring state; does not affect playback (BR-011). |
| `hidden` | boolean | no | Defaults false. **Does** affect playback (BR-010), so it belongs in the manifest, not in editor state. |
| `startMs` | integer ≥ 0 | **yes** | BR-002. |
| `endMs` | integer | **yes** | Must be > `startMs` (BR-003). |
| `effects` | Effect[] | no | Defaults to empty. |
| `style` | ElementStyle | no | Theme-token references only; literal colors are a Wave-2 lint concern but the format accepts tokens by name. |
| `payload` | discriminated by `type` | **yes** | |
| `accessibility` | ElementA11y | no | `altText` lives here. Structurally optional at v1; its absence on an image is a §31 warning produced by the Wave 5 validation engine, not a v1 rejection. |

### Payload by type

| `type` | Payload fields | Required |
|---|---|---|
| `text` | `text` | `text` |
| `image` | `asset`, `caption` | `asset` |
| `shape` | `shape` (`rect\|ellipse\|line\|arrow`) | `shape` |
| `video` | `asset`, `poster`, `volume`, `showControls`, `loop` | `asset` |
| `audio` | `asset`, `volume`, `showControls`, `loop` | `asset` |
| `button` | `label`, `action`, `url` | `label`, `action` |
| `question` | Interaction (below) | all Interaction required fields |

**Why `asset` and not `assetId`.** An earlier draft of this table named the field
`assetId`, which contradicted the AssetRef entity below — a bare id cannot carry the
`mimeType` and dimensions a renderer needs before the network answers, and their absence
is exactly what causes layout shift on load. The payload therefore carries the whole
`AssetRef`, whose `assetId` field is the id. Caught by `check-data-model.mjs` during
implementation, which is the check earning its place.

## Entity: Effect

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique within the element. |
| `type` | EffectType | **yes** | `appear \| fade \| slide \| zoom \| pulse \| highlight \| dim \| disappear` (FR-TIM-011). |
| `phase` | `enter \| emphasis \| exit` | **yes** | |
| `startMs` | integer ≥ 0 | **yes** | Relative to slide time, not element time. |
| `durationMs` | integer > 0 | **yes** | BR-004. Zero is rejected, not treated as instant — `appear` is the instant effect. |
| `order` | integer | **yes** | The exception to the array-position rule. FR-TIM-014 requires a *deterministic stored order* for effects sharing a start time; array position would supply one, but making it explicit means a resolver bug cannot be masked by an incidental array sort. |
| `easing` | string | no | Defaults to `"linear"`. |
| `parameters` | effect-specific record | no | Validated per effect type. |

## Entity: Interaction

Carried as the payload of a `question` element.

| Field | Type | Required | Notes |
|---|---|---|---|
| `interactionType` | `multiple_choice \| true_false` | **yes** | FR-INT-001. Multiple-select, short-answer, matching, and ordering are FR-INT-002 ("Should") and are not in the v1 enum — adding an enum member later is an additive migration. |
| `prompt` | string | **yes** | |
| `options` | Option[] | **yes** | Minimum 2. For `true_false`, exactly 2. |
| `correctResponse` | string \| string[] | **yes** | Must reference option ids that exist — a referential check, not structural. |
| `required` | boolean | **yes** | Explicit, no default. Whether a question gates progression is too consequential to infer (BR-005). |
| `maxAttempts` | integer > 0 | no | Absent means unlimited. |
| `shuffle` | boolean | no | Defaults false. FR-INT-008 is "Should". |
| `points` | number | no | Defaults 0. FR-INT-008 is "Should". |
| `correctFeedback` | string | no | |
| `incorrectFeedback` | string | no | |
| `completionPolicy` | `on_first_attempt \| on_correct \| on_attempts_exhausted` | no | Defaults `on_correct`. |

## Entity: Advance

Discriminated union on `mode`:

| Variant | Extra fields | Referential rule |
|---|---|---|
| `after_duration` | — | — |
| `on_click` | — | — |
| `after_media_ends` | `mediaElementId` | Must name a `video` or `audio` element on the **same slide** (BR-006). |
| `after_interaction` | `interactionElementId` | Must name a `question` element on the same slide whose `required` is true. |

## Entity: AssetRef

The manifest references assets; it does not describe where they are stored.

| Field | Type | Required | Notes |
|---|---|---|---|
| `assetId` | string | **yes** | Resolved through the host's AssetAdapter (Wave 1, EN-6). |
| `mimeType` | string | **yes** | Needed to choose a renderer without a network round-trip. |
| `width`, `height` | integer | conditional | Required for image and video. Their absence is what causes layout shift on load. |
| `durationMs` | integer | conditional | Required for video and audio; the media-end advance rule needs it before playback starts. |
| `captionTrack` | string | no | |
| `transcript` | string | no | |

§27.7's `storageKey`, `size`, `checksum`, and `processingStatus` are deliberately absent. They
describe a *stored file* in a particular host's storage, not a lesson. Wave 5's export package
carries its own asset manifest where checksums belong.

---

## Validation is two-tier

Structural rules live in the schema; referential rules cannot, because they need the whole
document. Both tiers run in one `validate()` call and their issues merge into one list.

**Tier 1 — structural**: types, required fields, ranges, enum membership, and rejection of any
field the format does not define (US1 scenario 7).

**Tier 2 — referential**:

1. Slide ids unique within the lesson; element ids unique within a slide; effect ids unique
   within an element.
2. `after_media_ends` names an existing video/audio element on the same slide (BR-006).
3. `after_interaction` names an existing required question element on the same slide.
4. `correctResponse` names option ids that exist on that interaction.
5. Every `assetId` referenced is well-formed (existence is the host's AssetAdapter's business,
   not the schema's).

Tier 2 runs only if Tier 1 produced no issues — referential checks over a structurally invalid
document produce noise, not information.

## Issue shape

```
ValidationIssue {
  code:     string              // stable identifier, e.g. "TIMING_END_BEFORE_START"
  rule?:    string              // "BR-003" where one applies
  path:     (string | number)[] // path into the manifest
  location: { slideId?, slideIndex?, elementId?, elementIndex?, field? }
  message:  string              // human-readable; contains no timestamps or randomness
}
```

`validate()` returns a result, never throws on invalid input — an invalid lesson is an expected
outcome, not an exceptional one. `code` is what callers branch on; `message` is for humans and
may be reworded without a breaking change. `location` is what FR-003 requires and what the
Wave 5 jump-to-source navigation will consume.

## Migration model

```
MigrationStep { from: "1.0", to: "1.1", up(manifest: unknown): unknown }
```

- Steps form a chain resolved from the manifest's declared version to the current version.
- A gap in the chain is detected and refused, never skipped (edge case in spec).
- A version newer than supported is refused with an explanatory issue and never partially
  loaded (US4 scenario 2).
- `up` receives a structurally-cloned input and returns a new value. The caller's manifest is
  never mutated (FR-011, US4 scenario 4).
- No step may read a clock or a random source (research R-07), so re-running a migration on
  the same input is byte-identical.

## State that is *not* in this model

Lesson status — Draft, In Review, Published, Archived — is a host record, not a manifest field.
The manifest describes lesson *content*; whether a particular snapshot of that content is
published is a fact about the host's records. Wave 5 (PB-2) implements the transitions against
the StorageAdapter.
