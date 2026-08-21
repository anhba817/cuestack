import { afterEach, describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { tourLesson } from '../../../examples/nextjs/app/tour.js'
import { mount, rendered, type Mounted } from './harness/mount.js'
import { covers } from '../src/covered.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * SC-004: *the reference lesson* plays through this adapter in a page with no UI framework loaded.
 *
 * **Every other fixture in this suite was written here**, shaped by hand to exercise what the
 * adapter does — which is exactly the shape that hid FR-010 for the whole feature: four fixtures,
 * all single-slide, so nothing ever crossed a slide boundary and a player that could not change
 * slide passed every test. A lesson nobody wrote for this adapter is the only kind that can catch
 * the next one of those.
 *
 * `tourLesson` is the manifest the published example ships: three slides, text and a question,
 * `fade` and `slide` effects, and two authored transitions. Imported across packages from a **test**
 * directory, which T003's `src`-scoped dependency rules permit deliberately.
 */
describe('the reference lesson plays', () => {
  it('is a valid manifest, so a failure below is this adapter and not the fixture', () => {
    const result = validate(tourLesson)
    expect(result.ok, JSON.stringify('issues' in result ? result.issues : '')).toBe(true)
  })

  it('starts on the first slide and shows what that slide starts with', async () => {
    const m = (mounted = await mount(tourLesson))
    const nodes = rendered(m.root)
    expect(nodes.size, 'the first slide must render something').toBeGreaterThan(0)
  })

  it('advances in order and stops at the gate it cannot open, rather than skipping it', async () => {
    /**
     * **The expectation this test started with was wrong, and the adapter was right.**
     *
     * The first draft asserted every slide is reached. The tour's second slide advances
     * `after_interaction` on a question, and a question is one of the four types this adapter
     * declines — so it holds there and reports `ADVANCE_UNSATISFIABLE`. Reaching slide three would
     * mean *skipping the gate*, which is the specified failure: a learner carried past a question
     * they were required to answer.
     *
     * So the assertion is the shape of the wall, derived from the manifest rather than hard-coded:
     * every slide up to and including the first interaction gate, and no further.
     */
    const firstGate = tourLesson.slides.findIndex(
      (slide) => (slide.advance as { mode?: string }).mode === 'after_interaction',
    )
    expect(firstGate, 'the reference lesson is expected to contain an interaction gate').toBeGreaterThanOrEqual(0)

    const seen: number[] = []
    let completed = 0
    const m = (mounted = await mount(tourLesson, {
      on: {
        'cuestack:slide': (e) => seen.push((e as CustomEvent<{ index: number }>).detail.index),
        'cuestack:completed': () => (completed += 1),
      },
    }))

    // Well past the sum of the authored durations, in the harness's 100ms steps.
    await m.advance(60_000)

    expect(seen, 'every slide up to the gate, in order, and none after it').toEqual(
      Array.from({ length: firstGate + 1 }, (_, i) => i),
    )
    // And it must not claim the lesson finished, because it did not.
    expect(completed, 'a lesson stopped at a gate has not completed').toBe(0)
  })

  it('renders every element it covers, and reports every one it does not', async () => {
    const m = (mounted = await mount(tourLesson))

    // Only the slides this adapter can actually reach — past the gate it never arrives, so asking
    // about those slides' elements would be asserting something no learner here ever sees.
    const reachable = tourLesson.slides.slice(
      0,
      (tourLesson.slides.findIndex((s) => (s.advance as { mode?: string }).mode === 'after_interaction') + 1) ||
        tourLesson.slides.length,
    )
    for (const [index, slide] of reachable.entries()) {
      if (index > 0) await m.advance(8000)
      const nodes = rendered(m.root)

      for (const element of slide.elements) {
        const node = nodes.get(element.id)
        if (!node) continue
        const unavailable = node.dataset['csUnavailable'] === 'true'
        // The claim SC-006 makes, checked against a lesson written by somebody else: a type this
        // adapter covers is drawn, and one it does not is *reported* rather than left as a gap.
        expect(unavailable, `${element.type} "${element.id}"`).toBe(!covers(element.type))
      }
    }
  })

  it('tells a learner when the lesson cannot go further here', async () => {
    /**
     * The tour's third slide advances on a question — an interaction this adapter declines. The
     * point of playing a real lesson is that this case arrives on its own rather than being staged.
     */
    const problems: Array<{ code: string }> = []
    const m = (mounted = await mount(tourLesson, {
      on: { 'cuestack:problem': (e) => problems.push((e as CustomEvent<{ code: string }>).detail) },
    }))
    await m.advance(60_000)

    const gated = tourLesson.slides.some(
      (slide) => (slide.advance as { mode?: string }).mode === 'after_interaction',
    )
    if (gated) {
      expect(problems.map((p) => p.code)).toContain('ADVANCE_UNSATISFIABLE')
    } else {
      // Recorded rather than skipped: if the reference lesson stops gating on an interaction, this
      // test stops covering the case and should say so out loud.
      expect(problems, 'the reference lesson no longer gates on an interaction').toEqual([])
    }
  })
})
