import type { LessonManifest } from '@cuestack/schema'
import { CANVAS_HEIGHT, CANVAS_WIDTH, themeProperty, type PropertyBag } from '../frame/properties.js'

export interface ThemeValues {
  readonly [token: string]: string | number
}

/** Logical canvas dimensions per aspect ratio. Arbitrary but fixed: what matters is
 *  that authored coordinates mean the same thing everywhere. */
const CANVAS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1600, h: 900 },
  '4:3': { w: 1600, h: 1200 },
  '9:16': { w: 900, h: 1600 },
}

export function canvasFor(aspectRatio: string): { w: number; h: number } {
  return CANVAS[aspectRatio] ?? CANVAS['16:9']!
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
