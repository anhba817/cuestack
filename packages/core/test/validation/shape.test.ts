import { describe, expect, it } from 'vitest'
import { checkLesson, SEMANTIC_CODES } from '../../src/validation/index.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { reportingPlugin, syntheticElement } from '../harness/plugins.js'
import { deadEnd, noAltText } from '../harness/faulty.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The shape of an issue, and the one field that makes the report usable at all.
 *
 * `source` is not decoration. `UNKNOWN_ELEMENT_TYPE` and `UNKNOWN_EFFECT_TYPE` are declared by
 * **both** `@cuestack/schema`'s `ISSUE_CODES` and the resolver's `RenderProblem`, meaning different
 * things at the two tiers — "no such type in the format" and "no such type in *this* registry". A
 * host branching on a code alone could not tell which it had, so two unions without a discriminator
 * would not have delivered what they were for (research R-03).
 */
const withGauge = (): LessonManifest => {
  const base = lessonOf({ slides: 1 })
  return {
    ...base,
    slides: [
      {
        ...base.slides[0]!,
        elements: [syntheticElement({ id: 'g1', type: 'gauge', payload: { value: 3 } })],
      },
    ],
  } as unknown as LessonManifest
}

describe('every issue', () => {
  it('carries a source, a code, a severity, a message, a path, and a location', () => {
    const report = checkLesson(deadEnd())
    expect(report.issues.length).toBeGreaterThan(0)

    for (const issue of report.issues) {
      expect(['schema', 'semantic', 'plugin']).toContain(issue.source)
      expect(typeof issue.code).toBe('string')
      expect(['error', 'warning']).toContain(issue.severity)
      expect(typeof issue.message).toBe('string')
      expect(Array.isArray(issue.path)).toBe(true)
      expect(typeof issue.location).toBe('object')
    }
  })

  it('distinguishes a code the two vocabularies share', () => {
    const elements = createElementRegistry([...builtinElements, reportingPlugin()])
    const report = checkLesson(withGauge(), { elements })

    const bySource = new Map<string, Set<string>>()
    for (const issue of report.issues) {
      bySource.set(issue.source, (bySource.get(issue.source) ?? new Set()).add(issue.code))
    }

    /**
     * A `gauge` fails the format's closed union *and* is a type the registry does know, so the
     * schema reports it and the resolver does not. Both tiers ran; the report says which is which.
     */
    expect(bySource.get('schema')).toBeDefined()
    expect(bySource.get('plugin')).toBeDefined()
    for (const [source, codes] of bySource) {
      expect(codes.size).toBeGreaterThan(0)
      expect(['schema', 'semantic', 'plugin']).toContain(source)
    }
  })

  it("supplies a plugin's path and location, because PluginIssue carries neither", () => {
    const elements = createElementRegistry([...builtinElements, reportingPlugin()])
    const issue = checkLesson(withGauge(), { elements }).issues.find(
      (i) => i.code === 'GAUGE_NEEDS_A_MAXIMUM',
    )!

    expect(issue.source).toBe('plugin')
    // A plugin sees a payload and nothing else — not which element it is, nor which slide.
    expect(issue.location).toEqual({ slideId: 'slide_0', slideIndex: 0, elementId: 'g1', elementIndex: 0 })
    expect(issue.path).toEqual(['slides', 0, 'elements', 0])
  })

  it('keeps the semantic union closed and separate from the schema package', () => {
    // Every semantic code the report can carry is declared, and the two that collide are both here
    // on purpose rather than by omission.
    expect(SEMANTIC_CODES).toContain('UNKNOWN_ELEMENT_TYPE')
    expect(SEMANTIC_CODES).toContain('UNKNOWN_EFFECT_TYPE')
    expect(new Set(SEMANTIC_CODES).size).toBe(SEMANTIC_CODES.length)

    for (const issue of checkLesson(noAltText()).issues) {
      if (issue.source === 'semantic') {
        expect(SEMANTIC_CODES as readonly string[]).toContain(issue.code)
      }
    }
  })

  it("does not constrain a plugin's code to anything core owns", () => {
    /**
     * `PluginIssue.code` is a `string` by design: a third-party element type reports faults core
     * has never heard of, and `source` is what keeps that from being a hole.
     */
    const elements = createElementRegistry([
      ...builtinElements,
      reportingPlugin('SOMETHING_CORE_HAS_NEVER_HEARD_OF'),
    ])
    const issue = checkLesson(withGauge(), { elements }).issues.find(
      (i) => i.code === 'SOMETHING_CORE_HAS_NEVER_HEARD_OF',
    )!
    expect(issue.source).toBe('plugin')
    expect(SEMANTIC_CODES as readonly string[]).not.toContain(issue.code)
  })
})
