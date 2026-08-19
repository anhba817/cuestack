import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { syntheticElement, throwingPlugin } from '../harness/plugins.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * Contract §3.6. The difference between a report that degrades and one that disappears.
 *
 * An author with one broken plugin should lose that element's type-specific checks and nothing
 * else. Letting the throw escape would cost them every issue they could have acted on, at the
 * moment they are least able to work out why.
 */
describe('a plugin that throws', () => {
  const lesson = (): LessonManifest => {
    const base = lessonOf({ slides: 1 })
    return {
      ...base,
      slides: [
        {
          ...base.slides[0]!,
          durationMs: 8000,
          elements: [
            syntheticElement({ id: 'bad', type: 'broken', payload: {} }),
            syntheticElement({ id: 't1', type: 'text', payload: { text: '  ' } }),
            syntheticElement({ id: 'over', type: 'text', payload: { text: 'x' }, endMs: 12_000 }),
          ],
        },
      ],
    } as unknown as LessonManifest
  }

  const elements = createElementRegistry([...builtinElements, throwingPlugin()])

  it('produces one PLUGIN_VALIDATE_FAILED against that element', () => {
    const failures = checkLesson(lesson(), { elements }).issues.filter(
      (i) => i.code === 'PLUGIN_VALIDATE_FAILED',
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]!.location.elementId).toBe('bad')
    expect(failures[0]!.severity).toBe('error')
    // The message names the type, the element, and what was still checked.
    expect(failures[0]!.message).toContain('broken')
    expect(failures[0]!.message).toContain('bad')
  })

  it('still reports every other issue in the lesson', () => {
    const codes = checkLesson(lesson(), { elements }).issues.map((i) => i.code)
    expect(codes).toContain('TEXT_EMPTY')
    expect(codes).toContain('ELEMENT_BEYOND_SLIDE')
  })

  it('does not throw', () => {
    expect(() => checkLesson(lesson(), { elements })).not.toThrow()
  })
})
