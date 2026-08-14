import type { ElementRenderer } from '../registry.js'
import { textRenderer } from './TextElement.js'
import { shapeRenderer } from './ShapeElement.js'

/**
 * The renderers that exist so far. The remaining five — image, video, audio, button,
 * question — arrive with US4; the reference lesson's first slide needs only these two,
 * which is what makes the server-rendered frame demonstrable before the rest exist.
 */
export const builtinRenderers: readonly ElementRenderer[] = [textRenderer, shapeRenderer]

export { textRenderer, shapeRenderer }
