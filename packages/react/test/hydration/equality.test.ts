import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { expectCleanHydration, hydrate, server } from '../harness/render.js'
import { corpus } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'

/**
 * SC-003 / FR-005. Markup must be byte-identical at the moment control transfers.
 *
 * This is not a nicety: a learner who sees the page rearrange itself concludes the
 * product is broken, which is worse than having waited for it.
 */
describe('hydration equality', () => {
  it.each(corpus().map((c) => [c.name, c.lesson] as const))(
    '%s hydrates without changing the markup',
    async (_name, lesson) => {
      const markup = server(h(LessonPlayer, { lesson }))
      const result = await hydrate(h(LessonPlayer, { lesson }), markup)
      expect(result.after).toBe(result.before)
    },
  )

  it('the reference lesson hydrates cleanly on both counts', async () => {
    const lesson = corpus()[0]!.lesson
    const markup = server(h(LessonPlayer, { lesson }))
    expectCleanHydration(await hydrate(h(LessonPlayer, { lesson }), markup))
  })
})
