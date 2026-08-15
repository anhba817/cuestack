import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { gatedFinalSlideLesson } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * Spec Edge Case: the final slide gates on a required question that is never answered.
 *
 * The spec asks it as a question — "is the lesson completable?" — and the answer here is no,
 * and that is correct: BR-005 does not stop applying because the slide happens to be last.
 * A lesson that completed anyway would let a learner skip the one question the author most
 * wanted answered, by waiting.
 *
 * What matters is that it does not *look* finished. A learner sitting on a slide that will
 * never move, with no completion state and no explanation, cannot tell a gate from a bug.
 */

async function mount() {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: gatedFinalSlideLesson(),
      ports,
      progress: 'slides',
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const answer = async (index: number) => {
    await act(async () => {
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
  }
  return { container, ports, answer, transport: () => transport! }
}

describe('a final slide gated by an unanswered required question', () => {
  it('reaches the final slide', async () => {
    const { ports, transport } = await mount()
    await runFrames(ports, 2200)
    expect(transport().slideIndex).toBe(1)
  })

  it('does not reach the completion state', async () => {
    // The gate is real, and being last does not exempt it.
    const { container, ports } = await mount()
    await runFrames(ports, 10_000)
    expect(container.querySelector('.cs-complete')).toBeNull()
  })

  it('leaves the question on screen and answerable, rather than looking finished', async () => {
    const { container, ports } = await mount()
    await runFrames(ports, 10_000)
    expect(container.querySelector('[data-cs-element-type="question"]')).not.toBeNull()
    const radios = container.querySelectorAll('input[type="radio"]')
    expect(radios.length).toBeGreaterThan(0)
    for (const radio of radios) expect(radio.getAttribute('aria-disabled')).not.toBe('true')
  })

  it('completes once the learner answers', async () => {
    const { container, ports, answer } = await mount()
    await runFrames(ports, 6000)
    await answer(0)
    await runFrames(ports, 2000)
    expect(container.querySelector('.cs-complete')).not.toBeNull()
  })
})
