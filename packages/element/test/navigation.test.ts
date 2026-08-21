import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered, type Mounted } from './harness/mount.js'
import { withButton, gatedWithControls } from './harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const control = (m: Mounted, id: string): HTMLButtonElement =>
  m.root.querySelector<HTMLButtonElement>(`[data-cs-element-id="${id}"] button`)!

/**
 * The web component navigates too, and builds its own capability.
 *
 * `button` joined `COVERED` with this feature: it was the only declined type whose exclusion had
 * no reason of its own — it was out because navigation was unreachable in *both* adapters, which
 * this feature ends. Leaving it would also have made every slide that waits for a learner a dead
 * end here, since such a slide must carry a control this adapter would then refuse to draw.
 */
describe('a button in the web component', () => {
  it('is a real button, and moves the lesson', async () => {
    const m = (mounted = await mount(withButton()))
    const go = control(m, 'go')
    expect(go.tagName).toBe('BUTTON')
    expect(go.getAttribute('aria-disabled')).toBeNull()

    go.click()
    await m.advance(200)
    expect(rendered(m.root).has('second')).toBe(true)
  })

  it('leaves a slide that waits for the learner, through the kernel', async () => {
    const m = (mounted = await mount(withButton({ mode: 'on_click' })))
    await m.advance(6000)
    expect(rendered(m.root).has('first'), 'three times its duration, and it waits').toBe(true)

    control(m, 'go').click()
    await m.advance(200)
    expect(rendered(m.root).has('second')).toBe(true)
  })

  it('will not carry a learner past a question it cannot show', async () => {
    /**
     * FR-003a. The slide is gated on a question this adapter declines, so Continue can never
     * usefully act — and a button that skipped the question would be worse than the inert one
     * this feature replaces.
     */
    const m = (mounted = await mount(gatedWithControls()))
    await m.advance(1500)
    expect(control(m, 'go').getAttribute('aria-disabled')).toBe('true')
  })

  it('still lets a learner go back or repeat from there', async () => {
    /**
     * FR-003c. Neither carries a learner past the gate — both move away from it — and a slide
     * that questions you about its own content is exactly where you want to re-read what came
     * before. A rule reading "navigation is unavailable on a gated slide" traps a learner in
     * front of a question with no way to review it.
     */
    const m = (mounted = await mount(gatedWithControls()))
    await m.advance(1500)
    for (const id of ['back', 'again']) {
      expect(control(m, id).getAttribute('aria-disabled'), id).toBeNull()
    }

    control(m, 'back').click()
    await m.advance(200)
    expect(rendered(m.root).has('x')).toBe(true)
  })

  it('says so when there is nowhere to go', async () => {
    const m = (mounted = await mount(withButton()))
    await m.advance(4200)
    // On the last slide there is no next; the control reports that rather than pretending.
    const go = m.root.querySelector('[data-cs-element-id="go"] button')
    expect(go).toBeNull()
  })
})
