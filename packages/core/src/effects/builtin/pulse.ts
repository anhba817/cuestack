import type { EffectDescriptor, EffectParams } from '../registry.js'

/**
 * One scale-up-and-back over the effect's duration.
 *
 * A single cycle rather than a repeating one: repetition is authorable by placing
 * two pulses, whereas a built-in loop count would need the effect to know how long
 * it has been running — state the fold deliberately does not have.
 */
export const pulse: EffectDescriptor = {
  type: 'pulse',
  phases: ['emphasis'],
  motion: true,
  defaultEasing: 'ease-in-out',
  at(progress, params: EffectParams | undefined) {
    const amount = typeof params?.['amount'] === 'number' ? params['amount'] : 0.08
    // Triangle wave: 0 -> 1 -> 0 across the duration.
    const swell = progress < 0.5 ? progress * 2 : (1 - progress) * 2
    const factor = 1 + amount * swell
    return { scale: { x: factor, y: factor } }
  },
}
