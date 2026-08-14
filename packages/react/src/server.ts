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
export { LessonPlayer } from './player/LessonPlayer.js'
export type { LessonPlayerProps } from './player/LessonPlayer.js'
export { Stage } from './player/Stage.js'
export { SlideView } from './player/SlideView.js'
export { ElementFrame } from './player/ElementFrame.js'
export { createRendererRegistry } from './elements/registry.js'
export type { ElementRenderer, ElementRendererProps, ElementRendererRegistry } from './elements/registry.js'
export { builtinRenderers, textRenderer, shapeRenderer } from './elements/builtin/index.js'
export { Placeholder } from './elements/Placeholder.js'
export { stageProperties, canvasFor } from './theme/tokens.js'
export type { ThemeValues } from './theme/tokens.js'
export { elementProperties, geometryProperties, visualProperties } from './frame/applyVisual.js'
export * from './frame/properties.js'
