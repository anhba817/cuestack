import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, singleSlideLesson, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/** FR-021, FR-022 / US3 #5, #6: an end that says so, and a way back from it. */

const twoSlides = () =>
  lessonOf([
    slide([element({ id: 'a', endMs: 60_000, effects: [] })], { durationMs: 2000 }),
    slide([element({ id: 'b', endMs: 60_000, effects: [] })], { durationMs: 2000 }),
  ])

async function mount(lesson = twoSlides()) {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson,
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const complete = () => container.querySelector('.cs-complete')
  const review = () =>
    [...container.querySelectorAll('button')].find((b) => /review/i.test(b.textContent ?? ''))
  return { container, ports, complete, review, transport: () => transport! }
}

describe('the completion state', () => {
  it('is absent while the lesson is still running', async () => {
    const { complete } = await mount()
    expect(complete()).toBeNull()
  })

  it('appears after the final slide', async () => {
    // A lesson that simply stops is indistinguishable from one that broke.
    const { complete, ports } = await mount()
    await runFrames(ports, 6000)
    expect(complete()).not.toBeNull()
  })

  it('is announced, since there is no visual cue to miss — there is nothing at all', async () => {
    const { complete, ports } = await mount()
    await runFrames(ports, 6000)
    expect(complete()!.getAttribute('role')).toBe('status')
    expect(complete()!.getAttribute('aria-live')).toBe('polite')
  })

  it('names what was completed', async () => {
    const { container, ports } = await mount()
    await runFrames(ports, 6000)
    expect(container.textContent).toContain('Render Test')
  })

  it('offers a way back into the lesson (FR-022)', async () => {
    const { review, ports } = await mount()
    await runFrames(ports, 6000)
    expect(review()).toBeDefined()
  })

  it('returns to the lesson when the learner chooses to review', async () => {
    // Trapping someone at the end so they must reload is worse than having no end state.
    const { complete, review, ports, transport, container } = await mount()
    await runFrames(ports, 6000)
    await act(async () => {
      review()!.click()
    })
    expect(complete()).toBeNull()
    expect(transport().slideIndex).toBe(0)
    expect(container.querySelector('[data-cs-element-id="a"]')).not.toBeNull()
  })

  it('completes a lesson of exactly one slide', async () => {
    const { complete, ports } = await mount(singleSlideLesson())
    await runFrames(ports, 5000)
    expect(complete()).not.toBeNull()
  })
})
