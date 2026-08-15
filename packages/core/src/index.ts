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

// Time
export { createClock, CLAMP_CEILING_MS, type Clock } from './time/clock.js'
export {
  createTransport,
  type Transport,
  type TransportSnapshot,
  type TransportState,
} from './time/transport.js'

// Advancement
export {
  createAdvanceController,
  type AdvanceController,
  type AdvanceControllerOptions,
  type AdvanceDecision,
  type AdvanceSignals,
  type AdvanceCause,
} from './advance/controller.js'

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

/**
 * Interactions — what a learner answered, and whether it counts (Wave 3).
 *
 * In core rather than in an adapter because `completionPolicy` is a rule about lessons: a
 * second adapter must reach the same conclusion from the same answer, and BR-005 is already
 * enforced here. A renderer decides what a radio group looks like; it does not decide what
 * counts as complete.
 */
export { isComplete, isUnsatisfiable, COMPLETION_POLICIES, DEFAULT_COMPLETION_POLICY } from './interactions/policy.js'
export type { CompletionPolicy, AttemptSummary } from './interactions/policy.js'
export { evaluate, isCorrectResponse } from './interactions/evaluate.js'
export type { InteractionOutcome, EvaluatedResponse } from './interactions/evaluate.js'
export { emptyInteractionState, submit } from './interactions/state.js'
export type { InteractionState, InteractionResponse, SubmitResult } from './interactions/state.js'
