import type { EffectDescriptor } from '../registry.js'
import { appear, disappear, fade } from './opacity.js'
import { slide, zoom } from './transform.js'
import { pulse } from './pulse.js'
import { dim, highlight } from './filter.js'

/** FR-TIM-011's MVP set. Eight small pure functions with no knowledge of each
 *  other — the precondition for a ninth arriving as a registration. */
export const builtinEffects: readonly EffectDescriptor[] = [
  appear,
  fade,
  slide,
  zoom,
  pulse,
  highlight,
  dim,
  disappear,
]

export { appear, fade, disappear, slide, zoom, pulse, highlight, dim }
