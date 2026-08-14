import type { EffectDescriptor } from '../registry.js'

/** `appear` is the instant effect — which is why a zero duration is rejected by
 *  the schema rather than treated as instant. */
export const appear: EffectDescriptor = {
  type: 'appear',
  phases: ['enter'],
  motion: false,
  defaultEasing: 'step',
  at: (progress) => ({ opacity: progress < 1 ? 0 : 1 }),
}

export const fade: EffectDescriptor = {
  type: 'fade',
  phases: ['enter', 'emphasis', 'exit'],
  motion: false,
  defaultEasing: 'ease-out',
  at: (progress) => ({ opacity: progress }),
}

export const disappear: EffectDescriptor = {
  type: 'disappear',
  phases: ['exit'],
  motion: false,
  defaultEasing: 'linear',
  at: (progress) => ({ opacity: 1 - progress }),
}
