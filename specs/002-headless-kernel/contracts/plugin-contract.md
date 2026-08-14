# Contract: element and effect plugins

**Date**: 2026-08-14 · **Feature**: `002-headless-kernel`

What an extension author must supply, and what the framework promises in return. This is the
contract Constitution I's "registry, not switch statement" rule exists to protect.

## ElementPlugin

```ts
interface ElementPlugin<TPayload = unknown> {
  readonly type: string
  readonly schema: PayloadSchema<TPayload>
  resolve(input: ElementResolveInput<TPayload>): ElementContribution
  readonly inspector: InspectorSpec
  validate(payload: TPayload): PluginIssue[]
}
```

All five members are required. A partial object does not satisfy the type, so an incomplete
plugin fails to compile — the runtime check exists only for plugins arriving as untyped data.

The reason all five are mandatory rather than optional-with-defaults: a plugin missing its
`inspector` is invisible in the editor, and one missing `validate` passes publication checks it
should fail. Both are discovered two waves after the omission, by a teacher.

### What a plugin receives

```ts
interface ElementResolveInput<TPayload> {
  readonly payload: TPayload          // its own element's content
  readonly geometry: Geometry         // authored position and size
  readonly slideTimeMs: number        // current time within the slide
  readonly theme: ThemeValues         // resolved theme tokens
}
```

That is the complete list. **A plugin never receives the lesson, the slide, its sibling
elements, the transport, or anything describing the learner** (FR-029). This is enforced by the
signature rather than by documentation: there is nowhere to reach for the data.

The restriction is not about trust — most plugins will be first-party. It is that a plugin able
to read the whole lesson becomes a plugin that *does*, and then the lesson shape cannot change
without breaking third-party code.

### What a plugin returns

```ts
interface ElementContribution {
  readonly visible: boolean
  readonly contribution?: Contribution   // optional visual delta, composed like an effect's
  readonly problems?: PluginIssue[]
}
```

A plugin decides its own visibility beyond the timing window — a question element with no
options might report itself invisible. It cannot decide *another* element's visibility.

## EffectDescriptor

```ts
interface EffectDescriptor {
  readonly type: string
  readonly phases: readonly EffectPhase[]
  readonly motion: boolean
  at(progress: number, params?: EffectParams): Contribution
  readonly defaultEasing: string
}
```

`at` must be pure and must be defined for every `progress` in `[0, 1]` inclusive. It receives
already-eased progress, so an effect never implements easing itself — that is what keeps easing
authorable per-effect without every effect reimplementing it.

`motion` is what lets a consumer honour reduced-motion without keeping its own list of which
effects move — a list that would silently rot the first time a ninth effect is registered
(R-09).

### Composition rules an effect must respect

Contributions compose associatively and commutatively within a phase: opacities and scales
multiply, translations and rotations sum (R-02). An effect whose correctness depends on running
before or after another effect **cannot be expressed** in this contract. The MVP set contains no
such effect. If one is ever needed, the contract grows an ordered transform list — a breaking
change, deliberately, so that it is a decision rather than a drift.

## What the framework promises the plugin author

1. **Your type participates identically to a built-in one.** Timing, layering, and effect
   composition treat registered and built-in types the same. There is no privileged set.
2. **Your `resolve` is called with the same purity contract the kernel holds itself to** — same
   inputs, same output, no clock, no randomness. The kernel's determinism guarantee extends
   through your code, which is why the purity requirement is on you too.
3. **An unregistered optional type degrades rather than failing the slide** (FR-027), so shipping
   a lesson that uses your plugin to a host that lacks it loses your element, not the lesson.
4. **A required interaction type is the exception**: if it is missing, the slide reports blocked
   (FR-028). A silently-skipped question that gates progression strands the learner, which is not
   comparable to losing a decorative element.

## Versioning

A plugin declares the schema version and kernel version it targets. A plugin built against a
kernel whose `RenderState` shape has since changed incompatibly is refused at registration with
both versions named — better than the subtle misbehaviour of a stale contribution shape being
composed into a state that no longer means the same thing.
