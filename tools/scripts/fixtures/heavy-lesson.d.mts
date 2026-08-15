/**
 * Types for the generated performance fixture.
 *
 * Hand-written rather than emitted: `tools/` is not a workspace package and has no build
 * step, and the fixture is deliberately plain JS so it can be run directly against the
 * schema. Kept to the two exports a consumer uses; the shape of a lesson is
 * `@cuestack/schema`'s business, and restating it here would be a second definition to
 * drift.
 */

export declare function heavyLesson(): unknown

export declare function heavyLessonShape(): {
  slides: number
  elements: number
  media: number
  questions: number
}
