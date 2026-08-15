/**
 * @cuestack/react — client entry.
 *
 * Exports the same names as the server entry, by design. Playback (the frame loop, the
 * transport, the controls) is added here in US2; until then the two entries differ only
 * in which condition resolves them, which is exactly what the example app verifies.
 */
export { LessonPlayerClient as LessonPlayer } from './player/LessonPlayerClient.js'
export type { LessonPlayerClientProps as LessonPlayerProps } from './player/LessonPlayerClient.js'
export { LessonPlayerStatic } from './player/LessonPlayerStatic.js'
export type { LessonPlayerStaticProps } from './player/LessonPlayerStatic.js'
export { Stage } from './player/Stage.js'
export { SlideView } from './player/SlideView.js'
export { ElementFrame } from './player/ElementFrame.js'
export { createRendererRegistry } from './elements/registry.js'
export type { ElementRenderer, ElementRendererProps, ElementRendererRegistry } from './elements/registry.js'
export {
  builtinRenderers,
  textRenderer,
  shapeRenderer,
  imageRenderer,
  videoRenderer,
  audioRenderer,
  buttonRenderer,
  questionRenderer,
} from './elements/builtin/index.js'
export { staticRenderers, staticQuestionRenderer } from './elements/builtin/static.js'
export { Placeholder } from './elements/Placeholder.js'
export { AssetFallback } from './elements/AssetFallback.js'
export type { AssetFallbackProps } from './elements/AssetFallback.js'
export { defaultAssetResolver } from './elements/assets.js'
export type { AssetResolver } from './elements/assets.js'
export { stageProperties, canvasFor } from './theme/tokens.js'
export type { ThemeValues } from './theme/tokens.js'
export { elementProperties, geometryProperties, visualProperties } from './frame/applyVisual.js'
export * from './frame/properties.js'

// Playback — client only. The server entry deliberately omits these: an effect never
// runs during server rendering, so a transport there would be inert, and exporting one
// would invite a host to try.
export { usePlayer, PlayerContext } from './player/usePlayer.js'
export type { PlayerContextValue } from './player/usePlayer.js'
export { createFrameWriter } from './frame/FrameWriter.js'
export type { FrameWriter } from './frame/FrameWriter.js'
export { useFrameLoop } from './frame/useFrameLoop.js'
export { PlaybackControls } from './player/controls/PlaybackControls.js'
export type { PlaybackControlsProps } from './player/controls/PlaybackControls.js'
