/**
 * @cuestack/core — the headless kernel.
 *
 * Computes what a slide looks like at a given time. Renders nothing, reads no
 * clock, touches no DOM. Zero runtime dependencies.
 */

// Resolution
export { resolve } from './resolve/index.js'
export type { ResolveContext } from './resolve/index.js'
export type {
  RenderState,
  ResolvedElement,
  ResolvedGeometry,
  ActiveEffect,
  RenderProblem,
  BlockingProblem,
} from './resolve/state.js'
export type { Contribution, TransformDelta, FilterDelta } from './resolve/contribution.js'
export { composeContributions } from './resolve/compose.js'

// Effects
export { createEffectRegistry, type EffectDescriptor, type EffectRegistry, type EffectPhase, type EffectParams } from './effects/registry.js'
export { builtinEffects } from './effects/builtin/index.js'
export { EASINGS, applyEasing } from './effects/easing.js'

// Elements
export { createElementRegistry, type ElementRegistry } from './elements/registry.js'
export {
  RENDER_STATE_VERSION,
  type ElementPlugin,
  type ElementResolveInput,
  type ElementContribution,
  type InspectorSpec,
  type InspectorField,
  type PluginIssue,
  type ThemeValues,
} from './elements/contract.js'

// Time and advancement arrive with US3 and US2 respectively; this entry gains
// their exports as each lands. Exporting them before they exist would make the
// package unbuildable, which is a worse kind of placeholder than an absence.

// Ports and adapters
export type { Ports, TimeSource, MediaPort, MediaStatus, VisibilityPort } from './ports/index.js'
export type {
  StorageAdapter,
  AssetAdapter,
  AnalyticsAdapter,
  LessonEvent,
  LoadResult,
  SaveResult,
  VersionToken,
  VersionSummary,
  AssetLocation,
} from './adapters/index.js'
export { memoryAdapters, createMemoryStorage, createMemoryAssets, createMemoryAnalytics } from './adapters/memory/index.js'
