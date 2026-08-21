import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered } from './harness/mount.js'
import { covered } from './harness/lessons.js'

let mounted: { unmount(): void } | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * The claim DX-2 exists to test: a lesson plays with no UI framework present.
 *
 * Nothing here waits on wall-clock time — the clock is injected and advanced by hand, which is what
 * Constitution II asks for and what makes an assertion about a four-second boundary take no time.
 */
describe('a lesson plays', () => {
  it('shows the elements the first slide starts with', async () => {
    const m = (mounted = await mount(covered()))
    const nodes = rendered(m.root)
    expect(nodes.has('title')).toBe(true)
    expect(nodes.has('box')).toBe(true)
  })

  it('renders text as text', async () => {
    const m = (mounted = await mount(covered()))
    expect(rendered(m.root).get('title')!.textContent).toBe('Photosynthesis')
  })

  it('brings an element in at its own start time, with no seek', async () => {
    /**
     * The element enters at 4000ms. Asserting it *after* advancing rather than by seeking is the
     * case feature 007 found the React suite had been missing: a seek re-renders, so a suite that
     * only seeks never exercises an element appearing during playback.
     */
    const m = (mounted = await mount(covered()))
    expect(rendered(m.root).has('later')).toBe(false)

    await m.advance(4500)
    expect(rendered(m.root).has('later')).toBe(true)
  })

  it('positions elements from the manifest geometry', async () => {
    const m = (mounted = await mount(covered()))
    const box = rendered(m.root).get('box')!
    // Geometry travels as custom properties, the same mechanism the React player uses.
    expect(box.style.getPropertyValue('--cs-y')).toBe('200')
  })

  it('puts everything inside a shadow root rather than the page', async () => {
    const m = (mounted = await mount(covered()))
    expect(m.root).toBeTruthy()
    expect(document.querySelector('[data-cs-element-id]')).toBeNull()
  })
})
