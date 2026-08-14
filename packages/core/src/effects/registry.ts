import type { Contribution } from '../resolve/contribution.js'

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
  readonly defaultEasing: string
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
