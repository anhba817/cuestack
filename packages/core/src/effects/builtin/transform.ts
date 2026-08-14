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
}

export const zoom: EffectDescriptor = {
  type: 'zoom',
  phases: ['enter', 'exit'],
  motion: true,
  defaultEasing: 'ease-out',
  at(progress, params) {
    const from = num(params, 'from', 0.92)
    const factor = from + (1 - from) * progress
    return { scale: { x: factor, y: factor }, opacity: progress }
  },
}
