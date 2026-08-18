# Data Model: Preview Harness

**Feature**: `007-preview-harness` · **Date**: 2026-08-18 · **Plan**: [plan.md](./plan.md)

**Nothing in this feature is stored.** The lesson format does not change, no manifest field is
added, and the preview writes nothing at all — it is a viewer. Everything below is either session
state that dies with the preview, or a contract member that already exists and finally acquires a
producer.

---

## 1. What already exists, and is only now reachable

### 1.1 `AdvanceControllerOptions.allowOverride` — `packages/core/src/advance/controller.ts`

```text
AdvanceControllerOptions { allowOverride?: boolean }
AdvanceSignals           { overrideAdvance?: boolean }
AdvanceCause             = 'duration' | 'learner_action' | 'media_ended'
                         | 'interaction_completed' | 'override'
```

Declared since Wave 1, described as **test-only**, and **never passed by anything**.
`LessonPlayerClient` calls `createAdvanceController(activePorts)` with no options and builds signals
with `learnerAdvanced` and `completedInteractions` only.

The short-circuit is the semantics FR-017 needs, and its position matters:

```text
if (allowOverride === true && signals.overrideAdvance === true) return decide('override')
if (hasIncompleteRequiredInteraction(ctx)) return null    // BR-005 — outranked by the override
…every automatic condition…
```

The override outranks BR-005's required-interaction gate, which is exactly what lets a teacher past
a question they have not answered. Nothing needs to be added for that; it needs to be *passed*.

**Two conditions, both false in a learner's player.** The bound the option's own comment demands —
"a test affordance that leaks into playback is worse than none" — is kept by the player's new prop
being absent by default: the option stays false, and the signal is inert regardless.

### 1.2 `AdvanceController.reachability` — same file

```text
reachability(slide: Slide, media?: MediaPort): BlockingProblem | null
```

Public since Wave 1, wired to the learner in Wave 3, never shown to the author. `BlockingProblem`
already carries `code`, an optional `elementId`, and a message written for a human — so FR-021's
"naming the slide and the reason" is satisfied by the kernel's own wording rather than by a second
message.

### 1.3 `LessonPlayerClientProps` — `packages/react/src/player/LessonPlayerClient.tsx`

Every prop a preview needs already exists: `lesson`, `slideIndex`, `ports`, `resolveAsset`,
`children`, `onReady`. See [contracts/preview-contract.md](./contracts/preview-contract.md) §1 for
what each one carries.

---

## 2. The two additions

### 2.1 `LessonPlayerClientProps.overrideAdvance`

```text
LessonPlayerClientProps {
  …,
+ overrideAdvance?: boolean
}
```

The first producer of §1.1. **Optional, and absent means absent** — a learner's player passes
nothing, constructs the controller exactly as it does today, and cannot override anything.

Two mechanics the implementation must get right, both consequences of where the controller is built:

| Concern | Answer |
|---|---|
| The controller is constructed once in a mount effect; the switch is live | Construct with `allowOverride: overrideAdvance !== undefined` — presence marks a preview host — and read the *current* boolean through a ref when building signals. |
| A stale ref would leave the switch on after it was turned off | FR-020 requires gates to reapply immediately, so the ref is updated on every render, as `stepRef` and `latest` already are. |

Not a `previewing` prop. Naming it after what it *does* keeps the player free of editor concepts —
the player has no idea what a preview is, and should not gain one.

### 2.2 `EditorCanvasProps.resolveAsset`

```text
EditorCanvasProps {
  …,
+ resolveAsset?: AssetResolver
}
```

Passed straight to `SlideView`, which already accepts it and falls back to `defaultAssetResolver`.

This closes a gap in the **editor**, found by asking a question about the preview: a host that
supplies a resolver to `<LessonPlayer>` has had no way to supply one to `<EditorCanvas>`. The canvas
has therefore never shown a host's real images, and it looked correct because the reference lesson's
asset ids are opaque and nothing serves them.

---

## 3. Session state, and none of it survives

Everything here lives in `usePreviewSession` and dies when the preview closes. SC-005 verifies that
none of it appears in a saved manifest.

```text
PreviewSession {
  startPoint: StartPoint        // captured once, at open
  overrideAdvance: boolean      // false at open, always
  preset: ViewportPreset        // 'desktop' | 'tablet' | 'mobile'
  state: 'closed' | 'open'
}
```

### 3.1 `StartPoint`

```text
StartPoint { slideIndex: number; atMs: number }
```

Derived by `startPoint.ts` from the session's `slideId` and `authoringTime`, **once**, when the
preview opens. Three requirements fall out of that single word:

| Requirement | Why "once" gives it |
|---|---|
| FR-012, restart returns to where the preview began | A value that cannot change cannot drift |
| FR-006, closing restores the editor | Nothing was modified, so nothing needs restoring |
| FR-011, playback continues through the lesson from there | The player owns everything after the seek |

The `slideId` → `slideIndex` conversion is the only translation between the editor's vocabulary
(ids, because the session keys per-slide state by id) and the player's (indices, because a lesson is
an ordered array). Stated in one pure function so the mismatch is written down rather than assumed
at each call site.

**Three ways to open, one shape.** FR-008, FR-009, and FR-010 differ only in what they capture:

| Action | `slideIndex` | `atMs` |
|---|---|---|
| From the beginning | 0 | 0 |
| From the current slide | the editor's slide | 0 |
| From the current position | the editor's slide | `session.authoringTime` |

### 3.2 `overrideAdvance`

One boolean for the preview's lifetime, **false at every open** (FR-018). Clarification settled the
shape: a teacher testing slide nine of a gated lesson pays one action, not eight.

The cost is the risk FR-019 answers — a switch that lasts is a switch that gets forgotten — which is
why the indicator is required to be *continuous* rather than a one-time confirmation. The longer a
state lasts, the less a single announcement is worth.

### 3.3 `ViewportPreset`

```text
ViewportPreset = 'desktop' | 'tablet' | 'mobile'
```

A width on the preview's own viewport wrapper, and nothing else — not a maximum, and not the stage.
The preview is a `<dialog>`, whose UA rendering is `width: fit-content`, so a maximum would cap an
element with no width of its own; and `.cs-stage` *is* the container (`container-type: size`), which
the frame both cannot and must not style. Aspect ratio is authored data and does not change;
geometry is in logical coordinates and rescales itself through container query units (FR-CAN-017,
FR-CAN-018). FR-023 is therefore true by construction, and its test compares a manifest before and
after rather than inspecting a layout.

What the preset *reveals* is the player's legibility floor (FR-024): type is
`max(12px, … · 100cqw)`, so below roughly 600 px on a 1600-wide canvas it stops shrinking and grows
relative to the box it was authored in. The three presets are chosen to straddle that.

---

## 4. Constants

| Constant | Value | Why |
|---|---|---|
| `PREVIEW_PRESETS` | `desktop: 1280`, `tablet: 834`, `mobile: 390` | The constitution's authoring target is 1280 px and wider, so desktop matches it. The other two are the common logical widths of a tablet and a phone in portrait; exact numbers matter less than the *proportions* being recognisably different, since what is being checked is whether a slide holds together in less room. |

---

## 5. State transitions

```text
        open(from)                    close()
closed ───────────► open ─────────────────────► closed
                     │                            ▲
                     │  the player's transport:   │
                     │  idle ⇄ playing ⇄ paused   │
                     └────────────────────────────┘
```

The preview's own state machine is two states. Everything inside it — play, pause, seek, slide
changes, completion — belongs to the transport and the player, which have owned it since Wave 1.

Closing while playing stops the clock because the player unmounts, which tears down the frame loop
and the transport with it. Nothing keeps running behind the editor, and nothing needs to be told to
stop.

---

## 6. What is never written

| Value | Lives in | Verified by |
|---|---|---|
| Start point | `usePreviewSession` | SC-005 |
| Override switch | `usePreviewSession` | SC-005, SC-008 |
| Viewport preset | `usePreviewSession` | SC-005, FR-023 |
| Whether a preview is open | `usePreviewSession` | SC-005 |
| Transport state | the player's transport | SC-005 |

FR-026 states the stronger claim the whole table rests on: **the preview cannot modify the draft.**
It receives the manifest and no mutation path — no session `apply`, no reducer. A preview that could
edit would be a second editor, and the two would disagree about what a lesson is.
