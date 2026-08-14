import type { ElementRenderer } from '../registry.js'
import { textRenderer } from './TextElement.js'
import { shapeRenderer } from './ShapeElement.js'
import { imageRenderer } from './ImageElement.js'
import { videoRenderer } from './VideoElement.js'
import { audioRenderer } from './AudioElement.js'
import { buttonRenderer } from './ButtonElement.js'
import { questionRenderer } from './QuestionElement.js'

/**
 * The built-in seven, matching the format's element types exactly.
 *
 * The order is the registration order and carries no meaning — paint order comes from the
 * kernel, per element, and nothing here may re-decide it.
 */
export const builtinRenderers: readonly ElementRenderer[] = [
  textRenderer,
  imageRenderer,
  shapeRenderer,
  videoRenderer,
  audioRenderer,
  buttonRenderer,
  questionRenderer,
]

export {
  textRenderer,
  shapeRenderer,
  imageRenderer,
  videoRenderer,
  audioRenderer,
  buttonRenderer,
  questionRenderer,
}
