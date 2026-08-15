import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, singleSlideLesson, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/** FR-020 / US3 #3, #4: progress where the host enables it, and nowhere else. */

const threeSlides = () =>
  lessonOf([
    slide([element({ id: 'a', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
    slide([element({ id: 'b', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
    slide([element({ id: 'c', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
  ])

async function mount(lesson = threeSlides(), progress: 'none' | 'slides' = 'slides') {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson,
      ports,
      progress,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const bar = () => container.querySelector('[role="progressbar"]')
  return { container, ports, bar, transport: () => transport! }
}

describe('progress display', () => {
  it('is absent unless the host enables it', async () => {
    const { bar, container } = await mount(threeSlides(), 'none')
    expect(bar()).toBeNull()
    expect(container.querySelector('.cs-progress')).toBeNull()
  })

  it('appears when the host enables it', async () => {
    const { bar } = await mount()
    expect(bar()).not.toBeNull()
  })

  it('states the position in slides a learner can act on', async () => {
    // "30" is a number. "Slide 1 of 3" is a position.
    const { bar } = await mount()
    expect(bar()!.getAttribute('aria-valuetext')).toBe('Slide 1 of 3')
    expect(bar()!.getAttribute('aria-valuemax')).toBe('3')
  })

  it('advances as the lesson does', async () => {
    const { bar, ports } = await mount()
    await runFrames(ports, 4200)
    expect(bar()!.getAttribute('aria-valuetext')).toBe('Slide 2 of 3')
    expect(bar()!.getAttribute('aria-valuenow')).toBe('2')
  })

  it('does not go backwards when the learner reviews', async () => {
    // A bar that falls when someone re-reads punishes re-reading. Progress counts slides
    // *visited*, which is a fact about what the learner has seen rather than where they are.
    const { bar, ports, transport } = await mount()
    await runFrames(ports, 4200)
    expect(bar()!.getAttribute('aria-valuenow')).toBe('2')

    await act(async () => {
      transport().goToSlide(0)
    })
    expect(bar()!.getAttribute('aria-valuenow')).toBe('2')
    expect(bar()!.getAttribute('aria-valuetext')).toBe('Slide 1 of 3')
  })

  it('means something for a lesson of one slide', async () => {
    // n=1 is where a fraction is easiest to get wrong: 1/1 must not read as 0%.
    const { bar } = await mount(singleSlideLesson())
    expect(bar()!.getAttribute('aria-valuetext')).toBe('Slide 1 of 1')
    expect(bar()!.getAttribute('aria-valuenow')).toBe('1')
    expect(bar()!.getAttribute('aria-valuemax')).toBe('1')
  })

  it('leaves the lesson otherwise unchanged when disabled', async () => {
    const { container } = await mount(threeSlides(), 'none')
    expect(container.querySelector('.cs-stage')).not.toBeNull()
    expect(container.querySelector('[data-cs-element-id="a"]')).not.toBeNull()
  })
})
