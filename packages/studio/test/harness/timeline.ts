import type { Element, LessonManifest } from '@cuestack/schema'
import { element, lessonWith } from './corpus.js'

/**
 * Slide shapes the timeline's suites need, and only those.
 *
 * A companion to `corpus.ts` rather than an extension of it: everything here exists because
 * a *timing* rule needs it, and several are states the canvas has no opinion about — a
 * one-millisecond window, a slide of zero duration, an effect that runs after its element
 * has gone. Same `fx-` id prefix, inherited from `element()`, so a fixture id can never
 * collide with what `countingIds()` mints.
 *
 * This is fixtures. The *render* harness is `editor.tsx`.
 */

/** An effect, valid by default, with just enough shape to place on a track. */
export function effect(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: `fx-effect-${++counter}`,
    type: 'fade',
    phase: 'enter',
    startMs: 0,
    durationMs: 400,
    order: 0,
    ...overrides,
  }
}
let counter = 0

/** Elements appearing at different moments, so a track's position is falsifiable. */
export const staggered = (): Element[] => [
  element({ startMs: 0, endMs: 2000 }),
  element({ startMs: 2000, endMs: 5000 }),
  element({ startMs: 5000, endMs: 8000 }),
]

/**
 * A window one millisecond wide — the shortest the schema permits (`endMs > startMs`).
 *
 * Its bar must stay visible and grabbable at every scale. A bar too small to hit is a bar
 * that cannot be edited, which is why `MIN_BAR_PX` exists.
 */
export const oneMillisecond = (): Element => element({ startMs: 3000, endMs: 3001 })

/**
 * Starting at zero and ending exactly at the slide's duration.
 *
 * Both handles sit on the ruler's ends and must stay distinguishable from them.
 */
export const spansSlide = (): Element => element({ startMs: 0, endMs: 8000 })

/** Ends after the slide does — the overrun US5 reports (BR-017). */
export const overruns = (): Element => element({ startMs: 0, endMs: 12_000 })

/** Two effects overlapping in time. Legal, and both must be drawn rather than collapsed. */
export const overlappingEffects = (): Element =>
  element({
    startMs: 0,
    endMs: 8000,
    effects: [
      effect({ type: 'fade', phase: 'enter', startMs: 0, durationMs: 1000, order: 0 }),
      effect({ type: 'pulse', phase: 'emphasis', startMs: 500, durationMs: 1000, order: 1 }),
    ],
  })

/**
 * An effect that runs after its element has gone.
 *
 * Authorable — `Effect.startMs` is slide time, not element time, so nothing in the schema
 * forbids it — and the timeline is required to say the effect would never run.
 */
export const effectAfterElementEnds = (): Element =>
  element({
    startMs: 0,
    endMs: 2000,
    effects: [effect({ type: 'pulse', phase: 'emphasis', startMs: 5000, durationMs: 500 })],
  })

/** Two events at the same moment, so the ordering tie-break has something to break. */
export const simultaneous = (): Element[] => [
  element({ zIndex: 1, startMs: 1000, endMs: 4000 }),
  element({ zIndex: 2, startMs: 1000, endMs: 4000 }),
]

/** A lesson whose single slide holds the given elements, with the usual 8 s duration. */
export const timelineLesson = (elements: Element[]): LessonManifest => lessonWith(elements)

/**
 * A slide of zero duration.
 *
 * Legal: `Slide.durationMs` is `msInt` — integer **≥ 0**, not the positive `msDuration` an
 * earlier draft of the data model assumed — and a slide advancing `on_click` has no reason
 * to carry one. The ruler has no width to draw, and **every** element overruns, because
 * `collectProblems` tests `endMs > durationMs` and every element has `endMs >= 1`.
 */
export const zeroDurationSlide = (): LessonManifest =>
  lessonWith([element({ startMs: 0, endMs: 2000 }), element({ startMs: 0, endMs: 3000 })], {
    durationMs: 0,
    advance: { mode: 'on_click' },
  })

/** No elements at all — a teacher's first slide, and the timeline must not look broken. */
export const emptyTimeline = (): LessonManifest => lessonWith([])
