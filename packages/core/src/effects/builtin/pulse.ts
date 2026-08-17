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
  /** How far it swells at the peak of the triangle. Defaults to 0.08 — a nudge, not a leap. */
  parameters: [{ key: 'amount', label: 'Amount', kind: 'number' }],
  at(progress, params: EffectParams | undefined) {
    const amount = typeof params?.['amount'] === 'number' ? params['amount'] : 0.08
    // Triangle wave: 0 -> 1 -> 0 across the duration.
    const swell = progress < 0.5 ? progress * 2 : (1 - progress) * 2
    const factor = 1 + amount * swell
    return { scale: { x: factor, y: factor } }
  },
  /**
   * Nothing at all — a static emphasis for the same interval.
   *
   * A pulse draws attention *by* moving, so there is no reduced movement to offer; fading it
   * would be a different effect, and dimming it would make the element it is emphasising
   * harder to read. The element stays exactly as authored, which loses the emphasis and
   * loses nothing else. An author who needs the emphasis to survive reduced motion should
   * use a highlight, which is a filter and does not move.
   */
  reduced() {
    return {}
  },
}
