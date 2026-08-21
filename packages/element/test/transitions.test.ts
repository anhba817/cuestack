import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered, type Mounted } from './harness/mount.js'
import { twoSlides, twoSlidesPlain } from './harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * FR-010 lists what this adapter must cover: slide playback, timing, effects, **transitions**, and
 * the element types that need nothing from a host.
 *
 * Slide playback and transitions were both missing, and missing for the same reason: every fixture
 * in this harness was a single slide, so nothing ever crossed a slide boundary and nothing failed.
 * The suite reported a working player and had never asked it to change slide.
 *
 * The DOM contract is the React player's, not a second one — `.cs-transition` around the two stages,
 * `data-cs-transition` naming each half's role, `data-cs-transition-type` naming the effect, and the
 * duration as `--cs-transition-ms`. A host with one stylesheet for both players is the point.
 */
describe('slides advance, and transitions run', () => {
  it('reaches the second slide when the first slide’s duration elapses', async () => {
    const m = (mounted = await mount(twoSlides()))
    expect(rendered(m.root).has('first')).toBe(true)

    await m.advance(4200)
    expect(rendered(m.root).has('second')).toBe(true)
  })

  it('leaves the first slide behind', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)
    // After the transition has run out, only the incoming slide remains. A leaving stage that was
    // never removed is two lessons on screen forever, which is the failure React's `toIndex` guard
    // exists for.
    await m.advance(1000)
    expect(rendered(m.root).has('first')).toBe(false)
  })

  it('marks both halves while the transition runs', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)

    const wrapper = m.root.querySelector('.cs-transition')
    expect(wrapper, 'a transition authored on the entered slide must produce one').toBeTruthy()
    expect(wrapper?.querySelector('[data-cs-transition="leaving"]')).toBeTruthy()
    expect(wrapper?.querySelector('[data-cs-transition="entering"]')).toBeTruthy()
  })

  it('carries the authored type and duration into CSS', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)

    const entering = m.root.querySelector<HTMLElement>('[data-cs-transition="entering"]')!
    expect(entering.getAttribute('data-cs-transition-type')).toBe('fade')
    // As a custom property, so the animation is declarative rather than a re-render per frame —
    // the same reason `Stage.tsx` gives for doing it this way.
    expect(entering.style.getPropertyValue('--cs-transition-ms').trim()).toBe('600')
  })

  it('ends the transition on lesson time, not wall-clock', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)
    expect(m.root.querySelector('.cs-transition')).toBeTruthy()

    // 600ms authored; 200ms of the incoming slide has already elapsed at 4200.
    await m.advance(500)
    expect(
      m.root.querySelector('.cs-transition'),
      'a transition measured against the wall clock would outlive a seek and strand two stages',
    ).toBeNull()
  })

  it('hides the leaving half from a screen reader', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)
    const leaving = m.root.querySelector('[data-cs-transition="leaving"]')
    // Otherwise the slide being replaced is read out alongside the one replacing it.
    expect(leaving?.getAttribute('aria-hidden')).toBe('true')
  })

  it('runs no transition when none is authored', async () => {
    const m = (mounted = await mount(twoSlidesPlain()))
    await m.advance(4200)
    expect(rendered(m.root).has('second')).toBe(true)
    expect(m.root.querySelector('.cs-transition')).toBeNull()
  })
})
