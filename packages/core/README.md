# @cuestack/core

The headless kernel. Computes what a slide looks like at a given time; renders
nothing, reads no clock, touches no DOM. Zero runtime dependencies beyond
`@cuestack/schema`, whose types are erased at compile time.

## resolve

```ts
import { resolve } from '@cuestack/core'

const state = resolve(slide, 2500)
// state.elements — visible elements, already in paint order
// state.problems — non-fatal findings, e.g. content past the slide's end
// state.blocked  — set when the slide cannot meaningfully be played
```

`resolve` is a **fold, not a state machine**. Every effect active at the given time
is evaluated and the results composed; nothing accumulates between calls. That one
property is why:

- **Seeking is correct.** There is no replay path — a time is just an argument.
- **Server rendering works.** `resolve(slide, 0)` needs no browser and no clock.
- **Preview and playback cannot diverge.** One function, no memory, so arriving by
  a different route cannot produce a different answer. Proven by a sweep over
  every state-change boundary in the test corpus.

`elements` arrives pre-sorted. Do not re-sort it: two consumers sorting
independently is two chances to sort differently.

`transform` is kept separate from `geometry`. An element translated 40px by a
slide-in is still *authored* where it was — the editor needs the authored value,
the player needs the effective one, and collapsing them loses that distinction
irrecoverably.

## Transport

```ts
const transport = createTransport(lesson, ports)
transport.play()
transport.seek(4000)      // returns the resulting snapshot, synchronously
transport.subscribe((snapshot) => { /* already committed when called */ })
```

Lesson time accumulates from an injected source and is clamped at 250ms per tick.
A larger gap is treated as time that did not happen in the lesson — which covers
machine sleep, a blocked main thread, and a paused debugger identically. While the
host document is hidden, time does not advance at all.

## Advancement

```ts
const controller = createAdvanceController(ports)
const decision = controller.evaluate(slide, transport, signals)
if (decision) transport.goToSlide(transport.slideIndex + 1)
```

`evaluate` is a **query, not a command**: it decides nothing about performing the
advance. That lets a test assert the decision without a transport, and lets an
editor show "would advance now" without advancing.

A slide instance advances at most once. The guard keys on *instance*, not slide id,
so a learner navigating backward can replay a slide and advance again.

`controller.reachability(slide)` reports a rule that can never be satisfied — a
failed video, a required question that disappears before the slide ends. Without
it, a stalled slide and a deliberately-manual slide look identical.

## Registries

New element and effect types are added by registration; the resolution path
contains no knowledge of any specific type, and a lint rule forbids dispatching on
a type discriminant outside a registry.

```ts
const elements = createElementRegistry([myPlugin])
const effects = createEffectRegistry([...builtinEffects, myEffect])
resolve(slide, t, { elements, effects, theme })
```

A plugin must supply its full contract — schema, resolve, inspector, validate, and
the `RenderState` version it targets — or registration is refused with the missing
member named. A plugin receives **only** its own payload, geometry, the slide time,
and the theme. Never the lesson, its siblings, the transport, or anything about the
learner.

### An effect declares its parameters

`EffectDescriptor.parameters` is a list of `InspectorField`, so a consumer can offer
what an effect accepts rather than keeping a table of its own — which would be a
per-effect branch by another name and would rot the first time a ninth effect
registered.

```ts
export const shimmer: EffectDescriptor = {
  type: 'shimmer',
  phases: ['emphasis'],
  motion: false,
  defaultEasing: 'linear',
  parameters: [{ key: 'intensity', label: 'Intensity', kind: 'number' }],
  at: (progress, params) => ({ opacity: 1 - (Number(params?.intensity) || 0.5) * progress }),
}
```

**One difference from an element's inspector fields, and it is load-bearing.** On an
element a `key` is a *dotted path* from the element root (`payload.text`); on an
effect it is a *flat key* into `effect.parameters` (`intensity`). Sharing the type
must not become sharing the read.

The declaration says what *may* be set — it is not a source of defaults. `at()` keeps
its own, because it is called per frame on a server where `parameters` may be absent.

**Whichever registry the editor offers from must be the one `resolve` uses.** A
registry reaching a menu but not `ResolveContext.effects` produces an effect a teacher
can add and the resolver reports as `UNKNOWN_EFFECT_TYPE`.

An unregistered *optional* type degrades to a placeholder and the slide still
resolves. An unregistered *required interaction* type blocks. The asymmetry is
deliberate: losing a decoration costs some content, while silently skipping a
question that gates progression strands the learner.

## Ports the host must supply

The complete list of things the kernel cannot do itself:

| Port | Direction | Supplies |
|---|---|---|
| `time` | read | monotonic milliseconds |
| `media` | read only | position, duration, ended, paused, failed |
| `visibility` | read + subscribe | whether the document is hidden |
| `storage` | read/write | lesson load and save, with a conflict token |
| `assets` | read | asset id to location |
| `analytics` | write | event recording |

`memoryAdapters()` implements the last three so the framework works with no host
code at all. Its storage issues real tokens and genuinely rejects stale saves, so
the conflict path is exercised by default rather than only by the first real host.

## What this package will never do

Render, read a clock, touch the DOM, validate a manifest, or decide about reduced
motion. It reports which effects are motion and stops there — the preference cannot
be read on a server and the substitution is a stylesheet concern.
