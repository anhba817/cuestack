# Phase 1 Data Model: Headless Kernel

**Date**: 2026-08-14 · **Feature**: `002-headless-kernel`

Feature 001's data model described *stored* data — the lesson format. This one describes
*computed* data: what the kernel produces and the shapes through which it is driven. Nothing
here is persisted, and nothing here appears in a manifest.

---

## The load-bearing distinction

A **manifest** says what an author intended. A **RenderState** says what is true at one instant.
Every field below is derived; none is authored. This matters because it is what lets `resolve()`
be pure: it reads authored intent and returns computed truth, and the two never mix in one
structure.

---

## Entity: RenderState

The complete appearance of one slide at one time. The single value both an editor preview and a
learner player consume — Constitution V's "one engine" in data form.

| Field | Type | Notes |
|---|---|---|
| `slideId` | string | Which slide this describes. |
| `timeMs` | integer | The time it was computed for. Present so a state can be checked against its own provenance. |
| `elements` | `ResolvedElement[]` | Visible elements only, already sorted into paint order. |
| `problems` | `RenderProblem[]` | Non-fatal issues found while resolving — an unknown optional element type, an effect extending past the slide. Empty in the normal case. |
| `blocked` | `BlockingProblem \| null` | Present when the slide cannot be meaningfully played: an unregistered required interaction type, an advance rule that can never be satisfied. |

`elements` is pre-sorted rather than leaving paint order to the consumer. Two consumers sorting
independently is two chances to sort differently, and a difference in paint order is exactly the
class of preview-player divergence Principle V exists to prevent.

## Entity: ResolvedElement

| Field | Type | Notes |
|---|---|---|
| `id` | string | The authored element id. |
| `type` | string | The authored type, for the consumer to dispatch a renderer on. |
| `geometry` | `{ x, y, width, height, rotation }` | Logical canvas units, effects already applied. |
| `zIndex` | integer | Authored layer order, carried through for reference; `elements` order already reflects it. |
| `opacity` | number 0–1 | Composed from every active effect. |
| `transform` | `TransformDelta` | Composed translate / scale / rotate offsets, relative to `geometry`. |
| `filter` | `FilterDelta \| null` | Brightness and blur deltas, for highlight and dim. |
| `activeEffects` | `ActiveEffect[]` | Which effects are contributing and at what progress. Diagnostic, and what the editor's timeline reads to show a playhead. |
| `payload` | authored payload | Passed through unchanged. The kernel does not interpret element content. |
| `accessibility` | `{ altText?, label?, hidden? } \| null` | Passed through unchanged, and never defaulted — an absent block and an empty one mean different things. **Added in Wave 2**, which found it missing: a renderer receives only a `ResolvedElement` and FR-015 requires it to expose an image's alternative text, so without this the alt text was in the manifest and unreachable by the one component that needs it. |
| `available` | boolean | False when the element's type is not registered — the placeholder case from FR-027. |

`transform` is kept separate from `geometry` rather than folded into it. An element that has been
translated 40 px by a slide-in effect is still *authored* at its original position, and the
editor needs to show the authored value while the player needs the effective one. Collapsing
them would lose the distinction irrecoverably.

## Entity: ActiveEffect

| Field | Type | Notes |
|---|---|---|
| `id` | string | The authored effect id. |
| `type` | string | e.g. `fade`. |
| `phase` | `enter \| emphasis \| exit` | |
| `progress` | number 0–1 | Eased progress at the resolved time, not raw linear position. |
| `motion` | boolean | Whether this effect moves things — the fact a consumer needs to honour reduced-motion (R-09). |

## Entity: EffectDescriptor

What a registration supplies. Not a manifest shape — this is code.

| Field | Type | Notes |
|---|---|---|
| `type` | string | Registry key. |
| `phases` | `EffectPhase[]` | Which phases this effect is valid in. |
| `motion` | boolean | |
| `at` | `(progress, params) => Contribution` | The whole implementation. Pure; must not read a clock. |
| `defaultEasing` | string | Applied when the author specifies none. |

## Entity: Contribution

An effect's partial output at one progress value. Composes associatively (R-02).

| Field | Type | Composition |
|---|---|---|
| `opacity` | number 0–1, optional | Multiplied across contributions. |
| `translate` | `{ x, y }`, optional | Summed. |
| `scale` | `{ x, y }`, optional | Multiplied. |
| `rotate` | degrees, optional | Summed. |
| `brightness` | number, optional | Multiplied. |
| `blur` | px, optional | Summed. |

The identity contribution is the empty object, which is why an element with no effects resolves
to its authored geometry at full opacity without a special case.

## Entity: ElementPlugin

The full contract of FR-026. All five members required; a partial registration does not compile.

| Member | Purpose |
|---|---|
| `type` | Registry key. |
| `schema` | The payload shape this type accepts. |
| `resolve` | How the kernel derives this type's contribution to a RenderState. |
| `inspector` | Which properties the editor should offer. Declarative; consumed in Wave 4. |
| `validate` | Type-specific checks beyond the schema's structural ones. |

A plugin receives only its own element and the lesson's theme values (FR-029). It never receives
the lesson, the slide, or anything describing the learner — the signature makes that impossible
rather than discouraged.

## Entity: Transport

The playback control surface.

| Field | Type | Notes |
|---|---|---|
| `state` | `idle \| playing \| paused \| completed` | |
| `slideIndex` | integer | Which slide is current. |
| `slideTimeMs` | integer | Time within the current slide. Always ≥ 0; resets per slide. |
| `instanceId` | string | Slide id plus visit counter — the single-fire key (R-05). |

Operations: `play`, `pause`, `seek(slideTimeMs)`, `restart`, `goToSlide(index)`. Every one is
synchronous and returns the resulting transport value, so a caller never has to guess whether an
operation took effect.

## Entity: AdvanceDecision

| Field | Type | Notes |
|---|---|---|
| `instanceId` | string | Which slide instance advanced. Ignoring a repeat is a set membership test. |
| `cause` | `duration \| learner_action \| media_ended \| interaction_completed` | Which condition fired. Kept because "why did this advance early" is otherwise unanswerable in a bug report. |
| `atSlideTimeMs` | integer | |

## Ports the host must supply

The complete list of things the kernel cannot do itself. Structural, so a reviewer can see the
whole boundary at once rather than discovering it a file at a time.

| Port | Direction | Supplies |
|---|---|---|
| `TimeSource` | read | Monotonic milliseconds. |
| `MediaPort` | read only (R-04) | Position, duration, ended-state per media element id. |
| `VisibilityPort` | read + subscribe | Whether the host document is hidden. |
| `StorageAdapter` | read/write | Lesson load, save with conflict token, version list. |
| `AssetAdapter` | read | Asset id to resolvable location. |
| `AnalyticsAdapter` | write | Event recording. |

## State transitions

The playback states from product spec §29, and the kernel's part in each:

```
idle ──play──> playing ──pause──> paused ──play──> playing
                  │                                    │
                  ├──duration/media/interaction──> (advance) ──> playing (next slide)
                  ├──document hidden──> paused (clock stops; FR-016)
                  └──last slide advances──> completed
```

Two states from §29 are deliberately absent. **Loading** is the host's: the kernel is
synchronous and has nothing to wait for. **Waiting for Interaction** is not a state but a
condition — the transport stays `playing` with its clock possibly at the slide's end while the
advance controller withholds a decision. Modelling it as a state would put the same fact in two
places and invite them to disagree.

**Error** is likewise not a transport state. Problems surface as `RenderState.problems` and
`RenderState.blocked`, attached to the thing that has the problem, so a consumer can render
three good elements and one placeholder instead of losing the slide.
