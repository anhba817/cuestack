import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson as build, heavyLessonShape } from '../../../../tools/scripts/fixtures/heavy-lesson.mjs'

/**
 * The Constitution's performance fixture — 50 slides, 300 elements.
 *
 * Reached by relative path into `tools/` rather than copied, for the reason the React
 * package's equivalent harness gives: there must be exactly one such fixture. The
 * Constitution names it, a gate validates it against the schema, and a second copy in this
 * package would be the one that drifts.
 */
export function heavyLesson(): LessonManifest {
  return build() as LessonManifest
}

export { heavyLessonShape }
