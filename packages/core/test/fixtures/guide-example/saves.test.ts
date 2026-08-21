import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { correct } from '../../harness/faulty.js'
import { countdownPlugin } from './plugin.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The step three registrations make look unnecessary.
 *
 * With a plugin, a renderer, and an editor registration, a countdown registers, renders, and appears
 * in the Add menu — every signal says it works. Then the lesson will not save, because the format's
 * element `type` is a closed union and `validate` rejects a manifest naming anything else.
 *
 * It fails **last**, after the most work, for a reason none of the earlier failures hints at. That
 * makes it the guide's most important sentence and the only one an author cannot discover by trying
 * things that appear to work.
 *
 * **This asserts the refusal only.** The accepted case would mean adding a variant to
 * `packages/schema/src/validate/element.ts` — which `check:migrations` watches, requiring a migration
 * and a `schemaVersion` bump — so a documentation example would be shipping an invented element type
 * in the published lesson format. The guide describes that change instead of performing one.
 */
const lessonWithCountdown = (): unknown => {
  const lesson = correct()
  const slide = lesson.slides[0]!
  return {
    ...lesson,
    slides: [
      {
        ...slide,
        elements: [
          {
            id: 'timer',
            type: 'countdown',
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            zIndex: 1,
            startMs: 0,
            endMs: 8000,
            payload: { seconds: 30 },
          },
        ],
      },
    ],
  }
}

describe('a lesson using the guide example type', () => {
  it('is refused by the format', () => {
    const result = validate(lessonWithCountdown())
    expect(result.ok).toBe(false)
  })

  it('is refused for the type, not for something incidental', () => {
    const result = validate(lessonWithCountdown())
    if (result.ok) throw new Error('unreachable')
    // The refusal must point at the element, so the guide's explanation matches what an author sees.
    expect(result.issues.some((i) => i.path.join('.').includes('elements'))).toBe(true)
  })

  it('is refused even though the plugin itself is valid', () => {
    /**
     * The whole point: plugin correctness and format acceptance are different questions, answered by
     * different packages. An author who conflates them concludes their plugin is broken.
     */
    expect(countdownPlugin.validate({ seconds: 30 })).toEqual([])
    expect(validate(lessonWithCountdown()).ok).toBe(false)
  })

  it('accepts the same lesson with a built-in type, so the refusal is about the type', () => {
    expect(validate(correct() as LessonManifest).ok).toBe(true)
  })
})
