import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Element, Slide } from '@cuestack/schema'
import { Ghost, ghostReason } from './Ghost.js'
import { TextEditSurface } from './TextEditSurface.js'
import { DeleteConfirmation } from './DeleteConfirmation.js'
import { Announcer, describeNudge, describeSelection } from './Announcer.js'
import { intentFor } from './shortcuts.js'
import { scaleOf } from './pointer.js'
import {
  beginGesture,
  commitGesture,
  updateGesture,
  type GestureFrame,
  type GestureKind,
  type GestureState,
} from './gesture.js'
import type { ResizeHandle } from '../geometry/transform.js'
import type { CanvasSize, Geometry } from '../geometry/types.js'
import { add as addToSelection, toggle } from '../session/selection.js'
import { moveBy } from '../geometry/transform.js'
import type { ElementEditorRegistry } from '../registry/editors.js'
import type { EditorSession } from '../session/useEditorSession.js'

export interface OverlayProps {
  readonly session: EditorSession
  readonly slide: Slide
  /** Elements the resolver left out — hidden, or outside their time window. */
  readonly absent: readonly Element[]
  readonly canvas: CanvasSize
  readonly editors: ElementEditorRegistry
}

/**
 * Everything editorial, and nothing that renders lesson content.
 *
 * Selection indicators, handles, snap guides, ghosts, off-canvas markers, the text surface,
 * and the menus all live here. What never lives here is an element renderer: the layer
 * beneath is `@cuestack/react` untouched, and an affordance reaching into it would be the
 * forked path Constitution V calls a severity-2 defect.
 *
 * The player cannot grow any of this, because the player has no overlay — a stronger
 * guarantee than "we do not pass the editor prop in production"
 * (contracts/overlay-contract.md).
 *
 * No geometry is computed here. A drag reads its scale once, hands screen deltas to
 * `gesture.ts`, and writes the result back as custom properties; the arithmetic is tested
 * with no browser at all (research R-04, R-10).
 */
export function Overlay({ session, slide, absent, canvas, editors }: OverlayProps): ReactNode {
  const root = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<GestureState | null>(null)
  const [frame, setFrame] = useState<GestureFrame | null>(null)
  // Deletion is confirmed, never immediate (FR-033). Holding the pending set here rather
  // than in the session keeps a prompt that is never answered from touching the draft.
  const [pendingDelete, setPendingDelete] = useState<readonly string[] | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const absentIds = new Set(absent.map((e) => e.id))
  const visible = slide.elements.filter((e) => !absentIds.has(e.id))
  const readOnly = session.mode === 'read-only'

  /**
   * Preview by writing the element's own custom properties.
   *
   * `stage.css` positions every element from `--cs-x` and `--cs-y`, so writing them *is*
   * moving it — in the same units the manifest stores, with no conversion between what the
   * teacher sees and what gets committed. The classic drag bug, where the element jumps on
   * release because preview and commit are different quantities, cannot arise.
   *
   * Bypassing React for this is the `FrameWriter` decision reused: a reconciliation pass per
   * `pointermove` per element would put SC-001's 100 ms budget out of reach at 300 elements
   * (research R-10).
   */
  const preview = useCallback((geometries: ReadonlyMap<string, Geometry>) => {
    const stage = root.current?.closest('.cs-stage')
    if (!stage) return
    for (const [id, g] of geometries) {
      const node = stage.querySelector<HTMLElement>(`.cs-element[data-cs-element-id="${id}"]`)
      if (!node) continue
      node.style.setProperty('--cs-x', String(g.x))
      node.style.setProperty('--cs-y', String(g.y))
      node.style.setProperty('--cs-w', String(g.width))
      node.style.setProperty('--cs-h', String(g.height))
      node.style.setProperty('--cs-rotation', String(g.rotation))
    }
  }, [])

  const startGesture = useCallback(
    (event: ReactPointerEvent, kind: GestureKind, handle: ResizeHandle | undefined, ids: readonly string[]) => {
      if (readOnly || ids.length === 0) return
      event.stopPropagation()
      ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)

      const byId = new Map(slide.elements.map((e) => [e.id, e]))
      const targets = ids
        .map((id) => byId.get(id))
        .filter((e): e is Element => Boolean(e) && !e!.locked)
        .map((e) => ({ id: e.id, from: geometryOf(e) }))
      if (targets.length === 0) return

      const dragging = new Set(targets.map((t) => t.id))
      const others = slide.elements.filter((e) => !dragging.has(e.id)).map(geometryOf)

      // Measured once, here, and nowhere else in the package. A browser has laid the stage
      // out long before a pointer reaches it; 1 is the degenerate fallback that keeps a drag
      // responsive rather than dead if it has not.
      const stage = root.current?.closest('.cs-stage')
      const scale = (stage ? scaleOf(stage, canvas) : null) ?? 1

      const state = beginGesture(kind, handle, targets, others, canvas, scale)
      setGesture(state)
      setFrame(null)
      origin.current = { x: event.clientX, y: event.clientY }
    },
    [readOnly, slide.elements, canvas],
  )

  const origin = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!gesture) return
      const next = updateGesture(gesture, event.clientX - origin.current.x, event.clientY - origin.current.y)
      setFrame(next)
      preview(next.geometries)
    },
    [gesture, preview],
  )

  const onPointerUp = useCallback(() => {
    if (!gesture || !frame) {
      setGesture(null)
      return
    }
    const edit = commitGesture(gesture, frame)
    setGesture(null)
    setFrame(null)
    if (edit) session.apply(edit)
  }, [gesture, frame, session])

  const selectedGeometry = visible
    .filter((e) => session.selection.includes(e.id))
    .map((e) => ({ element: e, geometry: frame?.geometries.get(e.id) ?? geometryOf(e) }))

  const labelOf = (el: Element): string => el.accessibility?.label ?? el.type

  /**
   * The whole keyboard surface, in one handler over a pure intent map.
   *
   * Traversal moves through the elements in paint order — the order the teacher sees, which
   * FR-041 asks for — and wraps, so Tab never dead-ends at the last element.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const intent = intentFor({
        key: event.key,
        shiftKey: event.shiftKey,
        modifier: event.ctrlKey || event.metaKey,
        textEditing: session.textEditing !== null,
      })
      if (!intent) return

      const ordered = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex)
      const selected = session.selection

      switch (intent.kind) {
        case 'traverse': {
          if (ordered.length === 0) return
          event.preventDefault()
          const at = ordered.findIndex((e) => e.id === selected[selected.length - 1])
          const next = ordered[(at + intent.direction + ordered.length) % ordered.length]!
          session.select([next.id])
          setAnnouncement(describeSelection([labelOf(next)]))
          return
        }
        case 'nudge': {
          if (selected.length === 0) return
          event.preventDefault()
          const byId = new Map(slide.elements.map((e) => [e.id, e]))
          const perId: Record<string, { x: number; y: number }> = {}
          for (const id of selected) {
            const el = byId.get(id)
            if (!el || el.locked) continue
            // Straight to the geometry engine: a nudge is already in logical units, so the
            // pointer adapter has nothing to convert (FR-035).
            const moved = moveBy(geometryOf(el), intent.dx, intent.dy)
            perId[id] = { x: moved.x, y: moved.y }
          }
          const ids = Object.keys(perId)
          if (ids.length === 0) return
          const result = session.apply({
            kind: 'transform-elements',
            ids,
            geometry: perId[ids[0]!]!,
            perId,
          })
          if (result.ok) {
            const first = byId.get(ids[0]!)!
            setAnnouncement(describeNudge(labelOf(first), perId[ids[0]!]!.x, perId[ids[0]!]!.y))
          }
          return
        }
        case 'copy':
          event.preventDefault()
          session.copy(selected)
          setAnnouncement(`${selected.length} copied.`)
          return
        case 'paste':
          event.preventDefault()
          if (session.clipboard.length > 0) session.apply({ kind: 'paste', elements: session.clipboard })
          return
        case 'duplicate':
          event.preventDefault()
          if (selected.length > 0) session.apply({ kind: 'duplicate', ids: selected })
          return
        case 'reorder':
          event.preventDefault()
          if (selected.length > 0) session.apply({ kind: 'reorder', ids: selected, direction: intent.direction })
          return
        case 'delete':
          event.preventDefault()
          // Through the confirmation, which is the only route to a delete (FR-033).
          if (selected.length > 0) setPendingDelete(selected)
          return
        case 'select-all':
          event.preventDefault()
          session.select(addToSelection([], ordered.map((e) => e.id)))
          setAnnouncement(describeSelection(ordered.map(labelOf)))
          return
        case 'clear-selection':
          event.preventDefault()
          session.select([])
          setAnnouncement(describeSelection([]))
          return
        case 'edit-text': {
          const only = selected.length === 1 ? slide.elements.find((e) => e.id === selected[0]) : undefined
          if (only && !only.locked && editors.get(only.type)?.textSurface) {
            event.preventDefault()
            session.beginTextEdit(only.id)
          }
          return
        }
      }
    },
    [session, slide.elements, editors],
  )

  const editing = session.textEditing
    ? slide.elements.find((e) => e.id === session.textEditing)
    : undefined
  const editingSurface = editing ? editors.get(editing.type)?.textSurface : undefined

  return (
    <div
      ref={root}
      className="cs-overlay"
      data-cs-overlay=""
      onKeyDown={readOnly ? undefined : onKeyDown}
      onPointerMove={gesture ? onPointerMove : undefined}
      onPointerUp={gesture ? onPointerUp : undefined}
      onPointerCancel={gesture ? onPointerUp : undefined}
    >
      {/* Clicking bare canvas clears the selection, which is how a teacher gets back to the
          slide's own settings in the inspector (FR-002, FR-024). */}
      <button
        type="button"
        className="cs-overlay-background"
        aria-label="Deselect all"
        onPointerDown={() => session.select([])}
      />

      {visible.map((element) => (
        <button
          key={element.id}
          type="button"
          className="cs-hit"
          data-cs-hit=""
          data-cs-element-id={element.id}
          data-cs-locked={element.locked ? '' : undefined}
          aria-pressed={session.selection.includes(element.id)}
          aria-label={`${element.accessibility?.label ?? element.type}${element.locked ? ', locked' : ''}`}
          style={boxStyle(geometryOf(element))}
          onPointerDown={(event) => {
            const ids = event.shiftKey
              ? toggle(session.selection, element.id)
              : session.selection.includes(element.id)
                ? session.selection
                : [element.id]
            session.select(ids)
            startGesture(event, 'move', undefined, ids)
          }}
          onDoubleClick={() => {
            if (!readOnly && editors.get(element.type)?.textSurface) session.beginTextEdit(element.id)
          }}
        />
      ))}

      {absent.map((element) => (
        <Ghost
          key={element.id}
          element={element}
          reason={ghostReason(element, session.authoringTime)}
          selected={session.selection.includes(element.id)}
          onSelect={() => session.select([element.id])}
        />
      ))}

      {/*
        Off-canvas is marked, never corrected. An element may legitimately begin off-stage and
        slide in, so clamping it back — the obvious implementation — would break a pattern the
        format supports. The teacher is told instead (spec Edge Cases #1).
      */}
      {slide.elements.filter((e) => isOffCanvas(e, canvas)).map((element) => (
        <span
          key={`off-${element.id}`}
          className="cs-off-canvas"
          data-cs-off-canvas=""
          data-cs-element-id={element.id}
        >
          {`${element.accessibility?.label ?? element.type} extends beyond the slide`}
        </span>
      ))}

      {/* Selection indicator and handles. Drawn over the element, never on it — the render
          layer is byte-identical with this layer removed (FR-043). */}
      {selectedGeometry.map(({ element, geometry }) => (
        <div
          key={`sel-${element.id}`}
          className="cs-selection"
          data-cs-selection=""
          data-cs-element-id={element.id}
          style={boxStyle(geometry)}
        >
          {!readOnly && !element.locked && selectedGeometry.length === 1 && (
            <>
              {HANDLES.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  className={`cs-handle cs-handle-${handle}`}
                  data-cs-handle={handle}
                  aria-label={`Resize ${handle}`}
                  onPointerDown={(event) => startGesture(event, 'resize', handle, [element.id])}
                />
              ))}
              <button
                type="button"
                className="cs-handle cs-handle-rotate"
                data-cs-handle="rotate"
                aria-label="Rotate"
                onPointerDown={(event) => startGesture(event, 'rotate', undefined, [element.id])}
              />
            </>
          )}
        </div>
      ))}

      {/* Guides are transient: drawn while a drag holds an alignment, stored never. */}
      {(frame?.guides ?? []).map((guide, i) => (
        <span
          key={`${guide.axis}-${guide.at}-${i}`}
          className={`cs-guide cs-guide-${guide.axis}`}
          data-cs-guide={guide.source}
          style={{ [guide.axis === 'x' ? '--cs-guide-x' : '--cs-guide-y']: String(guide.at) } as React.CSSProperties}
        />
      ))}

      {editing && editingSurface && (
        <TextEditSurface
          element={editing}
          value={editingSurface.read(editing.payload)}
          onInput={session.setPendingText}
          onCommit={session.endTextEdit}
        />
      )}

      {/*
        Read-only shows its controls disabled and says why, rather than hiding them (FR-051).
        A teacher looking for the Add menu and not finding it concludes the editor is broken;
        one who finds it greyed out with a reason concludes they are looking at someone else's
        lesson. The reducer refuses regardless — this half is what a Reviewer actually
        experiences, because the refusal itself is invisible to them.
      */}
      {readOnly && (
        <p className="cs-readonly" data-cs-readonly="" role="status">
          This lesson is open for reading. Changes are unavailable; copying is still permitted.
        </p>
      )}
      <AddMenu session={session} editors={editors} disabled={readOnly} />
      <ArrangeControls session={session} disabled={readOnly} />
      <ManageControls session={session} onDelete={setPendingDelete} disabled={readOnly} />

      {pendingDelete && (
        <DeleteConfirmation
          elements={slide.elements.filter((e) => pendingDelete.includes(e.id))}
          onConfirm={() => {
            session.apply({ kind: 'delete', ids: pendingDelete })
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <Announcer message={announcement} />
      <span className="cs-overlay-slide" hidden data-cs-slide-id={slide.id} />
    </div>
  )
}

const HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Every element type the registry knows, so a new one appears without touching this file. */
function AddMenu({
  session,
  editors,
  disabled,
}: {
  session: EditorSession
  editors: ElementEditorRegistry
  disabled: boolean
}): ReactNode {
  return (
    <div className="cs-add-menu" data-cs-add-menu="" role="group" aria-label="Add element">
      {editors.types().map((type) => (
        <button
          key={type}
          type="button"
          className="cs-add-item"
          data-cs-add={type}
          disabled={disabled}
          onClick={() => {
            const result = session.apply({ kind: 'add-element', type })
            // What it adds becomes the selection, so the teacher can immediately position it.
            if (result.ok && result.idsCreated[0]) session.select([result.idsCreated[0]])
          }}
        >
          {`Add ${type}`}
        </button>
      ))}
    </div>
  )
}

/**
 * Align and distribute, unavailable rather than inert below their minimum selections.
 *
 * FR-006 asks for the command to be *unavailable*, not to silently do nothing: a control that
 * looks live and ignores a click teaches a teacher that the editor is unreliable, which is
 * more expensive than a control that is visibly not applicable yet.
 */
function ArrangeControls({
  session,
  disabled,
}: {
  session: EditorSession
  disabled: boolean
}): ReactNode {
  const n = session.selection.length
  const ids = session.selection

  return (
    <div className="cs-arrange" data-cs-arrange="" role="group" aria-label="Arrange">
      {(['left', 'right', 'top', 'bottom', 'centre-x', 'centre-y'] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          className="cs-arrange-item"
          data-cs-align={edge}
          disabled={disabled || n < 2}
          onClick={() => session.apply({ kind: 'align', ids, edge })}
        >
          {`Align ${edge}`}
        </button>
      ))}
      {(['horizontal', 'vertical'] as const).map((axis) => (
        <button
          key={axis}
          type="button"
          className="cs-arrange-item"
          data-cs-distribute={axis}
          disabled={disabled || n < 3}
          onClick={() => session.apply({ kind: 'distribute', ids, axis })}
        >
          {`Distribute ${axis}`}
        </button>
      ))}
    </div>
  )
}

/**
 * Layer order, lock, hide, duplicate, copy, paste, and delete (FR-027, FR-029, FR-032).
 *
 * Delete goes through `onDelete` rather than applying an edit, because the confirmation is the
 * only route to a `delete` (FR-033). Every other action here is immediate: none of them
 * destroys anything a teacher cannot reverse by doing the opposite.
 */
function ManageControls({
  session,
  onDelete,
  disabled,
}: {
  session: EditorSession
  onDelete: (ids: readonly string[]) => void
  disabled: boolean
}): ReactNode {
  const ids = session.selection
  // Copy stays available in read-only: it changes nothing, and refusing it would be a
  // restriction the requirement does not ask for (FR-051).
  const none = disabled || ids.length === 0

  return (
    <div className="cs-manage" data-cs-manage="" role="group" aria-label="Manage elements">
      {(['forward', 'backward'] as const).map((direction) => (
        <button
          key={direction}
          type="button"
          data-cs-reorder={direction}
          disabled={none}
          onClick={() => session.apply({ kind: 'reorder', ids, direction })}
        >
          {direction === 'forward' ? 'Bring forward' : 'Send backward'}
        </button>
      ))}
      {(['locked', 'hidden'] as const).map((flag) => (
        <button
          key={flag}
          type="button"
          data-cs-flag={flag}
          disabled={none}
          onClick={() => {
            // Toggle from the first member, so a mixed selection resolves to one state
            // rather than each element flipping to the opposite of where it was.
            const first = session.draft.slides
              .flatMap((s) => s.elements)
              .find((e) => e.id === ids[0])
            session.apply({ kind: 'set-flag', ids, flag, value: !first?.[flag] })
          }}
        >
          {flag === 'locked' ? 'Lock' : 'Hide'}
        </button>
      ))}
      <button type="button" data-cs-duplicate="" disabled={none} onClick={() => session.apply({ kind: 'duplicate', ids })}>
        Duplicate
      </button>
      <button type="button" data-cs-copy="" disabled={ids.length === 0} onClick={() => session.copy(ids)}>
        Copy
      </button>
      <button
        type="button"
        data-cs-paste=""
        disabled={disabled || session.clipboard.length === 0}
        onClick={() => session.apply({ kind: 'paste', elements: session.clipboard })}
      >
        Paste
      </button>
      <button type="button" data-cs-delete="" disabled={none} onClick={() => onDelete(ids)}>
        Delete
      </button>
    </div>
  )
}

const geometryOf = (el: Element): Geometry => ({
  x: el.x,
  y: el.y,
  width: el.width,
  height: el.height,
  rotation: el.rotation ?? 0,
})

/** The same custom properties `stage.css` positions elements from — one coordinate system. */
const boxStyle = (g: Geometry): React.CSSProperties =>
  ({
    '--cs-x': String(g.x),
    '--cs-y': String(g.y),
    '--cs-w': String(g.width),
    '--cs-h': String(g.height),
    '--cs-rotation': String(g.rotation),
  }) as React.CSSProperties

/**
 * Any part of the element outside the logical canvas.
 *
 * Authored geometry, not visual bounds — the rule snapping follows too. A rotated element
 * whose painted corner pokes over the edge is not off-canvas in any sense the teacher can act
 * on, because the value they would change is the one stored.
 */
export function isOffCanvas(element: Element, canvas: CanvasSize): boolean {
  return (
    element.x < 0 ||
    element.y < 0 ||
    element.x + element.width > canvas.width ||
    element.y + element.height > canvas.height
  )
}
