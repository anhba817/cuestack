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
  type InspectorFieldKind,
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

/**
 * The seven MVP element types as complete plugins (feature 009).
 *
 * A host registering a type of its own must **compose** rather than replace:
 * `createElementRegistry([...builtinElements, mine])`. A registry that omits these reports all
 * seven as unknown, because a non-empty registry turns off the "everything is known" escape.
 */
export { builtinElements } from './elements/builtin/index.js'

// Ports and adapters
export type {
  Ports,
  TimeSource,
  MediaPort,
  MediaStatus,
  VisibilityPort,
  Scheduler,
  Connectivity,
} from './ports/index.js'
export type {
  StorageAdapter,
  AssetAdapter,
  AnalyticsAdapter,
  LessonEvent,
  LoadResult,
  SaveResult,
  VersionToken,
  VersionEntry,
  SaveOptions,
  AssetLocation,
} from './adapters/index.js'
export type { MemoryStorageOptions } from './adapters/memory/index.js'
export { memoryAdapters, createMemoryStorage, createMemoryAssets, createMemoryAnalytics } from './adapters/memory/index.js'

/**
 * Publishing (feature 009) — the fourth adapter, and the boundary a lesson does not come back
 * across. Note what it deliberately lacks: no update, no delete, no record edit, no arbitrary
 * `setActive`. Absence is the enforcement (BR-008).
 */
export type {
  PublishingAdapter,
  PublishedVersion,
  PublishedVersionId,
  PublishAction,
  PublishRefusal,
  PublishResult,
  LoadPublishedResult,
  ActionResult,
  RecordEntry,
} from './publishing/index.js'
export type { MemoryPublishingOptions } from './publishing/memory/index.js'
export { createMemoryPublishing } from './publishing/memory/index.js'

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

/**
 * Media — the bidirectional port, and the one rule for reconciling two clocks (Wave 3).
 *
 * `reconcile` is exported because it is the *stated* rule (FR-037), and a rule nobody can
 * read is a rule nobody can check. `one-rule.test.ts` enforces that it is applied in exactly
 * one place; exporting it does not weaken that, it makes the claim inspectable.
 */
export { createMediaLink } from './media/link.js'
export type { MediaLinkController } from './media/link.js'
export {
  reconcile,
  commanded,
  emptyLink,
  MEDIA_SYNC_TOLERANCE_MS,
  MEDIA_REPORT_INTERVAL_MS,
} from './media/reconcile.js'
export type { MediaLink, Reconciliation } from './media/reconcile.js'

/**
 * The validation engine (feature 009).
 *
 * `checkLesson` is the whole surface for the pure half; `checkAssets` is the one question that
 * needs the outside world and is therefore a separate call a caller may skip (FR-016a).
 */
export {
  checkLesson,
  withAssetIssues,
  severityFor,
  collectAssetRefs,
  checkAssets,
  accessibilityIssues,
  SEMANTIC_CODES,
} from './validation/index.js'
export type {
  ValidationReport,
  ReportIssue,
  CheckOptions,
  ValidationPolicy,
  SemanticCode,
  IssueSource,
  Severity,
  AssetRef,
  UnresolvedAsset,
} from './validation/index.js'
