import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson, heavyLessonShape } from '../../../../tools/scripts/fixtures/heavy-lesson.mjs'

/**
 * The Constitution's performance fixture, as a typed lesson.
 *
 * Reached by relative path into `tools/` rather than copied here. There must be exactly one
 * 50-slide/300-element fixture: the Constitution names it, the core gate validates it against
 * the schema, and a second copy in this package would be the one that drifts. `tools/` is not
 * a workspace package, so a path is the only way in — and this is test code, where the
 * boundary rules that stop `src` reaching sideways do not apply.
 */
export function heavy(): LessonManifest {
  return heavyLesson() as LessonManifest
}

export { heavyLessonShape }
