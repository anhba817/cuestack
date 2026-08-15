import type { ElementRenderer } from '../registry.js'
import { textRenderer } from './TextElement.js'
import { shapeRenderer } from './ShapeElement.js'
import { imageRenderer } from './ImageElement.js'
import { videoRenderer } from './VideoElement.js'
import { audioRenderer } from './AudioElement.js'
import { buttonRenderer } from './ButtonElement.js'
import { staticQuestionRenderer } from './QuestionElementStatic.js'

/**
 * The renderers a **server** render uses.
 *
 * Identical to the client set but for the question, which is static here because an
 * interactive one needs state and an event handler and a React Server Component may have
 * neither.
 *
 * This module deliberately does not import `QuestionElement.tsx`. The server-path check in
 * `test/ssr/no-hooks.test.ts` walks the import graph from `server.ts`, so a barrel that
 * re-exported both would drag the hook-using renderer back onto the server path and the
 * check would fail — correctly, because a module graph that reaches a hook is a module graph
 * that can execute one.
 */
export const staticRenderers: readonly ElementRenderer[] = [
  textRenderer,
  imageRenderer,
  shapeRenderer,
  videoRenderer,
  audioRenderer,
  buttonRenderer,
  staticQuestionRenderer,
]

/**
 * The individual renderers are re-exported here as well, so `server.ts` can take its whole
 * surface from this module. Importing the other six from `./index.js` would pull that barrel
 * — and with it the hook-using question renderer — back onto the server path, which is what a
 * first attempt did and what the no-hooks check caught.
 */
export {
  staticQuestionRenderer,
  textRenderer,
  shapeRenderer,
  imageRenderer,
  videoRenderer,
  audioRenderer,
  buttonRenderer,
}
