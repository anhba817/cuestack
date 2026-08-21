import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { allTypesSlide, lessonOf } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'

/**
 * US4 #5 · FR-017 · SC-009.
 *
 * Every interactive element is reachable by keyboard and carries an accessible name, a
 * role, and a state.
 *
 * Asserted against the hydrated DOM rather than the markup string, because reachability
 * is a property of the tree: an element with `tabindex="-1"`, or hidden behind
 * `aria-hidden` on an ancestor, is in the markup and not reachable.
 */

/**
 * What counts as a control a keyboard user must be able to reach.
 *
 * `[tabindex]:not([tabindex="-1"])` rather than `[tabindex]`, because `-1` means the opposite of
 * being in the tab order: focus can be *sent* there programmatically and a learner cannot tab to
 * it. Feature 012 gave the stage `tabindex="-1"` so a slide change has somewhere to put focus, and
 * the broader selector counted that container as a control removed from the tab order — which is
 * the correct verdict for a `<button>` and the wrong one for a focus target.
 *
 * The assertions below still bite where it matters: a real control carrying `tabindex="-1"` is
 * selected by its own clause and reported.
 */
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, video[controls], audio[controls], [tabindex]:not([tabindex="-1"])'

/**
 * Whether a control would be announced with a name.
 *
 * The `<label><input/>text</label>` form has to be handled explicitly: the input's own
 * text content is empty, and a first pass at this test reported every radio as unnamed.
 * The name comes from the ancestor label, which is how a wrapped control is labelled.
 */
function hasAccessibleName(el: HTMLElement): boolean {
  if (el.getAttribute('aria-label')?.trim()) return true
  if (el.getAttribute('aria-labelledby')) return true
  if (el.getAttribute('title')?.trim()) return true
  if ((el.textContent ?? '').trim() !== '') return true
  if (el.id !== '' && el.ownerDocument.querySelector(`label[for="${el.id}"]`)) return true
  const wrapping = el.closest('label')
  return wrapping !== null && (wrapping.textContent ?? '').trim() !== ''
}

describe('interactive elements are operable by keyboard', () => {
  const lesson = lessonOf([allTypesSlide()])

  const controls = async (): Promise<HTMLElement[]> => {
    const container = await client(
      h(LessonPlayer, { lesson, ports: testPorts(), resolveAsset: (ref: { assetId: string }) => `https://example.test/${ref.assetId}` }),
    )
    return [...container.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)]
  }

  it('has interactive elements to check', async () => {
    // The corpus slide carries a button, a question, a video, and an audio element. A
    // sweep that found nothing would pass every assertion below.
    expect((await controls()).length).toBeGreaterThanOrEqual(4)
  })

  it('never removes one from the tab order', async () => {
    const removed = (await controls()).filter((el) => el.getAttribute('tabindex') === '-1')
    expect(removed.map((el) => el.outerHTML.slice(0, 80))).toEqual([])
  })

  it('gives every one an accessible name', async () => {
    const unnamed = (await controls()).filter((el) => !hasAccessibleName(el))
    expect(unnamed.map((el) => el.outerHTML.slice(0, 100))).toEqual([])
  })

  it('hides none of them from assistive technology', async () => {
    // A focusable element inside an `aria-hidden` subtree is reachable by keyboard and
    // invisible to a screen reader, which is the worst of both.
    const hidden = (await controls()).filter((el) => el.closest('[aria-hidden="true"]') !== null)
    expect(hidden.map((el) => el.tagName.toLowerCase())).toEqual([])
  })

  it('exposes a state on anything not currently operable', async () => {
    // The inert question. `aria-disabled` rather than `disabled`, so it stays reachable
    // and announces why it does nothing — see question.test.ts.
    const container = await client(h(LessonPlayer, { lesson, ports: testPorts() }))
    const question = container.querySelector('[data-cs-element-type="question"]')
    expect(question?.querySelector('[aria-disabled="true"]')).not.toBeNull()
  })

  it('marks decorative content as having nothing to announce', async () => {
    const container = await client(h(LessonPlayer, { lesson, ports: testPorts() }))
    const shape = container.querySelector('[data-cs-element-type="shape"] svg')
    expect(shape?.getAttribute('aria-hidden')).toBe('true')
  })
})
