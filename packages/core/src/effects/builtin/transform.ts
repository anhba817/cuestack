import type { EffectDescriptor, EffectParams } from '../registry.js'

/**
 * Normalise -0 to 0.
 *
 * Negating a zero offset yields -0, which serialises as 0 but fails a deep-equal
 * against +0. Wave 2's parity harness compares render states across server and
 * client, so a stray -0 would surface there as a divergence with no visible cause.
 */
const zero = (n: number): number => (n === 0 ? 0 : n)

const num = (params: EffectParams | undefined, key: string, fallback: number): number => {
  const value = params?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Travels in from a direction, arriving at the authored position. */
export const slide: EffectDescriptor = {
  type: 'slide',
  phases: ['enter', 'exit'],
  motion: true,
  defaultEasing: 'ease-out',
  /**
   * `from` is a *direction*. `zoom` below also declares `from` and means a *number* — the
   * scale it starts at. One key, two types, in two effects a teacher picks between in the
   * same menu, which is why parameters are declared per descriptor rather than in one table.
   */
  parameters: [
    { key: 'from', label: 'From', kind: 'select', options: ['top', 'bottom', 'left', 'right'] },
    { key: 'distance', label: 'Distance', kind: 'number' },
  ],
  at(progress, params) {
    const distance = num(params, 'distance', 64)
    const remaining = 1 - progress
    const from = typeof params?.['from'] === 'string' ? params['from'] : 'bottom'
    const offset = distance * remaining
    const translate =
      from === 'top'
        ? { x: 0, y: zero(-offset) }
        : from === 'left'
          ? { x: zero(-offset), y: 0 }
          : from === 'right'
            ? { x: zero(offset), y: 0 }
            : { x: 0, y: zero(offset) }
    return { translate, opacity: progress }
  },
  /**
   * A fade over the same interval.
   *
   * Not an instant appearance, which is what Wave 2's blunt neutralisation produced: with
   * the translation zeroed, a slide-in contributed only its opacity ramp, and an author who
   * had relied on the movement to draw the eye got nothing. A cross-fade is still a
   * transition — it is the movement that is removed, not the arrival.
   */
  reduced(progress) {
    return { opacity: progress }
  },
}

export const zoom: EffectDescriptor = {
  type: 'zoom',
  phases: ['enter', 'exit'],
  motion: true,
  defaultEasing: 'ease-out',
  /** A number, not a direction — see the note on `slide`. Below 1 it grows in. */
  parameters: [{ key: 'from', label: 'Starting scale', kind: 'number' }],
  at(progress, params) {
    const from = num(params, 'from', 0.92)
    const factor = from + (1 - from) * progress
    return { scale: { x: factor, y: factor }, opacity: progress }
  },
  /** A fade over the same interval, for the same reason as `slide`. */
  reduced(progress) {
    return { opacity: progress }
  },
}
