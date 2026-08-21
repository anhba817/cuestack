import { afterEach, describe, expect, it } from 'vitest'
import axe from 'axe-core'
import { mount, type Mounted } from './harness/mount.js'
import { covered, uncovered, stranding, withImage, twoSlides } from './harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Constitution III · FR-012. The same bar as the React player, because a learner does not know or
 * care which adapter drew the page — a second-class adapter is a second-class learner.
 *
 * axe is given the *host*, not the shadow root: axe traverses into open shadow roots on its own, and
 * pointing it at the root would skip the host element's own role and labelling, which is the part
 * unique to this adapter. Contrast is disabled for the reason `packages/react`'s suite disables it —
 * happy-dom paints no pixels, so the check reports nothing and looks like a pass.
 */
const violations = async (node: HTMLElement): Promise<axe.Result[]> =>
  (
    await axe.run(node, {
      runOnly: { type: 'tag', values: TAGS },
      rules: { 'color-contrast': { enabled: false } },
    })
  ).violations

const describeViolation = (v: axe.Result): string =>
  `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.html).join('\n    ')}`

describe('the web component meets the same bar as the player', () => {
  for (const [name, lesson] of [
    ['a covered lesson', covered()],
    ['an unavailable element', uncovered()],
    ['a slide that cannot be left', stranding()],
    ['an image', withImage()],
  ] as const) {
    it(`has no violations: ${name}`, async () => {
      const m = (mounted = await mount(lesson))
      const found = await violations(m.element)
      expect(found.map(describeViolation).join('\n'), 'axe violations').toBe('')
    })
  }

  it('has no violations mid-transition, with two stages on screen', async () => {
    /**
     * The one moment this adapter puts two full slides in the document at once — and the moment no
     * other test in this file sees, because every lesson above is a single slide.
     *
     * It is the shape that produces accessibility defects: duplicated content, a focus order that
     * visits a slide the learner has left, and a screen reader reading both at once. The outgoing
     * half carries `aria-hidden`; this is what checks that the marking is enough.
     */
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)

    expect(m.root.querySelector('.cs-transition'), 'the transition must be running').toBeTruthy()
    const found = await violations(m.element)
    expect(found.map(describeViolation).join('\n'), 'axe violations mid-transition').toBe('')
  })

  it('hides only the outgoing half from assistive technology', async () => {
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)

    const leaving = m.root.querySelector('[data-cs-transition="leaving"]')
    const entering = m.root.querySelector('[data-cs-transition="entering"]')
    expect(leaving?.getAttribute('aria-hidden')).toBe('true')
    // The arriving slide must *not* be hidden — a transition that hid both would silence the lesson
    // for the length of every slide change, which is the opposite of the fix.
    expect(entering?.getAttribute('aria-hidden')).toBeNull()
  })

  it('announces an unavailable element rather than only drawing it', async () => {
    /**
     * The notice has to reach a learner who cannot see the dashed box. `role="note"` carries it into
     * the accessibility tree as a distinct thing rather than as loose text inside the stage.
     */
    const m = (mounted = await mount(uncovered()))
    const notice = m.root.querySelector('[data-cs-notice]')
    expect(notice?.getAttribute('role')).toBe('note')
    expect(notice?.textContent ?? '').toMatch(/cannot|not available|unavailable/i)
  })

  it('gives the stranding problem a live region, so it is heard when it appears', async () => {
    // It appears mid-lesson, after any reading of the page has finished. Without a live region a
    // screen-reader user is told nothing at all, which is the exact failure BR-016 describes.
    const m = (mounted = await mount(stranding()))
    await m.advance(9000)
    const problem = m.root.querySelector('[data-cs-problem]')
    expect(problem, 'the problem must be rendered, not only dispatched').toBeTruthy()
    expect(problem?.getAttribute('role')).toBe('alert')
  })
})
