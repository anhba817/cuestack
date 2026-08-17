# Data Model: Timeline and Simple Sequence Mode

**Feature**: `006-timeline-and-sequencing` · **Date**: 2026-08-16 · **Plan**: [plan.md](./plan.md)

The lesson format does not change. Everything this feature edits already exists in the schema, and
everything this feature *shows* is derived from it. One authoring-metadata type in
`@cuestack/core` grows a field.

---

## 1. What already exists, and is only now reachable

### 1.1 `Effect` — `packages/schema/src/validate/effect.ts`

| Field | Type | Constraint | Who writes it here |
|---|---|---|---|
| `id` | `string` | 1–128 chars | `add-effect`, from the session's `IdSource` |
| `type` | `EffectType` | one of the eight registered | teacher, chosen from the registry |
| `phase` | `EffectPhase` | `enter` \| `emphasis` \| `exit` | teacher, constrained to `descriptor.phases` |
| `startMs` | `msInt` | integer ≥ 0, **slide time** | drag or field |
| `durationMs` | `msDuration` | integer **> 0** (BR-004) | drag or field |
| `order` | `int` | any integer | assigned on add, used for FR-022's tie-break |
| `easing` | `string?` | 1–64 chars | defaults to `descriptor.defaultEasing` |
| `parameters` | `Record<string, string \| number \| boolean>?` | — | teacher, through fields declared by the descriptor |

Two things about this table matter more than the rest. `startMs` is **slide** time, not element
time — which is what lets one ordered event list hold elements and effects with no conversion
(R-06). And `durationMs` is `positive()`, so zero is not "instant": `appear` is. FR-023 is that
constraint surfaced with a reason rather than a schema error.

### 1.2 Element timing — `packages/schema/src/validate/element.ts`

`startMs: msInt`, `endMs: msInt`, plus a cross-field refinement: `endMs` must be **greater than**
`startMs`. The shortest legal element is therefore 1 ms — the floor a drag stops at (FR-014), the
same shape as `MIN_EXTENT_UNITS` in geometry.

`locked` and `hidden` are both optional booleans. `locked` refuses a re-time (FR-016); `hidden`
does not — a hidden element still has a track (FR-003) and still takes its place in the event order
(edge case: "Simple Sequence over an element whose previous sibling is hidden").

### 1.3 `Slide.durationMs`

**`msInt`, integer ≥ 0** — `lesson.ts:32`. Not `msDuration`, which is what an earlier draft of this
document asserted from memory; the schema was read afterwards and it says otherwise. The only slide
field this feature writes, and only through `extend-slide` (FR-038).

**Zero is legal, and the timeline must survive it.** A slide that advances `on_click` has no reason
to carry a duration. Three consequences follow, all of them the timeline's problem: the ruler has
zero width; the scale's round-trip property over "every millisecond in the slide" is vacuously true;
and **every element overruns**, because `collectProblems` tests `endMs > slide.durationMs` and every
element has `endMs ≥ 1`. The last is the kernel answering correctly — the timeline must present it
as one problem about the slide, not three hundred about its elements.

---

## 2. The one core change

### `EffectDescriptor.parameters` — `packages/core/src/effects/registry.ts`

```text
EffectDescriptor {
  type, phases, motion, at, reduced?, defaultEasing,
+ parameters?: readonly InspectorField[]
}
```

Reusing `InspectorField` from `elements/contract.ts` rather than inventing a shape: it already
carries `key`, `label`, `kind`, `options`, and — since feature 005 — `of`/`minItems`. Effect
parameters are the problem the inspector already solved.

One difference from element fields, and it must be stated because the editor's field renderer keys
off it: an `InspectorField.key` on an element is a **dotted path from the element root**
(`payload.text`). On an effect it is a **flat key into `effect.parameters`** (`amount`). The
contract file records this; the editor never runs a dotted read on an effect parameter.

What each built-in declares, read from its implementation rather than guessed:

| Effect | `motion` | Declares | Default, as inlined in `at()` |
|---|---|---|---|
| `appear` | false | — | — |
| `fade` | false | — | — |
| `disappear` | false | — | — |
| `slide` | true | `from`: select of `top` \| `bottom` \| `left` \| `right` | `bottom` |
| | | `distance`: number, logical units | `64` |
| `zoom` | true | `from`: **number** — the scale it starts at | `0.92` |
| `pulse` | true | `amount`: number | `0.08` |
| `highlight` | false | `amount`: number | `0.4` |
| `dim` | false | `amount`: number | `0.5` |

**Read from the implementations, not assumed** — and reading them found two things worth
recording. `slide.from` is a *direction string* while `zoom.from` is a *starting scale number*:
one key, two types, two meanings, in two effects a teacher will use side by side. And `amount`
means three different magnitudes with three different defaults across `pulse`, `highlight`, and
`dim`. An editor that had guessed a shared parameter shape from the names would have offered a
direction dropdown for `zoom` and one default for `amount`. This is the argument for declaring
parameters per descriptor rather than centrally, in one paragraph.

The defaults stay where they are — inside each `at()` — because `at` is called on a server per
frame and must keep working when `parameters` is absent. The declaration says *what may be set*;
it does not become the effect's only source of a default.

`EffectDescriptor` is registry metadata: serialized into no manifest, read on no playback path.
Additive, so no `schemaVersion` implication (FR-045).

**Which registry, and how it reaches the editor.** `resolve(slide, timeMs, context?)` takes
`context.effects?: EffectRegistry`, defaulting to a module-level registry over `builtinEffects` —
and **nothing in this repository has ever passed a `ResolveContext`**. Both the player and the
editor call `resolve` with two arguments. So the editor threads one registry instance through
`EditorCanvasProps.effects` and `InspectorProps.effects`, both optional and both defaulting to
core's own, and passes it as `ResolveContext.effects` to *every* `resolve` call site — the canvas's
render-time one and playback's `resolveAt`. One instance, or the menu and the canvas disagree about
which effects exist, and the editor renders `UNKNOWN_EFFECT_TYPE` for something it offered.

---

## 3. Derived, never stored

Everything in this section is computed from the draft on read. None of it appears in a manifest —
SC-008 and SC-014 measure exactly that.

### 3.1 `Track`

```text
Track {
  elementId: string
  startMs, endMs: number      // straight from the element
  locked, hidden: boolean     // presentation only; hidden still gets a track (FR-003)
  label: string               // the element's accessible name, for the track's own name
  effects: readonly EffectBar[]
}

EffectBar { effectId, type, phase, startMs, endMs }   // endMs = startMs + durationMs
```

Built by enumerating `slide.elements` in paint order — **not** by reading `RenderState.elements`,
which is documented as visible elements only (R-03, FR-003). Two effects overlapping in time
produce two bars; the timeline draws both rather than collapsing them (edge case).

### 3.2 `Playhead` and `TimeScale`

The playhead is not an entity. It is `session.authoringTime` drawn on the ruler — one value,
one control writing it (FR-006, FR-011). During playback it is read from the transport and written
to the DOM by the frame loop, and the session's copy is stale by contract until playback stops
(R-02).

```text
TimeScale { pxPerSecond: number }   // editor state, never serialized (FR-044)
```

Changing it must preserve the moment, not the pixel (FR-007) — which is also what makes the
mid-drag rescale edge case fall out for free, since a drag is expressed in milliseconds
throughout (R-07).

### 3.3 `Event` and `SequenceRelationship`

```text
Event {
  kind: 'element' | 'effect'
  elementId: string
  effectId?: string           // present iff kind === 'effect'
  startMs, endMs: number
  label: string
}

Relationship =
  | { kind: 'with-previous' }
  | { kind: 'after-previous' }
  | { kind: 'after-previous-delay', delayMs: number }   // delayMs > 0
  | { kind: 'custom' }
  | { kind: 'first' }          // no previous event (FR-033)
```

**Ordering** (R-06): by `startMs`, then by the owning element's paint order, then by
`Effect.order`. The same tie-break the resolver uses, so the sequence view and playback never
disagree about which of two simultaneous things is "previous".

**Classification** is exact, not tolerant:

| Given event `e` and its predecessor `p` | Relationship |
|---|---|
| `e.startMs === p.startMs` | With Previous |
| `e.startMs === p.endMs` | After Previous |
| `e.startMs > p.endMs` | After Previous, delay `e.startMs - p.endMs` |
| anything else (including `p.endMs > e.startMs > p.startMs`) | Custom |
| no predecessor | First — shown as starting at the slide's beginning |

Exact equality is deliberate. A tolerance would make two teachers' identical-looking slides
classify differently, and the format stores integer milliseconds so exactness is reachable (R-05).
The overlap case classifying as Custom is what FR-031 asks for: shown as Custom, not silently
reinterpreted.

The table's only input is **adjacency** — the event before this one in the list. Neither event's
`kind` appears anywhere in it, which is what makes FR-036 true by construction: element→element,
effect→effect, element→effect, and effect→element all take the same path. A classifier that grew a
"same element?" branch would pass every other assertion and fail only that one.

**Reordering re-classifies; it does not re-resolve.** A reorder changes `zIndex`, which changes
paint order, which is the *tie-break* in the ordering above — so it changes "previous" only among
events sharing a start time, and it changes no stored value at all. Only `apply-sequence` writes
timing (FR-034).

**Resolution** — applying a relationship — writes only `startMs`/`endMs` on elements and
`startMs` on effects. An element's duration is preserved when its start moves; an effect's
`durationMs` is preserved likewise. Nothing else is touched, which is what makes FR-030's
"changes zero values" testable.

### 3.4 `Overrun`

Not a new type. It is `RenderState.problems` filtered to `ELEMENT_BEYOND_SLIDE` and
`EFFECT_BEYOND_SLIDE`, both of which the kernel has emitted since Wave 1 and nothing has read
(R-08). Each already carries `elementId`, optional `effectId`, and a message naming the problem,
the affected element, and the action — which is FR-040 already satisfied by the kernel's own
wording.

The extend-slide target is arithmetic over the same data:

```text
requiredDurationMs = max over elements of ( element.endMs,
                                            max over its effects of (startMs + durationMs) )
```

---

## 4. New edit variants

Six additions to the closed `EDIT_KINDS` union in `packages/studio/src/draft/edit.ts`. Closed on
purpose: the read-only suite enumerates it, so a variant added later is refused-by-default and
fails a test until someone says so deliberately (feature 005, SC-017). All six route through
`applyEdit`, so read-only refusal and post-edit validation hold without restatement (FR-042).

| Kind | Shape | Refuses when |
|---|---|---|
| `set-timing` | `{ id, startMs?, endMs? }` | element locked (BR-011); result fails validation |
| `add-effect` | `{ id, type, phase, startMs, durationMs }` | element locked; unknown type; element not found |
| `set-effect` | `{ id, effectId, patch: { startMs?, durationMs?, phase?, easing?, parameters? } }` | element locked; `durationMs <= 0` (FR-023); effect not found |
| `remove-effect` | `{ id, effectId }` | element locked; effect not found |
| `apply-sequence` | `{ relationships: readonly { eventKey, relationship }[] }` | **every** affected element locked (locked members are otherwise skipped and reported, per `partitionLocked`); result fails validation |
| `extend-slide` | `{ durationMs }` | result fails validation |

`extend-slide` is a distinct kind rather than a `set-slide-field` on `durationMs` because FR-038
is an *offer with a computed target* — the reducer computes it from the draft so the surface
cannot compute a different number.

`set-timing` takes a **single `id`**, not an array. The specification puts multi-select timing edits
out of scope — "dragging re-times one element at a time" — and a plural signature would be the
editor quietly building an affordance no requirement asks for and no test covers. Every other
multiple-element kind in the union earned its array from a requirement; this one has not.

`eventKey` is `elementId` for an element event and `elementId + ':' + effectId` for an effect
event. A derived key, because an event has no id of its own and giving it one would be storage
(FR-029).

---

## 5. Constants

Named exports with their bounds written down, the precedent being `MEDIA_SYNC_TOLERANCE_MS` and
feature 005's `geometry/constants.ts`.

| Constant | Value | Why |
|---|---|---|
| `SNAP_THRESHOLD_MS` | 80 | FR-015. Below ~30 ms the snap is unreachable at ordinary scales; above ~150 ms unrelated events capture each other. Zero disables it — the negative control the snap suite uses. |
| `MIN_ELEMENT_DURATION_MS` | 1 | `endMs > startMs`, so a drag must stop somewhere. One millisecond is the shortest the format describes. |
| `MIN_EFFECT_DURATION_MS` | 1 | `msDuration` is `positive()`. Same reasoning, different field. |
| `NUDGE_MS` | 10 | One arrow press on a track. |
| `NUDGE_MS_COARSE` | 100 | One arrow press with a modifier. |
| `DEFAULT_EFFECT_DURATION_MS` | 400 | A newly added effect must be immediately valid *and* visible (FR-019). |
| `MIN_PX_PER_SECOND` / `MAX_PX_PER_SECOND` | 20 / 800 | Time-scale bounds. The lower keeps a 1 ms bar hittable via its minimum rendered width; the upper keeps a 10-minute slide scrollable rather than unreachable. |
| `MIN_BAR_PX` | 8 | A bar too small to hit is a bar that cannot be edited (edge case: the one-millisecond window). Presentation only — it never changes a stored value. |

---

## 6. State transitions

Only one entity in this feature has states, and it is not new.

```text
        play()                pause()
idle ──────────► playing ◄──────────── paused
  ▲                │  │                   ▲
  │                │  └── document hidden ┘   (BR-013, automatic; resumes on return)
  │  restart()     │
  └────────────────┘  seek(ms) — legal in every state, and it is what a playhead drag issues
```

Owned by `createTransport`. The editor commands it and reads it; it implements none of it. A
playhead drag during playback issues `seek()` and playback continues from there (US1 scenario 11)
— the drag commands the clock rather than fighting it.

The session's own reconciliation rule, stated once because R-02 makes it a contract:
`session.authoringTime` equals the transport's `slideTimeMs` in `idle` and `paused`, and is
permitted to lag it in `playing`.

---

## 7. What is never written

| Value | Lives in | Verified by |
|---|---|---|
| Time scale (`pxPerSecond`) | editor state | SC-014 |
| Track scroll position | DOM | SC-014 |
| Which view is open (timeline or sequence) | editor state | SC-014 |
| Authoring time / playhead | session state | SC-014 |
| Sequence relationships | **nowhere — derived** | SC-008 |
| Transport state | the transport | SC-014 |

The sequence row deserves the emphasis. Constitution III forbids mode-specific storage outright,
so a relationship is a classification computed on read. That is what makes FR-029 and SC-008
testable rather than aspirational: apply a sequence, save, read back, and compare — if the
manifest differs by anything other than `startMs`/`endMs`/`durationMs`, the mode grew storage.
