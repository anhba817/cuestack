import { LessonElement } from './LessonElement.js'

/**
 * `@cuestack/element` — the web-component adapter.
 *
 * DX-2, and the thing it proves: the kernel is framework-agnostic rather than React-shaped. It plays
 * a lesson with no UI framework present, over the same `resolve`, the same clock, the same advance
 * rule, and the same effects the React player uses.
 *
 * **It is a proof, not a second player.** Media and interactions are out of scope, and four of the
 * seven element types report themselves unavailable. A host needing a complete player wants
 * `@cuestack/react`. See the README, which says the same thing at more length, because a host who
 * reads only one of the three places this is written is the one it is written for.
 *
 * This replaces `ELEMENT_WAVE`, the constant that stood in for this package from Wave 0 and whose
 * comment said a later wave would fill it.
 */
export { LessonElement } from './LessonElement.js'
export { COVERED, NOT_COVERED, covers, type CoveredType } from './covered.js'
export type { AssetResolver } from './renderers.js'

if (typeof customElements !== 'undefined' && !customElements.get('cuestack-lesson')) {
  customElements.define('cuestack-lesson', LessonElement)
}
