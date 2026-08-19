import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson } from './heavy.js'

/**
 * The 50-slide, 300-element lesson NFR-PERF-001 names, for this feature's budgets.
 *
 * The same fixture features 005 and 006 measure against, reached through the same helper, so
 * a number here is comparable with a number there rather than being a fresh scale nobody can
 * situate.
 */
export function largeLesson(): LessonManifest {
  return heavyLesson()
}
