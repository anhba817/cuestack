# Contract: `@cuestack/core` public API

**Date**: 2026-08-14 · **Feature**: `002-headless-kernel`

The kernel's public surface. Everything not listed here is internal.

## Entry point

One entry, `@cuestack/core`. Unlike `@cuestack/schema` there is no runtime-cost split to make:
every consumer of the kernel needs the kernel, and it has zero dependencies to shield anyone
from.

## Resolution

```ts
function resolve(
  slide: Slide,
  timeMs: number,
  context?: ResolveContext,
): RenderState
```

**Guarantees**

1. **Pure.** `resolve(s, t)` deep-equals `resolve(s, t)` for all `s` and `t`, in any order, any
   number of times. No clock, no randomness, no ambient state.
2. **No environment.** Runs with no `window`, `document`, or DOM of any kind.
3. **Total.** Never throws for a schema-valid slide, and returns a valid state for any finite
   `timeMs` including negative values and values past the slide's duration.
4. **Path-independent.** The state at time *t* is identical whether reached by playing or by
   seeking. This is the guarantee everything else in the framework rests on; SC-002 sweeps it
   over every state-change boundary in the corpus.
5. **Sorted.** `elements` arrives in paint order. Consumers must not re-sort.
6. **Input untouched.** The slide is not mutated and not retained.

`ResolveContext` carries the theme values and the registries. It is optional; omitting it uses
the default registries and an empty theme, which is what makes `resolve(slide, 0)` a one-liner
on a server.

**Not guaranteed**: reference stability between calls. Two calls with the same arguments return
equal but distinct objects. A consumer wanting memoisation should add it — the purity is what
makes that safe.

## Time and transport

```ts
function createTransport(lesson: LessonManifest, ports: Ports): Transport

interface Transport {
  readonly state: TransportState          // idle | playing | paused | completed
  readonly slideIndex: number
  readonly slideTimeMs: number
  readonly instanceId: string

  play(): TransportSnapshot
  pause(): TransportSnapshot
  seek(slideTimeMs: number): TransportSnapshot
  restart(): TransportSnapshot
  goToSlide(index: number): TransportSnapshot

  subscribe(listener: (snapshot: TransportSnapshot) => void): () => void
}
```

**Guarantees**

1. Every operation is synchronous and returns the resulting snapshot. A caller never has to
   guess whether it took effect.
2. `slideTimeMs` never decreases during continuous playback (FR-013).
3. A tick delta above the clamp ceiling does not become lesson time (FR-017) — machine sleep, a
   blocked main thread, and a paused debugger are treated identically, because none of them
   happened to the learner.
4. While the visibility port reports hidden, `slideTimeMs` does not advance; on returning it
   continues from the stored position, not from where wall-clock time has reached (FR-016).
5. `subscribe` returns its own unsubscribe. Listeners are called synchronously after the state
   they describe is already committed, so a listener always observes a consistent transport.

**Time source contract**: `ports.time()` MUST return monotonically non-decreasing milliseconds.
The kernel does not verify this — a source that goes backwards produces undefined behaviour, and
checking every tick would cost more than the bug is worth. Real adapters pass the browser's
high-resolution source; tests pass a counter.

## Advancement

```ts
function createAdvanceController(ports: Ports): AdvanceController

interface AdvanceController {
  evaluate(slide: Slide, transport: TransportSnapshot, signals: AdvanceSignals): AdvanceDecision | null
  reset(instanceId: string): void
}
```

**Guarantees**

1. At most one non-null decision per `instanceId`, however many conditions are satisfied and
   however many times `evaluate` is called (FR-019).
2. An incomplete required interaction suppresses a duration-based decision (FR-020, BR-005).
3. Paused controlling media postpones rather than cancels: a later `evaluate` with the media
   ended still decides (FR-021).
4. A decision names its `cause`. "Why did this advance early" is otherwise unanswerable from a
   bug report.
5. An unsatisfiable rule is reported through the resolved state's `blocked` field rather than by
   returning null forever (FR-023) — a learner staring at a stalled slide and a learner on a
   deliberately-manual slide look identical otherwise.

`evaluate` is a query, not a command: it decides nothing about *doing* the advance. The consumer
applies it via `goToSlide`. Splitting them is what lets a test assert the decision without a
transport, and lets the editor preview show "would advance now" without advancing.

## Registries

```ts
function createElementRegistry(plugins?: ElementPlugin[]): ElementRegistry
function createEffectRegistry(descriptors?: EffectDescriptor[]): EffectRegistry

const builtinEffects: readonly EffectDescriptor[]   // the eight MVP effects
```

See [`plugin-contract.md`](./plugin-contract.md).

**Guarantee**: registration is refused, with the missing member named, unless the contract is
complete (FR-026). The type system catches this at compile time for typed plugins; the runtime
check exists for plugins arriving as data.

## Adapters

See [`host-adapters.md`](./host-adapters.md).

```ts
const memoryAdapters: Ports   // complete in-memory reference (FR-032)
```

## What the kernel will never do

Stated because the absences are load-bearing, not oversights:

- **Touch the DOM.** No `window`, `document`, `performance`, or `requestAnimationFrame`
  anywhere in the package. Enforced by lint, not convention.
- **Read a clock.** Time arrives through `ports.time`.
- **Render.** `resolve` returns data. Turning it into pixels is the adapter's job, and keeping
  that line sharp is what allows more than one adapter to exist.
- **Validate a manifest.** The kernel assumes `@cuestack/schema` already accepted it. Handing it
  malformed input is a programming error, not a runtime case.
- **Decide about reduced motion.** It reports which effects are motion (R-09) and stops there.
  The preference is unreadable on a server and the substitution is a stylesheet concern.

## Stability

`resolve`'s signature and `RenderState`'s shape are the load-bearing parts of this contract:
Wave 2's renderer, Wave 4's editor, and the parity harness all read them. Adding an optional
field to `RenderState` is a minor change. Changing the meaning of an existing one is major, and
would invalidate every stored parity fixture — which is the cost that should make it rare.
