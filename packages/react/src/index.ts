/**
 * @cuestack/react — client entry.
 *
 * Exports the same names as the server entry, by design. Playback (the frame loop, the
 * transport, the controls) is added here in US2; until then the two entries differ only
 * in which condition resolves them, which is exactly what the example app verifies.
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
