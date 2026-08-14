# Contract: reduced motion

**Date**: 2026-08-15 · **Feature**: `004-player-completion`

How an effect declares what it becomes when a learner has asked for less motion, and why the
decision is made by a stylesheet rather than by code.

## The constraint that decides everything else

**FR-028: the preference is honoured on the first rendered frame, before any script runs.**

That frame is produced by a server which cannot read `prefers-reduced-motion`. So the choice
cannot be made in JavaScript, on either side — not on the server, which has no answer, and not on
the client, which arrives too late. It must be made by CSS at paint time, and therefore **both
answers must already be in the markup**.

Everything below follows from that one sentence.

## The descriptor gains one member

```ts
interface EffectDescriptor {
  readonly type: string
  readonly phases: readonly EffectPhase[]
  readonly motion: boolean
  at(progress: number, params?: EffectParams): Contribution
  readonly defaultEasing: string

  // Added in this feature.
  reduced?(progress: number, params?: EffectParams): Contribution
}
```

`reduced` is optional and means: *what this effect contributes instead, when motion is reduced*.

- An effect with `motion: false` declares nothing. There is nothing to reduce.
- An effect with `motion: true` and no `reduced` falls back to its end state — the element simply
  appears. That is Wave 2's behaviour, kept as the floor for an effect whose author has not thought
  about it.
- An effect with `reduced` gets the substitution BR-015 actually asks for: a slide-in becomes a
  fade, not an instant appearance.

**Why on the descriptor.** Only the effect knows what its reduced form is. A substitution table
held by a consumer would be "a list that rots the first time a ninth effect is registered" —
feature 002's research R-09 said that about the `motion` flag, and it is truer of substitutions,
which carry more information than a boolean.

## What `resolve()` emits

Each element gains a second composed visual **only when at least one active effect declares
motion**:

```ts
interface ResolvedElement {
  // …unchanged…
  readonly opacity: number
  readonly transform: TransformDelta
  readonly filter: FilterDelta | null

  // Added. null when no active effect moves — the common case.
  readonly reduced: {
    readonly opacity: number
    readonly transform: TransformDelta
    readonly filter: FilterDelta | null
  } | null
}
```

Both are pure functions of `(slide, timeMs)`. The resolver does not know the preference, does not
branch on it, and returns the same pair of answers every time — which is what keeps SC-009's parity
sweep meaningful, since it can compare both.

## What the renderer emits

The frame writer writes the second set under mirrored property names:

| Normal | Reduced |
|---|---|
| `--cs-opacity` | `--cs-r-opacity` |
| `--cs-tx`, `--cs-ty` | `--cs-r-tx`, `--cs-r-ty` |
| `--cs-sx`, `--cs-sy` | `--cs-r-sx`, `--cs-r-sy` |
| `--cs-rotate` | `--cs-r-rotate` |
| `--cs-brightness`, `--cs-blur` | `--cs-r-brightness`, `--cs-r-blur` |

And the stylesheet chooses, replacing Wave 2's blunt neutralisation:

```css
@media (prefers-reduced-motion: reduce) {
  .cs-element {
    --cs-opacity: var(--cs-r-opacity, var(--cs-opacity, 1));
    --cs-tx: var(--cs-r-tx, 0);
    /* …and so on… */
  }
}
```

The nested fallback is the whole mechanism: where a reduced value was emitted it wins; where none
was, the element falls back to no motion, which is the Wave 2 floor. An element with no active
effect emits neither set and is unaffected by the block entirely.

## Obligations on a substitution

An effect's `reduced` MUST:

- **Preserve timing.** It receives the same eased `progress` and must reach its end state at the
  same moment (FR-026). A substitution that finished early would change when content appears,
  which is the meaning the learner is entitled to keep.
- **Preserve information** (FR-027). If the original motion conveyed direction — an arrow sliding
  in from the left to indicate flow — the substitution must convey it some other way or the author
  must be told it cannot. Reducing motion is not permission to remove meaning.
- **Never hide the element.** A reduced form whose opacity ends at zero, or which leaves the element
  outside the stage, has made content unreachable — worse than the motion it replaced.
- **Be pure.** Same contract as `at`. It is called from the resolver, on the server, per frame.

## The built-in substitutions

| Effect | Moves? | Reduced form |
|---|---|---|
| `fade` | no | — (nothing to reduce) |
| `slide` | yes | Fade over the same interval |
| `zoom` | yes | Fade over the same interval |
| `pulse` | yes | No change — a static emphasis for the same interval |
| `highlight` / filter effects | no | — |

Slide transitions between slides take the same treatment: `slide` and `zoom` transitions become
`fade`, and `fade` is unchanged (FR-025, US4 #4). A transition is **replaced, not shortened** —
shortening still moves, and a learner who asked for no motion did not ask for briefer motion.

## What this does not cover

The preference is read from the platform only; there is no in-lesson toggle (spec Assumptions). A
learner has already stated this at the system level, and asking again is worse than honouring it.

A preference that changes mid-lesson is handled for free and worth noting why: because the choice
lives in a media query, the browser re-evaluates it and the next painted frame is correct. Nothing
re-renders, nothing restarts, and the learner does not lose their place (US4 #6). That is the
second time the custom-property indirection has paid for something nobody designed it for.
