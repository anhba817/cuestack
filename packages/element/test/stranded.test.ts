import { afterEach, describe, expect, it } from 'vitest'
import { mount } from './harness/mount.js'
import { stranding, strandThenPlain, timedWithRequiredQuestion } from './harness/lessons.js'

let mounted: { unmount(): void } | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * The sharp case, and the one a subset adapter is most likely to get wrong by omission.
 *
 * A slide that advances `after_interaction` on a question this adapter cannot render can never be
 * left. `resolve` already returns `blockingUnknownRequired` for exactly this shape — the adapter's
 * job is to surface it, so a learner is told rather than sitting on a slide that never ends.
 */
describe('a slide gated on something this adapter cannot show', () => {
  it('reports that it cannot advance', async () => {
    const m = (mounted = await mount(stranding()))
    await m.advance(9000)

    const problem = m.root.querySelector('[data-cs-problem]')
    expect(problem, 'a learner must be told, not stranded').toBeTruthy()
    expect(problem!.textContent?.trim().length).toBeGreaterThan(20)
  })

  it('emits the problem as an event, so a host can act on it', async () => {
    const seen: unknown[] = []
    // Listening before connect, which is what a host does: `addEventListener` then `append`.
    const m = (mounted = await mount(stranding(), {
      on: { 'cuestack:problem': (e) => seen.push((e as CustomEvent).detail) },
    }))
    await m.advance(9000)

    expect(seen.length).toBeGreaterThan(0)
    expect((seen[0] as { slideId: string }).slideId).toBe('slide_0')
  })

  it('still shows what it can on that slide', async () => {
    // Reporting the gate must not blank the slide — the text element is fine and a learner should
    // see it while being told why nothing moves.
    const m = (mounted = await mount(stranding()))
    expect(m.root.querySelector('[data-cs-element-id="prompt"]')?.textContent).toContain('Answer')
  })
})

/**
 * A problem belongs to the slide showing it, and to the visit.
 *
 * **Both of these were defects, and both were unreachable until `seekToSlide` shipped.** The only
 * stranding fixture gated on a question and therefore never advanced, so in ninety-five tests
 * nothing ever left a problem behind. A new API enlarges the state space; the fixtures have to grow
 * with it or the new states are untested by construction — the same shape as the single-slide
 * fixtures that hid FR-010's transitions.
 */
describe('a problem does not outlive the slide that has it', () => {
  it('is gone when the learner moves on', async () => {
    const m = (mounted = await mount(strandThenPlain()))
    await m.advance(5000)
    expect(m.root.querySelectorAll('[data-cs-problem]')).toHaveLength(1)

    ;(m.element as unknown as { seekToSlide(id: string): void }).seekToSlide('slide_1')
    await m.advance(500)

    // The notice was appended once and never removed, so it followed a learner onto a slide with no
    // question and told them to answer one.
    expect(
      m.root.querySelectorAll('[data-cs-problem]'),
      'the notice must not follow a learner to a slide it does not describe',
    ).toHaveLength(0)
    expect(m.root.querySelector('[data-cs-element-id="after"]')).toBeTruthy()
  })

  it('is reported again when the learner comes back', async () => {
    /**
     * The `#announcedComplete` shape a second time: a `Set` keyed `slideId:code` outlives the visit
     * it describes, so a learner returning to a wall was told nothing and a host counting problems
     * missed every repeat.
     */
    const seen: string[] = []
    const m = (mounted = await mount(strandThenPlain(), {
      on: { 'cuestack:problem': (e) => seen.push((e as CustomEvent<{ code: string }>).detail.code) },
    }))
    await m.advance(5000)
    expect(seen).toHaveLength(1)

    const element = m.element as unknown as { seekToSlide(id: string): void }
    element.seekToSlide('slide_1')
    await m.advance(500)
    element.seekToSlide('slide_0')
    await m.advance(5000)

    expect(seen, 'a learner back at the wall must be told again').toHaveLength(2)
    expect(m.root.querySelectorAll('[data-cs-problem]')).toHaveLength(1)
  })

  it('reports once per visit, not once per frame', async () => {
    // The reason the Set existed. Whatever replaces it must still not flood a host or the stage.
    const seen: string[] = []
    const m = (mounted = await mount(strandThenPlain(), {
      on: { 'cuestack:problem': (e) => seen.push((e as CustomEvent<{ code: string }>).detail.code) },
    }))
    await m.advance(8000)
    expect(seen, 'one report for one visit').toHaveLength(1)
    expect(m.root.querySelectorAll('[data-cs-problem]'), 'one notice, not one per frame').toHaveLength(1)
  })
})

/**
 * BR-005 reaches every advance mode, and this adapter's stranding check did not.
 *
 * `completedInteractions` here is permanently empty — the adapter renders no interactions — so a
 * required question blocks leaving *any* slide carrying it, including a timed one. The check
 * covered `after_interaction` only, so such a slide never advanced and nothing said why: a learner
 * sat on a timed slide that silently never ended. Shipped in feature 011.
 */
describe('a required question this player cannot show', () => {
  it('is reported on a timed slide, not only on a gated one', async () => {
    const m = (mounted = await mount(timedWithRequiredQuestion()))
    await m.advance(6000)

    const problem = m.root.querySelector('[data-cs-problem]')
    expect(problem, 'a slide that never ends must say so, whatever its advance mode').toBeTruthy()
    expect(problem?.textContent ?? '').toMatch(/cannot show/)
  })
})
