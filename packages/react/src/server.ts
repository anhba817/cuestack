/**
 * @cuestack/react — server entry, selected by the `react-server` condition.
 *
 * Exports the same names as the client entry. Feature 001 learned why that matters:
 * when the two surfaces diverged, the server entry's exports were invisible to
 * TypeScript and the type layer could not see them.
 *
 * What differs is behaviour, not shape — nothing here starts a clock, subscribes, or
 * touches a DOM, so this module renders in a Node process with no browser.
 */
export { LessonPlayerStatic as LessonPlayer } from './player/LessonPlayerStatic.js'
export type { LessonPlayerStaticProps as LessonPlayerProps } from './player/LessonPlayerStatic.js'
/**
 * Also under its own name, matching the client entry.
 *
 * The client entry exported both `LessonPlayer` and `LessonPlayerStatic`; this one exported
 * only the alias — so the static player was unreachable by name from the very context it
 * exists for, and a Server Component asking for it by name failed to build. Feature 001's
 * lesson exactly: when the two surfaces diverge, the divergence is invisible until something
 * that should work does not.
 */
export { LessonPlayerStatic } from './player/LessonPlayerStatic.js'
export type { LessonPlayerStaticProps } from './player/LessonPlayerStatic.js'
export { Stage } from './player/Stage.js'
export { SlideView } from './player/SlideView.js'
export { ElementFrame } from './player/ElementFrame.js'
export { createRendererRegistry } from './elements/registry.js'
export type { ElementRenderer, ElementRendererProps, ElementRendererRegistry } from './elements/registry.js'
/**
 * The same names as the client entry, with the server's implementations — the pattern
 * `LessonPlayer` already follows. `builtinRenderers` here carries a static question, because
 * an interactive one cannot be a Server Component.
 */
export {
  staticRenderers as builtinRenderers,
  staticRenderers,
  staticQuestionRenderer as questionRenderer,
  staticQuestionRenderer,
  textRenderer,
  shapeRenderer,
  imageRenderer,
  videoRenderer,
  audioRenderer,
  buttonRenderer,
} from './elements/builtin/static.js'
export { Placeholder } from './elements/Placeholder.js'
export { AssetFallback } from './elements/AssetFallback.js'
export type { AssetFallbackProps } from './elements/AssetFallback.js'
export { defaultAssetResolver } from './elements/assets.js'
export type { AssetResolver } from './elements/assets.js'
export { stageProperties, canvasFor } from './theme/tokens.js'
export type { ThemeValues } from './theme/tokens.js'
export { elementProperties, geometryProperties, visualProperties } from './frame/applyVisual.js'
export * from './frame/properties.js'
