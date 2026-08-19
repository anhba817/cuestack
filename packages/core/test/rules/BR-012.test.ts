import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import type { ElementPlugin } from '../../src/elements/contract.js'
import { noAltText } from '../harness/faulty.js'

/**
 * BR-012: accessibility metadata, enforced as an error or a warning by organisation policy.
 *
 * The rule belongs to the engine and this suite asserts that structurally rather than by comment.
 * `accessibility` is a **common** element field sitting beside `payload`, so
 * `ElementPlugin.validate(payload)` cannot see it — a plugin could not implement this rule if it
 * wanted to, and a version that depended on every plugin author implementing it identically would
 * be a policy-governed rule with as many behaviours as there are element authors (research R-10).
 */
describe('BR-012', () => {
  it('is reported every time the metadata is missing', () => {
    const issues = checkLesson(noAltText()).issues.filter(
      (i) => i.code === 'ACCESSIBILITY_METADATA_ABSENT',
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]!.location.elementId).toBe('img')
    expect(issues[0]!.severity).toBe('warning')
  })

  it('is an error under a policy that says so, and a warning under one that does not', () => {
    expect(
      checkLesson(noAltText(), { policy: { errors: ['ACCESSIBILITY_METADATA_ABSENT'] } }).issues[0]!
        .severity,
    ).toBe('error')
    expect(
      checkLesson(noAltText(), { policy: { warnings: ['ACCESSIBILITY_METADATA_ABSENT'] } }).issues[0]!
        .severity,
    ).toBe('warning')
  })

  it('cannot be made to disappear', () => {
    for (const policy of [
      { warnings: ['ACCESSIBILITY_METADATA_ABSENT'] },
      { errors: ['ACCESSIBILITY_METADATA_ABSENT'], warnings: ['ACCESSIBILITY_METADATA_ABSENT'] },
    ]) {
      expect(
        checkLesson(noAltText(), { policy }).issues.some(
          (i) => i.code === 'ACCESSIBILITY_METADATA_ABSENT',
        ),
      ).toBe(true)
    }
  })

  it('is reported for a type whose plugin has no validate of its own', () => {
    /**
     * The image plugin's `validate` returns nothing — the format already checks its payload. If
     * this rule lived in plugins, this element would go unreported, which is the failure the whole
     * suite exists to catch.
     */
    const stripped = builtinElements.map(
      (plugin): ElementPlugin => ({ ...plugin, validate: () => [] }),
    )
    const report = checkLesson(noAltText(), { elements: createElementRegistry(stripped) })
    expect(report.issues.map((i) => i.code)).toEqual(['ACCESSIBILITY_METADATA_ABSENT'])
  })
})
