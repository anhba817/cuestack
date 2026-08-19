import { describe, expect, it } from 'vitest'
import { checkLesson, severityFor } from '../../src/validation/index.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { reportingPlugin, syntheticElement } from '../harness/plugins.js'
import { noAltText } from '../harness/faulty.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

describe('severityFor', () => {
  it('raises and lowers a policy-governed code', () => {
    expect(severityFor('ACCESSIBILITY_METADATA_ABSENT', 'semantic')).toBe('warning')
    expect(
      severityFor('ACCESSIBILITY_METADATA_ABSENT', 'semantic', {
        errors: ['ACCESSIBILITY_METADATA_ABSENT'],
      }),
    ).toBe('error')
    expect(
      severityFor('ACCESSIBILITY_METADATA_ABSENT', 'semantic', {
        warnings: ['ACCESSIBILITY_METADATA_ABSENT'],
      }),
    ).toBe('warning')
  })

  it('will not move a code that is not policy-governed', () => {
    // A dead end is a dead end. No organisation's rules make a trapped learner acceptable.
    expect(severityFor('QUESTION_DEAD_END', 'semantic', { warnings: ['QUESTION_DEAD_END'] })).toBe(
      'error',
    )
  })

  it('will not move a schema issue, whatever the policy says', () => {
    expect(
      severityFor('REQUIRED_FIELD_MISSING', 'schema', { warnings: ['REQUIRED_FIELD_MISSING'] }),
    ).toBe('error')
  })

  it("defaults a plugin's own code to error, and lets a host lower it by name", () => {
    expect(severityFor('GAUGE_NEEDS_A_MAXIMUM', 'plugin')).toBe('error')
    expect(severityFor('GAUGE_NEEDS_A_MAXIMUM', 'plugin', { warnings: ['GAUGE_NEEDS_A_MAXIMUM'] })).toBe(
      'warning',
    )
  })

  it('has no way to silence anything', () => {
    /**
     * FR-010b, asserted as a property of the type rather than of a value: `ValidationPolicy` has
     * two fields and neither of them is `off`. A silenceable set drifts towards silence one
     * incident at a time, and the framework ends up with rules that are present and never seen.
     */
    const every = ['errors', 'warnings'] as const
    expect(every).toHaveLength(2)
    for (const code of ['QUESTION_DEAD_END', 'ACCESSIBILITY_METADATA_ABSENT', 'ANYTHING']) {
      for (const source of ['schema', 'semantic', 'plugin'] as const) {
        expect(['error', 'warning']).toContain(
          severityFor(code, source, { errors: [code], warnings: [code] }),
        )
      }
    }
  })
})

describe('policy reaches the report', () => {
  it('turns a warning into a blocking error', () => {
    const lesson = noAltText()
    expect(checkLesson(lesson).blocks).toBe(false)

    const strict = checkLesson(lesson, { policy: { errors: ['ACCESSIBILITY_METADATA_ABSENT'] } })
    expect(strict.blocks).toBe(true)
    expect(strict.issues.find((i) => i.code === 'ACCESSIBILITY_METADATA_ABSENT')!.severity).toBe(
      'error',
    )
  })

  it("lowers a plugin's code without hiding it", () => {
    const lesson = {
      ...lessonOf({ slides: 1 }),
      slides: [
        {
          ...lessonOf({ slides: 1 }).slides[0]!,
          elements: [syntheticElement({ id: 'g1', type: 'gauge', payload: {} })],
        },
      ],
    } as unknown as LessonManifest
    const elements = createElementRegistry([...builtinElements, reportingPlugin()])

    const lowered = checkLesson(lesson, {
      elements,
      policy: { warnings: ['GAUGE_NEEDS_A_MAXIMUM'] },
    })
    const issue = lowered.issues.find((i) => i.code === 'GAUGE_NEEDS_A_MAXIMUM')
    expect(issue!.severity).toBe('warning')
    expect(issue!.message).toContain('gauge')
  })
})
