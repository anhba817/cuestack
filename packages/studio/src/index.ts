/**
 * @cuestack/studio — the authoring canvas and properties inspector.
 *
 * Browser only, client only. There is no `react-server` condition and no server entry:
 * authoring is not server-rendered, every surface here uses hooks, and advertising an RSC
 * path that cannot work would invite a host to try.
 *
 * Never a dependency of `@cuestack/react`. The arrow points one way, enforced by the
 * `no-studio-in-player` graph rule and proved by `check-studio-isolation.mjs`, which renders
 * a lesson with this package absent from disk.
 */

// The canvas — the player's renderer with an editor overlay beside it, never inside it.
export { EditorCanvas } from './canvas/EditorCanvas.js'
export type { EditorCanvasProps } from './canvas/EditorCanvas.js'
export { Overlay } from './canvas/Overlay.js'
export type { OverlayProps } from './canvas/Overlay.js'
export { Ghost, ghostReason } from './canvas/Ghost.js'
export type { GhostProps, GhostReason } from './canvas/Ghost.js'
export { isOffCanvas } from './canvas/Overlay.js'
export { TextEditSurface } from './canvas/TextEditSurface.js'
export type { TextEditSurfaceProps } from './canvas/TextEditSurface.js'
export { Announcer, describeSelection, describeNudge } from './canvas/Announcer.js'
export type { AnnouncerProps } from './canvas/Announcer.js'
export { intentFor } from './canvas/shortcuts.js'
export type { ShortcutIntent, KeyChord } from './canvas/shortcuts.js'

// The input edge, and the arithmetic behind a drag. Both usable without React.
export { scaleOf, toLogicalDelta } from './canvas/pointer.js'
export type { LogicalDelta } from './canvas/pointer.js'
export { beginGesture, updateGesture, commitGesture } from './canvas/gesture.js'
export type { GestureKind, GestureState, GestureFrame, GestureTarget } from './canvas/gesture.js'

// The inspector — fields from a type's registration, never a branch on type.
/**
 * The timeline (feature 006). Time becomes visible, editable, and playable.
 *
 * `usePlayback` is exported beside it because a host has to mount both: the writer registers
 * element nodes on mount, so the canvas needs it from its first render, and the frame's
 * resolved state has to reach the canvas or an element entering mid-slide never appears.
 */
export { TimelineProblems } from './timeline/TimelineProblems.js'
export type { TimelineProblemsProps } from './timeline/TimelineProblems.js'
export { overrunsOf, requiredDurationMs, isWholeSlideOverrun } from './timeline/overrun.js'

export { SequenceView } from './sequence/SequenceView.js'
export type { SequenceViewProps } from './sequence/SequenceView.js'
export { SequenceRow } from './sequence/SequenceRow.js'
export { eventsOf, keyOf } from './sequence/events.js'
export type { SequenceEvent, EventKind } from './sequence/events.js'
export { classify, resolveSequence, assignmentsFor } from './sequence/relationships.js'
export type { TimingChange } from './sequence/relationships.js'
export { moveRange, resizeRangeStart, resizeRangeEnd, snapTargetsFor } from './timeline/timing.js'
export type { TimeRange, TimingOptions } from './timeline/timing.js'

export { EffectControls } from './effects/EffectControls.js'
export type { EffectControlsProps } from './effects/EffectControls.js'
export { EffectFields } from './effects/EffectFields.js'
export type { EffectFieldsProps } from './effects/EffectFields.js'
export { newEffect } from './effects/defaults.js'
export type { NewEffectDraft } from './effects/defaults.js'
export { Timeline } from './timeline/Timeline.js'
export type { TimelineProps } from './timeline/Timeline.js'
export { usePlayback } from './session/usePlayback.js'
export type { Playback, PlaybackOptions, PlaybackState } from './session/usePlayback.js'
export { buildTracks } from './timeline/tracks.js'
export type { Track, EffectBar } from './timeline/tracks.js'
export { createScale, clampPxPerSecond } from './timeline/scale.js'
export type { TimeScale } from './timeline/scale.js'
export {
  SNAP_THRESHOLD_MS,
  MIN_ELEMENT_DURATION_MS,
  MIN_EFFECT_DURATION_MS,
  NUDGE_MS,
  NUDGE_MS_COARSE,
  DEFAULT_EFFECT_DURATION_MS,
  MIN_PX_PER_SECOND,
  MAX_PX_PER_SECOND,
  MIN_BAR_PX,
} from './timeline/constants.js'
export type { EffectPatch, SequenceAssignment, SequenceRelationship } from './draft/edit.js'

export { Inspector } from './inspector/Inspector.js'
export { readPath } from './inspector/path.js'
export type { InspectorProps } from './inspector/Inspector.js'
export { Field } from './inspector/Field.js'
export type { FieldProps } from './inspector/Field.js'
export type { EditorField } from './inspector/fields.js'
export { COMMON_FIELDS } from './inspector/common.js'
export { SLIDE_FIELDS } from './inspector/slide.js'

/**
 * History (feature 008). Undo and redo live on the session itself — see `useEditorSession` —
 * so what is exported here is the pure algebra, the run-key rule, and the keyboard binding a
 * host attaches to its own editor root.
 */
export { useHistoryShortcuts } from './useHistoryShortcuts.js'
export { historyIntentFor } from './history/shortcuts.js'
export type { HistoryIntent, HistoryChord } from './history/shortcuts.js'
export { runKeyOf, COLLAPSIBLE_KINDS } from './history/runKey.js'
export { MAX_DEPTH } from './history/stack.js'
export type { HistoryStep, HistoryStack } from './history/stack.js'

// Persistence (feature 008) — saving without being asked, and saying only what is true.
export { useDraftPersistence } from './persistence/useDraftPersistence.js'
export type {
  DraftPersistence,
  DraftPersistenceOptions,
  SaveState,
  SaveStateKind,
  Conflict,
} from './persistence/useDraftPersistence.js'
export { SaveStatus } from './persistence/SaveStatus.js'
export { ConflictNotice } from './persistence/ConflictNotice.js'
export { VersionHistory } from './persistence/VersionHistory.js'
export type { VersionHistoryProps } from './persistence/VersionHistory.js'
export type { ConflictNoticeProps } from './persistence/ConflictNotice.js'
export type { SaveStatusProps } from './persistence/SaveStatus.js'
export { IDLE_MS, BACKOFF_MS, MAX_ATTEMPTS, CHECKPOINT_INTERVAL_MS, isCheckpoint, backoffFor } from './persistence/schedule.js'
export { useDraftRecovery } from './persistence/useDraftRecovery.js'
export type { DraftRecovery, DraftRecoveryOptions, RecoveryStatus } from './persistence/useDraftRecovery.js'
export { RecoveryPrompt } from './persistence/RecoveryPrompt.js'
export type { RecoveryPromptProps } from './persistence/RecoveryPrompt.js'
export { onPageHidden } from './persistence/flush.js'
export { browserKeeper, memoryKeeper, keeperFor, keyFor } from './persistence/keeper.js'
export type { DraftKeeper, KeepResult, KeptWork } from './persistence/keeper.js'

// The session — draft, selection, authoring time, mode, clipboard.
export { useEditorSession } from './session/useEditorSession.js'
export type { EditorSession, EditorSessionOptions, EditorMode } from './session/useEditorSession.js'
export { replace, toggle, add, clear, clampSelection } from './session/selection.js'

// The draft reducer — pure, usable with no React at all.
export { applyEdit } from './draft/reducer.js'
export { EDIT_KINDS } from './draft/edit.js'
export type {
  Edit,
  EditKind,
  EditResult,
  EditContext,
  EditRefusal,
  AlignEdge,
  DistributeAxis,
} from './draft/edit.js'
export { randomIds } from './draft/ids.js'
export type { IdSource } from './draft/ids.js'

// Geometry — pure, usable with no DOM.
export { alignEdges, distributeEvenly } from './geometry/align.js'
export { moveBy, resizeBy, rotateBy } from './geometry/transform.js'
export type { ResizeHandle } from './geometry/transform.js'
export { snap } from './geometry/snap.js'
export { snapCandidates } from './geometry/candidates.js'
export {
  SNAP_THRESHOLD_UNITS,
  NUDGE_UNITS,
  NUDGE_UNITS_COARSE,
  MIN_EXTENT_UNITS,
  DUPLICATE_OFFSET_UNITS,
} from './geometry/constants.js'
export type { Geometry, GeometryDelta, SnapCandidate, SnapResult, CanvasSize } from './geometry/types.js'

// Editor-side registration — the fifth member of the plugin contract.
export { createElementEditorRegistry, builtinElementEditors } from './registry/editors.js'
export type {
  ElementEditor,
  ElementEditorRegistry,
  ElementDefaults,
  TextSurface,
} from './registry/editors.js'

// Preview — the lesson as a learner receives it, inside the editor (feature 007).
export { Preview } from './preview/Preview.js'
export type { PreviewProps, PreviewStart } from './preview/Preview.js'
export { PreviewControls } from './preview/PreviewControls.js'
export type { PreviewControlsProps } from './preview/PreviewControls.js'
export { ViewportPreset } from './preview/ViewportPreset.js'
export { usePreviewSession } from './preview/usePreviewSession.js'
export type { PreviewSession } from './preview/usePreviewSession.js'
export { startPointFor } from './preview/startPoint.js'
export type { StartPoint } from './preview/startPoint.js'
export { PREVIEW_PRESETS, PREVIEW_PRESET_ORDER, TYPE_FLOOR_PX, floorsFor } from './preview/constants.js'
export type { ViewportPreset as ViewportPresetName } from './preview/constants.js'
