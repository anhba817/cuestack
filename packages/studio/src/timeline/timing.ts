import type { Element, Slide } from '@cuestack/schema'
import { MIN_ELEMENT_DURATION_MS, SNAP_THRESHOLD_MS } from './constants.js'

export interface TimeRange {
  readonly startMs: number
  readonly endMs: number
}

export interface TimingOptions {
  /** Zero disables snapping. The negative control the snap suite uses. */
  readonly snapThresholdMs?: number
  /** The shortest the result may be. Defaults to what the element schema permits. */
  readonly minDurationMs?: number
}

/**
 * Moving and resizing a time range.
 *
 * **Deliberately not a reuse of `geometry/transform.ts`**, and the temptation was real: a
 * track bar looks like a rectangle and the operations have the same names. Time is
 * one-dimensional; its unit is an integer millisecond where geometry's is a finite float;
 * its floor is zero where geometry's is a minimum extent; and it snaps to other events'
 * boundaries rather than to edges and centres. Sharing the code would have given the
 * geometry module knowledge of milliseconds, which is how a general helper stops being
 * either (research R-07).
 *
 * What *is* shared is the shape, and that matters more: pure functions taking logical units,
 * returning new values, clamped so the reducer can never be handed something the schema
 * rejects, tested in the `node` project with no DOM. A reviewer who has read `geometry/` can
 * read this.
 *
 * Milliseconds in and milliseconds out — never pixels. That is what makes the mid-drag
 * rescale edge case fall out for free: a drag continues against the moment it started from,
 * because the pixel it started at is never consulted again.
 */

const whole = (ms: number): number => Math.max(0, Math.round(ms))

/** The nearest target within the threshold, or `null` when none is close enough. */
function nearest(ms: number, targets: readonly number[], threshold: number): number | null {
  if (threshold <= 0) return null
  let best: number | null = null
  let bestDistance = threshold
  for (const target of targets) {
    const distance = Math.abs(target - ms)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best
}

/**
 * Move both edges together, preserving the duration (FR-012).
 *
 * A drag that runs out of room **stops**; it does not resize. Clamping the start to zero and
 * leaving the end alone would silently shorten the element, which is a different edit from
 * the one the teacher performed.
 */
export function moveRange(
  range: TimeRange,
  deltaMs: number,
  snapTargets: readonly number[],
  options: TimingOptions = {},
): TimeRange {
  const threshold = options.snapThresholdMs ?? SNAP_THRESHOLD_MS
  const duration = range.endMs - range.startMs

  let start = whole(range.startMs + deltaMs)
  // Either edge may capture a target; the start wins a tie, because that is the edge a
  // teacher is watching when they drag a bar.
  const snappedStart = nearest(start, snapTargets, threshold)
  const snappedEnd = nearest(start + duration, snapTargets, threshold)
  if (snappedStart !== null) start = snappedStart
  else if (snappedEnd !== null) start = snappedEnd - duration

  start = Math.max(0, start)
  return { startMs: start, endMs: start + duration }
}

/** Move the leading edge alone, never past the trailing one (FR-013, FR-014). */
export function resizeRangeStart(
  range: TimeRange,
  deltaMs: number,
  snapTargets: readonly number[],
  options: TimingOptions = {},
): TimeRange {
  const threshold = options.snapThresholdMs ?? SNAP_THRESHOLD_MS
  const min = options.minDurationMs ?? MIN_ELEMENT_DURATION_MS

  let start = whole(range.startMs + deltaMs)
  start = nearest(start, snapTargets, threshold) ?? start
  return { startMs: Math.min(start, range.endMs - min), endMs: range.endMs }
}

/** Move the trailing edge alone, never before the leading one (FR-013, FR-014). */
export function resizeRangeEnd(
  range: TimeRange,
  deltaMs: number,
  snapTargets: readonly number[],
  options: TimingOptions = {},
): TimeRange {
  const threshold = options.snapThresholdMs ?? SNAP_THRESHOLD_MS
  const min = options.minDurationMs ?? MIN_ELEMENT_DURATION_MS

  let end = whole(range.endMs + deltaMs)
  end = nearest(end, snapTargets, threshold) ?? end
  return { startMs: range.startMs, endMs: Math.max(end, range.startMs + min) }
}

/**
 * Every moment a drag may land on, except the dragged element's own.
 *
 * Elements *and* effects, because an effect is an event too and a teacher lining a pulse up
 * with the end of a fade is doing the ordinary thing. Plus zero and the slide's duration,
 * which are the boundaries every bar is measured against.
 *
 * An event never snaps to itself: a bar that captured its own edge could not be moved by a
 * small amount at all.
 */
export function snapTargetsFor(slide: Slide, exceptElementId: string): readonly number[] {
  const targets = new Set<number>([0, slide.durationMs])
  for (const element of slide.elements as readonly Element[]) {
    const el = element as unknown as {
      id: string
      startMs: number
      endMs: number
      effects?: readonly { startMs: number; durationMs: number }[]
    }
    if (el.id === exceptElementId) continue
    targets.add(el.startMs)
    targets.add(el.endMs)
    for (const effect of el.effects ?? []) {
      targets.add(effect.startMs)
      targets.add(effect.startMs + effect.durationMs)
    }
  }
  return [...targets].sort((a, b) => a - b)
}
