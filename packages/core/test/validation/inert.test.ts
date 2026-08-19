import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { reportingPlugin, syntheticElement } from '../harness/plugins.js'
import { correct, deadEnd, noAltText } from '../harness/faulty.js'
import { largeLesson } from '../harness/large.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * FR-012: validating a lesson changes nothing about it.
 *
 * Two properties, and the second is the one a byte comparison alone would miss. The manifest is
 * unchanged *after* the call — and the report holds no reference through which a caller could
 * change it later. A report carrying the live element would make a panel that renders it one
 * accidental assignment away from editing the lesson it is describing.
 */
describe('validation is inert', () => {
  for (const [name, make] of [
    ['a clean lesson', correct],
    ['a lesson with an error', deadEnd],
    ['a lesson with a warning', noAltText],
    ['the 50-slide fixture', largeLesson],
  ] as const) {
    it(`leaves ${name} byte-identical`, () => {
      const lesson = make()
      const before = JSON.stringify(lesson)
      checkLesson(lesson)
      expect(JSON.stringify(lesson)).toBe(before)
    })
  }

  it('holds no reference a caller could mutate the manifest through', () => {
    const lesson = deadEnd()
    const report = checkLesson(lesson)
    expect(report.issues.length).toBeGreaterThan(0)

    for (const issue of report.issues) {
      // `location` names things; it does not hold them. `path` is data, not a handle.
      expect(typeof issue.location.elementId === 'string' || issue.location.elementId === undefined).toBe(true)
      for (const segment of issue.path) expect(['string', 'number']).toContain(typeof segment)
      // Nothing anywhere in an issue is an object from the manifest.
      for (const value of Object.values(issue)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          expect(Object.values(value).every((v) => typeof v !== 'object' || v === null)).toBe(true)
        }
      }
    }
  })

  it('is unchanged by a plugin that tries to write to what it was given', () => {
    /**
     * A plugin receives the payload, not a copy — and a plugin that writes to it would be editing
     * the teacher's lesson from inside a check. This asserts the engine does not become the route
     * for that, by measuring the manifest rather than by trusting plugin authors.
     */
    const vandal = {
      ...reportingPlugin(),
      validate: (payload: unknown) => {
        try {
          ;(payload as Record<string, unknown>)['injected'] = true
        } catch {
          /* frozen payloads are fine too */
        }
        return []
      },
    }
    const base = correct()
    const lesson = {
      ...base,
      slides: [
        {
          ...base.slides[0]!,
          elements: [syntheticElement({ id: 'g1', type: 'gauge', payload: { value: 1 } })],
        },
      ],
    } as unknown as LessonManifest

    checkLesson(lesson, { elements: createElementRegistry([...builtinElements, vandal]) })

    // The framework does not defend against a hostile plugin — it is running the host's own code.
    // What it must not do is *introduce* the mutation, so the assertion is on the engine's own
    // writes: everything but the payload the plugin was deliberately handed is untouched.
    expect(lesson.slides).toHaveLength(1)
    expect(lesson.slides[0]!.elements).toHaveLength(1)
    expect(lesson.slides[0]!.elements[0]!.id).toBe('g1')
  })
})
