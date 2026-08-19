import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { MIN_BAR_PX, NUDGE_MS, NUDGE_MS_COARSE } from './constants.js'
import type { TimeScale } from './scale.js'
import { moveRange, resizeRangeEnd, resizeRangeStart, type TimeRange } from './timing.js'
import type { Track as TrackModel } from './tracks.js'

export type TimingGesture = 'move' | 'resize-start' | 'resize-end'

export interface TrackProps {
  readonly track: TrackModel
  readonly scale: TimeScale
  readonly selected: boolean
  readonly snapTargets: readonly number[]
  readonly onSelect: (elementId: string) => void
  /** One call per committed change. The reducer refuses a locked element; this does not. */
  readonly onRetime: (elementId: string, range: TimeRange) => void
  /**
   * End the reversal run when the gesture finishes.
   *
   * This component emits one `set-timing` per `pointermove`, so a drag is many applied
   * changes that collapse into one undo step — and without a boundary the *next* drag would
   * join the same step, putting one undo two drags back. Pointer-up is that boundary, and it
   * is not elapsed time (research R-04).
   */
  readonly onEndRun?: () => void
}

/**
 * One element's bar, its two handles, and its effects.
 *
 * The bar is never narrower than `MIN_BAR_PX`, because a one-millisecond window is
 * authorable and a bar too small to hit is a bar that cannot be edited. That floor is
 * **presentation only** — it changes no stored value, and the scale still reports the true
 * time under the cursor.
 *
 * **Dragging needs no measurement.** Track space *is* CSS pixels, so a pointer delta is
 * already in the units `scale.toMsDelta` converts from — unlike the canvas, whose logical
 * units require the stage's rendered width and are the reason `canvas/pointer.ts` exists.
 * Nothing here reads a bounding rect, so `dom-measurement-confined` is untroubled and the
 * drag is exercisable in an environment that computes no layout.
 *
 * The gesture is expressed in **milliseconds throughout**, which is what makes the mid-drag
 * rescale edge case fall out for free: the drag continues against the moment it started
 * from, because the pixel it started at is never consulted again.
 *
 * Real buttons for the bar and the handles, so focus and activation come from the platform —
 * the decision feature 005's overlay took, and the reason its focus suite asserts "uses real
 * buttons" rather than testing a keydown handler of our own.
 */
export function Track({
  track,
  scale,
  selected,
  snapTargets,
  onSelect,
  onRetime,
  onEndRun,
}: TrackProps): ReactNode {
  const gesture = useRef<{ kind: TimingGesture; originX: number; from: TimeRange } | null>(null)
  const range: TimeRange = { startMs: track.startMs, endMs: track.endMs }

  const left = scale.toPx(track.startMs)
  const width = Math.max(MIN_BAR_PX, scale.toPx(track.endMs) - left)

  const apply = (kind: TimingGesture, deltaMs: number, from: TimeRange): void => {
    const next =
      kind === 'move'
        ? moveRange(from, deltaMs, snapTargets)
        : kind === 'resize-start'
          ? resizeRangeStart(from, deltaMs, snapTargets)
          : resizeRangeEnd(from, deltaMs, snapTargets)
    onRetime(track.elementId, next)
  }

  const begin = (kind: TimingGesture) => (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation()
    gesture.current = { kind, originX: event.clientX, from: range }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const move = (event: ReactPointerEvent<HTMLElement>): void => {
    const active = gesture.current
    if (!active) return
    apply(active.kind, scale.toMsDelta(event.clientX - active.originX), active.from)
  }

  const end = (): void => {
    gesture.current = null
    onEndRun?.()
  }

  /**
   * Arrow keys move; a modifier coarsens; a modifier plus an arrow resizes the trailing edge.
   *
   * FR-009 requires the timeline to be operable by keyboard, and re-timing is the operation
   * a pointer makes look easy and a keyboard makes possible at all.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>, kind: TimingGesture): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const step = event.shiftKey ? NUDGE_MS_COARSE : NUDGE_MS
    event.preventDefault()
    apply(kind, direction * step, range)
  }

  return (
    <li className="cs-track" aria-label={`Track: ${track.label}`}>
      <button
        type="button"
        className="cs-track-handle cs-track-handle-start"
        aria-label={`Move the start of ${track.label}`}
        data-testid={`cs-handle-start-${track.elementId}`}
        style={{ left: `${left}px` }}
        onPointerDown={begin('resize-start')}
        onPointerMove={move}
        onPointerUp={end}
        onKeyDown={(event) => onKeyDown(event, 'resize-start')}
      />
      <button
        type="button"
        className="cs-track-bar"
        data-testid={`cs-bar-${track.elementId}`}
        data-start-ms={track.startMs}
        data-end-ms={track.endMs}
        data-locked={track.locked ? 'true' : undefined}
        data-hidden={track.hidden ? 'true' : undefined}
        aria-pressed={selected}
        style={{ left: `${left}px`, width: `${width}px` }}
        onClick={() => onSelect(track.elementId)}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onKeyDown={(event) => onKeyDown(event, 'move')}
      >
        <span className="cs-track-label">{track.label}</span>
      </button>
      <button
        type="button"
        className="cs-track-handle cs-track-handle-end"
        aria-label={`Move the end of ${track.label}`}
        data-testid={`cs-handle-end-${track.elementId}`}
        style={{ left: `${left + width}px` }}
        onPointerDown={begin('resize-end')}
        onPointerMove={move}
        onPointerUp={end}
        onKeyDown={(event) => onKeyDown(event, 'resize-end')}
      />
      {track.effects.map((effect) => (
        <span
          key={effect.effectId}
          className="cs-effect-bar"
          data-testid={`cs-effect-${effect.effectId}`}
          data-start-ms={effect.startMs}
          data-end-ms={effect.endMs}
          title={`${effect.type} (${effect.phase})`}
          style={{
            left: `${scale.toPx(effect.startMs)}px`,
            width: `${Math.max(MIN_BAR_PX, scale.toPx(effect.endMs) - scale.toPx(effect.startMs))}px`,
          }}
        />
      ))}
    </li>
  )
}
