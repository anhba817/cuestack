import type { Contribution } from '../resolve/contribution.js'
import type { InspectorField } from '../elements/contract.js'

export type EffectPhase = 'enter' | 'emphasis' | 'exit'

export interface EffectParams {
  readonly [key: string]: string | number | boolean | undefined
}

export interface EffectDescriptor {
  readonly type: string
  readonly phases: readonly EffectPhase[]
  /**
   * Whether this effect moves things. The kernel reports it and takes no action:
   * the reduced-motion preference cannot be read on a server and the substitution
   * is a stylesheet concern, so the decision belongs to the consumer (research
   * R-09). What this removes is the need for every consumer to keep its own list
   * of which effects move — a list that would rot the first time a ninth effect
   * is registered.
   */
  readonly motion: boolean
  /**
   * Receives already-eased progress in [0, 1], so no effect implements easing.
   * Must be pure.
   */
  at(progress: number, params?: EffectParams): Contribution
  /**
   * What this effect contributes instead, when motion is reduced (BR-015).
   *
   * Optional, and the option is meaningful three ways. An effect with `motion: false`
   * declares nothing — there is nothing to reduce. A moving effect with no `reduced` falls
   * back to its end state, which is Wave 2's blunt floor and stays the floor for an effect
   * whose author has not thought about it. A moving effect that declares one gets the
   * substitution BR-015 actually asks for: a slide-in becomes a fade rather than an
   * instantaneous appearance.
   *
   * Same contract as `at`: pure, given already-eased progress, called on a server per frame.
   * It must reach its end state at the same moment (FR-026) and must not hide the element or
   * move it out of the stage (FR-027).
   */
  reduced?(progress: number, params?: EffectParams): Contribution
  readonly defaultEasing: string
  /**
   * Which parameters this effect accepts, so a consumer can offer them.
   *
   * Added in feature 006. Every built-in already read an untyped bag with a default inlined
   * in its own `at()` — `pulse` reads `amount`, `slide` reads `from` and `distance` — and
   * nothing declared any of it, so an editor could offer nothing. The alternative was a
   * parameter table held by the editor, which is a per-effect branch by another name and
   * rots the first time a ninth effect registers (Constitution I).
   *
   * `InspectorField` rather than a new shape: effect parameters are the problem the element
   * inspector already solved, and sharing the type means one set of field components renders
   * both. **One difference, and it is load-bearing.** On an element a `key` is a dotted path
   * from the element root (`payload.text`); here it is a *flat* key into `effect.parameters`
   * (`amount`). A consumer must never run a dotted read against one of these.
   *
   * A declaration of what *may* be set — not a source of defaults. `at()` keeps its inlined
   * ones because it is called per frame on a server, where `parameters` may be absent.
   *
   * Authoring metadata: serialized into no manifest, read on no playback path. Additive, so
   * no `schemaVersion` implication.
   */
  readonly parameters?: readonly InspectorField[]
}

export interface EffectRegistry {
  get(type: string): EffectDescriptor | undefined
  has(type: string): boolean
  register(descriptor: EffectDescriptor): void
  types(): readonly string[]
}

const REQUIRED: ReadonlyArray<keyof EffectDescriptor> = [
  'type',
  'phases',
  'motion',
  'at',
  'defaultEasing',
]

function assertComplete(descriptor: EffectDescriptor): void {
  /**
   * A reduced form on an effect that does not move would never be consulted — the stylesheet
   * only selects it where motion is being replaced. A descriptor carrying one is describing
   * something that cannot happen, which almost always means `motion` was meant to be true.
   */
  if (descriptor?.reduced !== undefined && descriptor.motion !== true) {
    throw new Error(
      `Effect "${descriptor.type}" declares a reduced form but sets motion: false. ` +
        'A reduced alternative is only ever consulted for an effect that moves, so this one ' +
        'would be dead. Did you mean motion: true?',
    )
  }

  const missing = REQUIRED.filter((key) => descriptor?.[key] === undefined)
  if (missing.length > 0) {
    throw new Error(
      `Effect registration incomplete: missing ${missing.join(', ')}. ` +
        'An effect descriptor must supply its full contract; a partial one fails ' +
        'silently at resolve time instead, which is worse.',
    )
  }
}

export function createEffectRegistry(descriptors: readonly EffectDescriptor[] = []): EffectRegistry {
  const map = new Map<string, EffectDescriptor>()
  for (const d of descriptors) {
    assertComplete(d)
    map.set(d.type, d)
  }
  return {
    get: (type) => map.get(type),
    has: (type) => map.has(type),
    register(descriptor) {
      assertComplete(descriptor)
      map.set(descriptor.type, descriptor)
    },
    types: () => [...map.keys()].sort(),
  }
}
