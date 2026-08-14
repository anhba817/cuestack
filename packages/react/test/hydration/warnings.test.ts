import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { hydrate, server } from '../harness/render.js'
import { corpus } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'

/**
 * SC-002 / FR-006. Zero mismatch warnings.
 *
 * React reports a mismatch through console.error rather than by throwing, so a test
 * that merely rendered would pass with warnings streaming past. The assertion is on
 * the console (research R-07).
 */
describe('hydration warnings', () => {
  it.each(corpus().map((c) => [c.name, c.lesson] as const))(
    '%s emits no mismatch warning',
    async (_name, lesson) => {
      const markup = server(h(LessonPlayer, { lesson }))
      const { warnings } = await hydrate(h(LessonPlayer, { lesson }), markup)
      const mismatches = warnings.filter((w) =>
        /hydrat|did not match|mismatch|server render/i.test(w),
      )
      expect(mismatches, mismatches.join('\n')).toEqual([])
    },
  )

  it('the console guard would actually catch a mismatch', async () => {
    // A deliberately different tree on the client. If the guard were inert, this
    // would pass silently and every assertion above would be worthless.
    const lesson = corpus()[0]!.lesson
    const markup = server(h(LessonPlayer, { lesson }))
    const { warnings } = await hydrate(
      h('div', null, h('span', null, 'completely different')),
      markup,
    )
    expect(warnings.length).toBeGreaterThan(0)
  })
})
