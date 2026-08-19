import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import type { ElementPlugin } from '../../src/elements/contract.js'
import { reportingPlugin, syntheticElement } from '../harness/plugins.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * SC-001: type-specific knowledge comes from the registry, never from a branch in the engine.
 *
 * Both halves are asserted, and the second is the one that makes the first mean anything. A suite
 * that only exercised an invented type would pass against an engine that validates nothing a
 * teacher can actually author — which is the state this framework was in until the seven builtins
 * arrived, with `ElementPlugin.validate` declared and never implemented by anyone.
 */
function lessonWith(elements: unknown[]): LessonManifest {
  const lesson = lessonOf({ slides: 1 })
  return {
    ...lesson,
    slides: [{ ...lesson.slides[0]!, elements }],
  } as unknown as LessonManifest
}

describe('the engine has no branch on element type', () => {
  it('reports a plugin\'s issue for a type core has never heard of', () => {
    const lesson = lessonWith([
      syntheticElement({ id: 'g1', type: 'gauge', payload: { value: 3 } }),
    ])
    const elements = createElementRegistry([...builtinElements, reportingPlugin()])

    const issue = checkLesson(lesson, { elements }).issues.find(
      (i) => i.code === 'GAUGE_NEEDS_A_MAXIMUM',
    )
    expect(issue).toBeDefined()
    expect(issue!.source).toBe('plugin')
    // A plugin sees a payload and nothing else, so the engine supplies where it was.
    expect(issue!.location.elementId).toBe('g1')
    expect(issue!.location.slideId).toBe('slide_0')
    expect(issue!.path).toEqual(['slides', 0, 'elements', 0])
  })

  it('consults every one of the seven MVP types', () => {
    const consulted: string[] = []
    const spied = builtinElements.map(
      (plugin): ElementPlugin => ({
        ...plugin,
        validate: (payload) => {
          consulted.push(plugin.type)
          return plugin.validate(payload)
        },
      }),
    )

    const lesson = lessonWith(
      spied.map((plugin, index) =>
        syntheticElement({ id: `e${index}`, type: plugin.type, payload: {} }),
      ),
    )
    checkLesson(lesson, { elements: createElementRegistry(spied) })

    expect([...consulted].sort()).toEqual(
      ['audio', 'button', 'image', 'question', 'shape', 'text', 'video'].sort(),
    )
  })

  it("reports the builtins' own findings from a lesson a teacher could author", () => {
    const lesson = lessonWith([
      syntheticElement({ id: 't1', type: 'text', payload: { text: '   ' } }),
      syntheticElement({
        id: 'b1',
        type: 'button',
        payload: { label: 'Go', action: 'open_url' },
      }),
    ])

    const codes = checkLesson(lesson).issues.filter((i) => i.source === 'plugin').map((i) => i.code)
    expect(codes).toContain('TEXT_EMPTY')
    expect(codes).toContain('BUTTON_URL_ABSENT')
  })
})
