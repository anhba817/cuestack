import { afterEach, describe, expect, it } from 'vitest'
import { mount, type Mounted } from '../harness/mount.js'
import { dense, denseWithTransition } from '../harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * Constitution IV, for the work this adapter does that the React player does not.
 *
 * **Why this exists at all.** plan.md's Principle IV row reads "Pass, and no budget is touched —
 * the adapter computes what the React player computes, from the same kernel." That was true when it
 * was written and stopped being true when transitions arrived: a slide change now deep-clones the
 * entire outgoing stage, which on a dense slide is a few hundred nodes copied inside one frame, and
 * no gate anywhere measured it. An assessment can go stale the same way a comment can.
 *
 * **What a pass here does not mean**, stated with the measured numbers rather than in general.
 * happy-dom has no compositor, so nothing below measures paint — the same caveat `gates/perf.mjs`
 * states at length, and for the same reason. On a 55-element slide the per-frame work measures
 * ~1.6ms against a 15ms budget, and a full stage clone costs ~0.015ms. **That is a ninefold margin,
 * and it means the wall-clock assertions catch only a gross regression.** Forty additional clones
 * per slide change do not trip them — tried, as a control.
 *
 * So the timing budget is kept for the gross case, and the *invariant* that actually protects the
 * frame is asserted directly below it: structure is built once per element and per-frame work is
 * style writing. A rebuild-every-frame regression is invisible to a stopwatch in a DOM with no
 * layout, and obvious to a node-identity check.
 */

/** The frame budget, at the 60fps target the rest of the repository holds. */
const FRAME_MS = 16.7
/** The same 10% margin the other budgets keep, so a regression fails with room left. */
const MARGIN = 0.9

const median = (samples: number[]): number => {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

describe('the adapter holds the frame budget', () => {
  it('draws a dense slide inside a frame', async () => {
    const m = (mounted = await mount(dense()))

    const samples: number[] = []
    for (let i = 0; i < 20; i += 1) {
      const before = performance.now()
      await m.advance(100)
      samples.push(performance.now() - before)
    }

    // Median rather than mean: one scheduling hiccup in a shared CI runner is not a regression, and
    // a mean lets a single outlier fail a build that is fine.
    expect(median(samples), 'per-frame work on a dense slide').toBeLessThan(FRAME_MS * MARGIN)
  })

  it('builds each element structure once, not once per frame', async () => {
    /**
     * The design invariant the frame budget rests on, and the one a stopwatch cannot see here: the
     * loop writes styles and does not rebuild nodes. An adapter that recreated its elements every
     * frame would cost the same ~1.6ms in happy-dom — where there is no layout to invalidate — and
     * would drop frames in a browser at the first non-trivial slide.
     */
    const m = (mounted = await mount(dense()))
    const identity = (): Element[] => [...m.root.querySelectorAll('[data-cs-element-id]')]

    const first = identity()
    expect(first).toHaveLength(55)
    const firstChildren = first.map((node) => node.firstElementChild)

    await m.advance(1000)

    const later = identity()
    expect(later).toHaveLength(55)
    // Same nodes, not equal-looking replacements. `toBe` per node is the whole assertion.
    later.forEach((node, i) => expect(node).toBe(first[i]))
    later.forEach((node, i) => expect(node.firstElementChild).toBe(firstChildren[i]))
  })

  it('changes slide with a transition inside a frame, clone included', async () => {
    /**
     * The measurement the plan's assessment predates. `cloneNode(true)` copies the whole outgoing
     * stage; on a slide carrying 55 elements that is the densest single frame this adapter ever
     * runs, and it happens at exactly the moment a learner is watching something move.
     */
    const m = (mounted = await mount(denseWithTransition()))
    await m.advance(3900)

    const before = performance.now()
    // The 100ms step that crosses the boundary: advance, enter, clone, and draw the arriving slide.
    await m.advance(200)
    const crossing = performance.now() - before

    // Two frames of work in that step, so the budget is two frames rather than one.
    expect(crossing, 'slide change including the stage clone').toBeLessThan(FRAME_MS * 2 * MARGIN)
  })
})
