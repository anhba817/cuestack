import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { overlongTransitionLesson, singleSlideLesson } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * Spec Edge Cases: a transition longer than the slide it moves to, and a lesson of one slide.
 *
 * Both are authorable and neither is nonsense; what matters is that the player does something
 * defensible rather than something undefined. n=1 is where a fraction is easiest to get wrong,
 * and an over-long transition is where a duration comparison is.
 */

async function mount(lesson: ReturnType<typeof singleSlideLesson>) {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson,
      ports,
      progress: 'slides',
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  return { container, ports, transport: () => transport! }
}

describe('a transition longer than the slide it moves to', () => {
  it('does not prevent the lesson from finishing', async () => {
    // A 3s transition onto a 1s slide. The transition outlives the slide's own duration, and
    // the slide must still be able to complete rather than being held open by its own
    // arrival animation.
    const { container, ports } = await mount(overlongTransitionLesson())
    await runFrames(ports, 9000)
    expect(container.querySelector('.cs-complete')).not.toBeNull()
  })

  it('does not leave two slides visible at the end', async () => {
    const { container, ports } = await mount(overlongTransitionLesson())
    await runFrames(ports, 9000)
    expect(container.querySelectorAll('.cs-stage').length).toBeLessThanOrEqual(1)
  })
})

describe('a lesson of exactly one slide', () => {
  it('shows progress as 1 of 1 rather than as zero', async () => {
    const { container } = await mount(singleSlideLesson())
    const bar = container.querySelector('[role="progressbar"]')!
    expect(bar.getAttribute('aria-valuetext')).toBe('Slide 1 of 1')
    expect(bar.getAttribute('aria-valuenow')).toBe('1')
  })

  it('completes, rather than having no end because it has no second slide', async () => {
    const { container, ports } = await mount(singleSlideLesson())
    await runFrames(ports, 5000)
    expect(container.querySelector('.cs-complete')).not.toBeNull()
  })

  it('never renders a transition, having nothing to transition from', async () => {
    const { container, ports } = await mount(singleSlideLesson())
    await runFrames(ports, 5000)
    expect(container.querySelector('[data-cs-transition]')).toBeNull()
  })
})
