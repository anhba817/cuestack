import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson as build } from '../../../../tools/scripts/fixtures/heavy-lesson.mjs'

/**
 * The Constitution's performance fixture — 50 slides, 300 elements — for core's own budgets.
 *
 * Reached by relative path into `tools/` rather than copied, the same way `@cuestack/react` and
 * `@cuestack/studio` reach it. There must be exactly one such fixture: the Constitution names it, a
 * gate validates it against the schema, and a second copy in this package would be the one that
 * drifts. A validation number measured here is then comparable with a render number measured
 * there, rather than being a fresh scale nobody can situate.
 */
export function largeLesson(): LessonManifest {
  return build() as LessonManifest
}
