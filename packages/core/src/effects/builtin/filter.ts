import type { EffectDescriptor, EffectParams } from '../registry.js'

const amountOf = (params: EffectParams | undefined, fallback: number): number =>
  typeof params?.['amount'] === 'number' ? params['amount'] : fallback

/** Brightens to draw the eye. Not motion — safe under reduced-motion. */
export const highlight: EffectDescriptor = {
  type: 'highlight',
  phases: ['emphasis'],
  motion: false,
  defaultEasing: 'ease-in-out',
  at(progress, params) {
    const peak = amountOf(params, 0.4)
    const swell = progress < 0.5 ? progress * 2 : (1 - progress) * 2
    return { brightness: 1 + peak * swell }
  },
}

/** Recedes so something else can lead. Also not motion. */
export const dim: EffectDescriptor = {
  type: 'dim',
  phases: ['emphasis'],
  motion: false,
  defaultEasing: 'ease-in-out',
  at(progress, params) {
    const depth = amountOf(params, 0.5)
    return { brightness: 1 - depth * progress, opacity: 1 - depth * 0.4 * progress }
  },
}
