import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { corpus, referenceLesson } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * SC-006 · NFR-PERF-006: the first slide is renderable within 2 seconds of the lesson data
 * being available, excluding media download.
 *
 * What is measured is what the player controls: resolving time zero and producing markup.
 * Not the network, not the host's data fetch, not the bytes of a video — none of which this
 * package can affect, and including them would make the budget a measure of somebody else's
 * work.
 *
 * The budget is 2000 ms and a server render is three orders of magnitude under it, which is
 * the point rather than a boast: **the architecture is what buys this, not the speed of the
 * code.** `resolve()` is a fold over authored data with no clock, no DOM, and no I/O, so
 * there is nothing in the path that can be slow. A design that measured a container, or
 * waited for a font, or replayed effects from zero, would have to defend this number.
 *
 * A generous headroom factor is used deliberately. A tight assertion on a shared CI runner
 * fails for reasons that have nothing to do with the code, and a flaky performance gate is
 * one that gets ignored and then removed.
 */

const BUDGET_MS = 2000

/** Wall-clock for one server render, best of several to reduce scheduler noise. */
function fastest(render: () => void, runs = 5): number {
  let best = Infinity
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now()
    render()
    best = Math.min(best, performance.now() - started)
  }
  return best
}

describe('the first slide is ready well inside its budget', () => {
  it('renders the reference lesson far under 2 seconds', () => {
    const elapsed = fastest(() => server(h(LessonPlayer, { lesson: referenceLesson })))
    expect(elapsed).toBeLessThan(BUDGET_MS)
    // Two orders of magnitude of headroom. If this ever fails while the assertion above
    // passes, something has entered the render path that does real work — which is the
    // change worth noticing, long before the budget itself is at risk.
    expect(elapsed).toBeLessThan(BUDGET_MS / 100)
  })

  it.each(corpus().map((entry) => [entry.name, entry.lesson] as const))(
    'renders %s inside the budget',
    (_name, lesson) => {
      expect(fastest(() => server(h(LessonPlayer, { lesson })))).toBeLessThan(BUDGET_MS)
    },
  )

  it('costs about the same for a slide with content as for an empty one', () => {
    // The claim being defended: nothing in the path scales with anything but element count.
    // A render that waited on a font, a measurement, or an asset would show up here as a
    // difference between an empty stage and a full one that has no arithmetic explanation.
    const empty = fastest(() => server(h(LessonPlayer, { lesson: corpus()[4]!.lesson })))
    const full = fastest(() => server(h(LessonPlayer, { lesson: corpus()[1]!.lesson })))
    expect(full).toBeLessThan(Math.max(empty * 50, 20))
  })

  it('renders nothing asynchronously — the markup is complete when it returns', () => {
    // `renderToString` is synchronous, so a Suspense boundary or an async component in the
    // path would surface as a fallback in the output rather than as a slow render. A
    // spinner in server-rendered HTML is the failure SC-006 is really about.
    const markup = server(h(LessonPlayer, { lesson: referenceLesson, slideIndex: 1 }))
    expect(markup).not.toMatch(/loading|spinner|skeleton/i)
    expect(markup).toContain('cs-stage')
  })
})
