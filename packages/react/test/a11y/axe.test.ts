import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import axe from 'axe-core'
import { corpus } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'

/**
 * SC-010 · Constitution III.
 *
 * axe over every corpus slide, at WCAG 2.2 AA. This is the gate `gates/a11y.mjs` runs,
 * and it is a merge gate from this feature onward.
 *
 * **What this does not prove.** Automated checking catches roughly half of real
 * accessibility defects (research R-05). The half it catches is the half that regresses
 * silently — a missing accessible name is invisible when you can see the screen. It
 * cannot tell whether a focus order makes sense, whether an announcement is intelligible,
 * or whether a lesson is usable. None of this substitutes for a screen-reader review,
 * which belongs in the merge review rather than in CI.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** A host resolver, so images and media render as themselves rather than as fallbacks —
 *  the fallback has its own accessibility obligations and its own assertions below. */
const resolveAsset = (ref: { assetId: string }): string =>
  /^(https?:|\/|\.\/|data:)/.test(ref.assetId) ? ref.assetId : `https://example.test/${ref.assetId}`

async function violations(node: HTMLElement): Promise<axe.Result[]> {
  const result = await axe.run(node, {
    runOnly: { type: 'tag', values: TAGS },
    // Colour contrast needs real layout and painted pixels; happy-dom has neither, so
    // the check would report nothing and look like a pass. Contrast is enforced by the
    // theme's own tokens and belongs in the screen-reader-and-eyes review.
    rules: { 'color-contrast': { enabled: false } },
  })
  return result.violations
}

const describeViolation = (v: axe.Result): string =>
  `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.html).join('\n    ')}`

describe('every corpus slide passes axe at WCAG 2.2 AA', () => {
  for (const entry of corpus()) {
    it(`has no violations: ${entry.name}`, async () => {
      const container = await client(
        h(LessonPlayer, { lesson: entry.lesson, ports: testPorts(), resolveAsset }),
      )
      const found = await violations(container)
      expect(found.map(describeViolation).join('\n'), `${found.length} violation(s)`).toBe('')
    })
  }

  it('checks slides that actually contain content', async () => {
    // An axe sweep over an empty container reports nothing and reads as a pass. The
    // corpus must include a slide with elements in it, or this suite proves nothing.
    const withContent = corpus().find((e) => e.name === 'all element types')!
    const container = await client(
      h(LessonPlayer, { lesson: withContent.lesson, ports: testPorts(), resolveAsset }),
    )
    expect(container.querySelectorAll('[data-cs-element-id]').length).toBeGreaterThan(5)
  })

  it('has no violations when assets fail to resolve', async () => {
    // The fallback state is learner-facing too, and it is the state a lesson reaches
    // when a host misconfigures asset resolution — so more likely to be seen than not.
    const withContent = corpus().find((e) => e.name === 'all element types')!
    const container = await client(h(LessonPlayer, { lesson: withContent.lesson, ports: testPorts() }))
    const found = await violations(container)
    expect(found.map(describeViolation).join('\n')).toBe('')
  })
})
