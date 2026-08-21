import { afterEach, describe, expect, it } from 'vitest'
import { mount, type Mounted } from './harness/mount.js'
import { twoSlides } from './harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * FR-007a in the web component.
 *
 * **The assertion has to read the shadow root's `activeElement`.** `document.activeElement`
 * reports the *host* element when focus is inside a shadow root, so a test written against the
 * document passes whatever the adapter does — proving nothing while looking thorough.
 */
describe('focus after a slide change', () => {
  it('does not move on the first slide', async () => {
    const m = (mounted = await mount(twoSlides()))
    expect(m.root.activeElement, 'the host page keeps its focus on mount').toBeNull()
  })

  it('lands on the stage the learner arrived at', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)

    const stage = m.root.querySelector('.cs-stage:not([data-cs-transition="leaving"])')
    expect(m.root.activeElement, 'read the root, not the document').toBe(stage)
  })
})
