import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { throwingPlugin, syntheticElement } from '../harness/plugins.js'
import { advanceOnNonMedia, beyondSlide, deadEnd, noAltText } from '../harness/faulty.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * FR-004 and NFR-USA-004: a code is not a message.
 *
 * "ELEMENT_BEYOND_SLIDE" tells an author nothing they can act on. The existing sources already
 * write full sentences naming the object and the remedy — this asserts the engine does not degrade
 * them on the way through, which is the quiet way a report becomes unreadable.
 */
const broken = (): LessonManifest => {
  const base = lessonOf({ slides: 1 })
  return {
    ...base,
    slides: [
      { ...base.slides[0]!, elements: [syntheticElement({ id: 'bad', type: 'broken', payload: {} })] },
    ],
  } as unknown as LessonManifest
}

describe('every message an author can meet', () => {
  const cases: [string, LessonManifest][] = [
    ['dead end', deadEnd()],
    ['unreachable advance', advanceOnNonMedia()],
    ['overrun', beyondSlide()],
    ['missing alt text', noAltText()],
  ]

  for (const [name, lesson] of cases) {
    it(`${name}: names its object and says what to do`, () => {
      const issues = checkLesson(lesson).issues
      expect(issues.length).toBeGreaterThan(0)
      for (const issue of issues) {
        expect(issue.message.length).toBeGreaterThan(40)
        expect(issue.message).not.toBe(issue.code)
        // A full sentence, not a fragment.
        expect(issue.message.trimEnd().endsWith('.')).toBe(true)
        if (issue.location.elementId) expect(issue.message).toContain(issue.location.elementId)
      }
    })
  }

  it('a plugin failure explains what was lost and what was not', () => {
    const elements = createElementRegistry([...builtinElements, throwingPlugin()])
    const issue = checkLesson(broken(), { elements }).issues.find(
      (i) => i.code === 'PLUGIN_VALIDATE_FAILED',
    )!
    expect(issue.message).toContain('bad')
    expect(issue.message).toContain('still checked')
  })

  it("carries the plugin's own words rather than restating them", () => {
    const lesson = lessonOf({ slides: 1 })
    const withEmptyText = {
      ...lesson,
      slides: [
        {
          ...lesson.slides[0]!,
          elements: [syntheticElement({ id: 't1', type: 'text', payload: { text: '' } })],
        },
      ],
    } as unknown as LessonManifest

    const issue = checkLesson(withEmptyText).issues.find((i) => i.code === 'TEXT_EMPTY')!
    expect(issue.message).toBe(
      builtinElements.find((p) => p.type === 'text')!.validate({ text: '' })[0]!.message,
    )
  })
})
