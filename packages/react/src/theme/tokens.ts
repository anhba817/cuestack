import type { AspectRatio, LessonManifest } from '@cuestack/schema'
import { CANVAS_HEIGHT, CANVAS_WIDTH, themeProperty, type PropertyBag } from '../frame/properties.js'

export interface ThemeValues {
  readonly [token: string]: string | number
}

export interface Canvas {
  readonly w: number
  readonly h: number
}

/**
 * Logical canvas dimensions per aspect ratio.
 *
 * The numbers are arbitrary; what matters is that each pair carries its ratio exactly,
 * because that is what makes one logical unit the same length on both axes. A canvas
 * whose ratio disagreed with the stage's would stretch every authored coordinate.
 *
 * Keyed by `AspectRatio` rather than `string`, and with no runtime fallback: a ratio
 * added to the schema is then a compile error here rather than a lesson silently
 * rendered as 16:9. The previous `?? CANVAS['16:9']` was the sort of defensive default
 * that turns a new format value into a layout bug with no error attached to it.
 */
const CANVAS: Record<AspectRatio, Canvas> = {
  '16:9': { w: 1600, h: 900 },
  '4:3': { w: 1600, h: 1200 },
  '9:16': { w: 900, h: 1600 },
}

export function canvasFor(aspectRatio: AspectRatio): Canvas {
  return CANVAS[aspectRatio]
}

/**
 * Lesson theme plus host override, as custom properties on the stage.
 *
 * Host last, so a host can brand a lesson it did not author. Every consumer reads
 * these through `var(--cs-theme-*, <readable default>)` — the fallback is FR-019, and
 * without it a lesson whose theme omits a token renders invisibly rather than plainly.
 */
export function stageProperties(
  lesson: LessonManifest,
  hostTheme: ThemeValues = {},
): PropertyBag {
  const canvas = canvasFor(lesson.lesson.aspectRatio)
  const bag: PropertyBag = {
    [CANVAS_WIDTH]: String(canvas.w),
    [CANVAS_HEIGHT]: String(canvas.h),
  }
  for (const [token, value] of Object.entries(hostTheme)) {
    bag[themeProperty(token)] = String(value)
  }
  return bag
}
