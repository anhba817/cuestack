import type { LessonManifest } from '@cuestack/schema'
import { slide, textElement } from './corpus.js'

/** A minimal valid lesson for transport tests. */
export function lessonOf({ slides = 1, durationMs = 8000 } = {}): LessonManifest {
  return {
    schemaVersion: '1.0',
    lesson: { id: 'lesson_test', title: 'Test', language: 'en', aspectRatio: '16:9' },
    slides: Array.from({ length: slides }, (_, i) =>
      slide([textElement({ id: `el_${i}`, endMs: durationMs, effects: [] })], {
        id: `slide_${i}`,
        durationMs,
      }),
    ),
  } as LessonManifest
}
