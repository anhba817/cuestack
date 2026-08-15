import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts } from '../harness/media.js'

/**
 * The gesture prompt is a learner-facing surface, so it carries the same obligations as
 * every other one: announced, keyboard-reachable, and naming the action.
 *
 * The failure to avoid is a lesson that has silently declined to start. To a learner that is
 * indistinguishable from a broken page, and to a learner using a screen reader it is
 * indistinguishable from an empty one.
 */

const audible = () => lessonOf([slide([mediaElement({ id: 'v' })], { durationMs: 8000 })])

async function mount() {
  const ports = mediaPorts()
  return client(h(LessonPlayer, { lesson: audible(), ports, autoPlay: true }))
}

describe('the gesture prompt', () => {
  it('is a real button', async () => {
    const container = await mount()
    const button = [...container.querySelectorAll('button')].find((b) => /start/i.test(b.textContent ?? ''))
    expect(button).toBeDefined()
  })

  it('is reachable by keyboard', async () => {
    const container = await mount()
    const button = [...container.querySelectorAll('button')].find((b) => /start/i.test(b.textContent ?? ''))!
    expect(button.getAttribute('tabindex')).not.toBe('-1')
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('names the action rather than describing the state', async () => {
    // "Start the lesson" tells a learner what pressing it does. "Audio blocked" tells them
    // about the browser, which is not a thing they can act on.
    const container = await mount()
    const button = [...container.querySelectorAll('button')].find((b) => /start/i.test(b.textContent ?? ''))!
    expect(button.textContent).toMatch(/start/i)
  })

  it('explains why it is being asked', async () => {
    const container = await mount()
    expect(container.textContent).toMatch(/sound/i)
  })

  it('is grouped and labelled for assistive technology', async () => {
    const container = await mount()
    const group = container.querySelector('[role="group"][aria-label]')
    expect(group).not.toBeNull()
    expect(group!.getAttribute('aria-label')).toMatch(/start|playback/i)
  })

  it('leaves the slide itself rendered behind it', async () => {
    // The prompt replaces the controls, not the lesson. A learner should see what they are
    // about to start.
    const container = await mount()
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })
})
