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
export { AuthoringTime } from './canvas/AuthoringTime.js'
export { DeleteConfirmation } from './canvas/DeleteConfirmation.js'
export type { DeleteConfirmationProps } from './canvas/DeleteConfirmation.js'
export { Announcer, describeSelection, describeNudge } from './canvas/Announcer.js'
export type { AnnouncerProps } from './canvas/Announcer.js'
export { intentFor } from './canvas/shortcuts.js'
export type { ShortcutIntent, KeyChord } from './canvas/shortcuts.js'
export type { AuthoringTimeProps } from './canvas/AuthoringTime.js'

// The input edge, and the arithmetic behind a drag. Both usable without React.
export { scaleOf, toLogicalDelta } from './canvas/pointer.js'
export type { LogicalDelta } from './canvas/pointer.js'
export { beginGesture, updateGesture, commitGesture } from './canvas/gesture.js'
export type { GestureKind, GestureState, GestureFrame, GestureTarget } from './canvas/gesture.js'

// The inspector — fields from a type's registration, never a branch on type.
export { Inspector } from './inspector/Inspector.js'
export { readPath } from './inspector/path.js'
export type { InspectorProps } from './inspector/Inspector.js'
export { Field } from './inspector/Field.js'
export type { FieldProps } from './inspector/Field.js'
export type { EditorField } from './inspector/fields.js'
export { COMMON_FIELDS } from './inspector/common.js'
export { SLIDE_FIELDS } from './inspector/slide.js'

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
