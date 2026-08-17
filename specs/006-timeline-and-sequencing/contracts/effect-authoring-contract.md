# Contract: Authoring effects

**Feature**: `006-timeline-and-sequencing` · Covers US3 · FR-018–FR-026

Eight effects have been implemented, tested, and unreachable by a teacher since Wave 1.
`Element.effects` is a field only a hand-written manifest can populate. This contract is what
changes that, plus the one core-package change it needs.

---

## 1. The core change

```text
EffectDescriptor {
  type, phases, motion, at, reduced?, defaultEasing,
+ parameters?: readonly InspectorField[]
}
```

Reusing `InspectorField` from `packages/core/src/elements/contract.ts` rather than inventing a
shape. It already carries `key`, `label`, `kind`, `options`, and — since feature 005 — `of` and
`minItems`. Effect parameters are the problem the inspector already solved, and sharing the type
means the editor renders both with one set of field components.

**One difference, and it is load-bearing.** An `InspectorField.key` on an element is a *dotted path
from the element root* (`payload.text`). On an effect it is a *flat key into `effect.parameters`*
(`amount`). The editor must never run a dotted read against an effect parameter. Stated here
because the two uses share a type and would otherwise share a code path by accident.

`EffectDescriptor` is registry metadata: serialized into no manifest, read on no playback path.
Additive, so no `schemaVersion` implication (FR-045). `at()` keeps its untyped `EffectParams` bag
and keeps its inlined defaults — it runs on a server per frame and must work when `parameters` is
absent. A declaration says *what may be set*; it does not become the only source of a default.

### What each built-in declares

| Effect | Phases | `motion` | Parameters | Default in `at()` |
|---|---|---|---|---|
| `appear` | enter | false | — | — |
| `fade` | enter, emphasis, exit | false | — | — |
| `disappear` | exit | false | — | — |
| `slide` | enter, exit | true | `from`: select `top`/`bottom`/`left`/`right` | `bottom` |
| | | | `distance`: number, logical units | `64` |
| `zoom` | enter, exit | true | `from`: **number**, the scale it starts at | `0.92` |
| `pulse` | emphasis | true | `amount`: number | `0.08` |
| `highlight` | emphasis | false | `amount`: number | `0.4` |
| `dim` | emphasis | false | `amount`: number | `0.5` |

**Read from the implementations.** Two findings the reading produced, both of which would have
broken a guessed design: `slide.from` is a direction string while `zoom.from` is a starting scale
number — one key, two types, two meanings, in two effects a teacher picks between in the same
menu. And `amount` carries three different defaults across `pulse`, `highlight`, and `dim`. A
central parameter table would have offered `zoom` a direction dropdown and one default for
`amount`. Per-descriptor declaration is not merely tidier; the alternative was wrong.

## 2. Everything comes from the registry — and it must be *one* registry

`resolve(slide, timeMs, context?)` takes `context.effects?: EffectRegistry`, defaulting to a
module-level registry over `builtinEffects`. **Nothing in this repository has ever passed a
`ResolveContext`**: every call site in the player and the editor is two-argument. The field exists,
is well designed, and has no producer — the fourth such member this wave has found, after
`ElementPlugin.inspector`, `EffectDescriptor.parameters`, and `RenderState.problems`.

So the editor threads one instance:

```text
EditorCanvasProps { …, effects?: EffectRegistry }   // → ResolveContext.effects, render-time resolve
InspectorProps    { …, effects?: EffectRegistry }   // → the effect menu and its parameter fields
usePlayback       resolveAt uses the same context   // → the playing path
```

Both props optional, both defaulting to core's own — the shape `InspectorProps.plugins?:
ElementRegistry` already established for element plugins, deliberately mirrored so the effect
registry does not arrive as a differently-shaped afterthought.

**One instance, or the test passes and the feature fails.** A registry reaching the menu but not
`resolve` produces an effect a teacher can add and the canvas renders as `UNKNOWN_EFFECT_TYPE`. A
registry reaching the render-time `resolve` but not `resolveAt` produces an effect visible while
scrubbing and absent while playing — a forked path in the one function that exists to prevent
forked paths (Constitution V).

| Promise | Requirement |
|---|---|
| The effects offered are the injected registry's `types()`, not a list this feature maintains | FR-018, FR-026 |
| The same instance reaches the menu, the render-time `resolve`, and `resolveAt` | FR-043, Constitution V |
| The phases offered for a chosen effect are `descriptor.phases` | FR-019 |
| The parameters offered are `descriptor.parameters` | FR-020, FR-026 |
| The default easing is `descriptor.defaultEasing` | FR-019 |
| No module branches on effect type | Constitution I |
| A ninth effect registered by a plugin appears with no editor change | FR-FWK-003, FR-FWK-004 |

The last row is the test that proves the rest, and it has two halves. Register a synthetic effect in
a test registry, pass that registry to both the canvas and the inspector, and assert it appears in
the menu with its declared phases and parameter fields **and renders on the canvas**. Asserting only
the first half is how an effect the menu offers and the resolver rejects would ship — worse than one
never offered, because the teacher can author it.

**A per-effect branch is the switch statement Constitution I calls a defect**, and it rots the
first time a ninth effect registers. This is why `EffectDescriptor` gained a field rather than the
editor gaining a table.

## 3. Adding

```text
apply({ kind: 'add-effect', id, type, phase, startMs, durationMs })
```

| Promise | Requirement |
|---|---|
| The new effect is immediately valid — phase, start, positive duration | FR-019 |
| It is immediately visible as a bar on the element's track | FR-019 |
| `durationMs` defaults to `DEFAULT_EFFECT_DURATION_MS` (400) | FR-019 |
| `order` is assigned so the new effect sorts last among equal starts | FR-022 |
| `id` comes from the session's `IdSource` — never `crypto.randomUUID()` directly | feature 005 |
| Refused on a locked element, with a reason | FR-016, BR-011 |
| Refused for an unknown type, with a reason | FR-018 |
| Refused in read-only mode, with a reason | FR-047 |

"Born valid" is the same promise `elements/defaults.ts` makes in feature 005, and it is what keeps
FR-041 true without the reducer having to repair anything.

**A default is not an invariant.** The new effect's `startMs` is clamped into the element's window
because that is where a teacher almost always means it; `set-effect` does **not** clamp, because an
effect starting after its element has gone is authorable and the timeline is required to say it
would never run (§6, edge case). Copying the clamp from the defaults into the reducer makes that
edge case unreachable, which is the likely mistake and the reason this is written down.

## 4. Configuring

```text
apply({ kind: 'set-effect', id, effectId, patch })
```

`patch` may carry `startMs`, `durationMs`, `phase`, `easing`, or `parameters`.

| Promise | Requirement |
|---|---|
| A duration of zero or less is refused **with a reason** | FR-023, BR-004 |
| A phase outside `descriptor.phases` is refused | FR-019 |
| Changing a parameter changes what the canvas renders at a moment inside the window | FR-020, SC-006 |
| `startMs` stays a non-negative integer | BR-001, BR-002 |
| Changing an effect's duration never changes the element's own timing | FR-021 |

FR-023's reason matters: `msDuration` is `positive()` because **zero is not "instant" — `appear`
is**. The refusal says so rather than reporting a schema path.

## 5. Removing

```text
apply({ kind: 'remove-effect', id, effectId })
```

The element keeps its own `startMs`/`endMs`; only the effect is gone (FR-021). Confirmed on the
same terms feature 005 set for delete — and the confirmation is expected to be **removed** when
ED-5 lands real undo, not kept beside it.

## 6. Ordering and determinism

| Promise | Requirement |
|---|---|
| Effects on one element run in chronological order | FR-022, US3 §5 |
| Two effects sharing a start time run in a deterministic, repeatable order | FR-022, US3 §6 |
| The order comes from `Effect.order`, which the resolver already honours | FR-TIM-014 |
| Two overlapping effects both render as bars | edge case |
| An effect starting after its element has gone is authorable, and the timeline says it would never run | edge case |

`Effect.order` is stored explicitly rather than inferred from array position — the schema's own
comment says why: array position would supply an order, but making it explicit means a resolver
bug cannot be masked by an incidental sort.

## 7. Reduced motion

The framework already computes the reduced alternative (BR-015): `descriptor.reduced` where
declared, the end state otherwise, substituted per effect rather than neutralised wholesale — Wave
3's decision, and the reason a slide-in becomes a fade rather than a blink.

**The editor adds effects; it does not add a second motion path** (FR-024). No reduced-motion
branch belongs anywhere in this feature. The test asserts that an effect authored here honours the
preference exactly as one from a hand-written manifest does.

`motion: false` with a `reduced` form is refused by the registry at module load — an effect that
does not move has nothing to reduce, so such a descriptor is describing something that cannot
happen. That check already exists; this feature must not weaken it.

## 8. Accessibility and refusal

| Promise | Requirement |
|---|---|
| Add, configure, and remove are keyboard-operable | FR-046, SC-009 |
| Every field and control has an accessible name | FR-046, SC-010 |
| axe reports zero violations on the effect controls | SC-010 |
| In read-only mode all three are unavailable and say why | FR-047 |
| Every path routes through `applyEdit` | FR-042 |

## 9. The outcome this contract is measured by

**SC-006**: all eight registered effects can be applied from the editor, and each one visibly
changes what the canvas renders at a moment within its window. Eight effects, eight assertions —
the shape of the `ELEMENT_TYPES` sweep feature 005 used to catch defaults that had been guessed
rather than read.
