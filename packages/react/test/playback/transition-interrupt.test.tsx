import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { transitionLesson } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames, frame } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * US3 #8: an input arriving mid-transition resolves it.
 *
 * Two slides visible after an interruption is the only outcome that is definitely wrong.
 * Settling — jumping to the incoming slide — is the one resolution with no intermediate
 * state to get stuck in, which is why it is preferred over reversing or queueing.
 *
 * It falls out of timing the transition on lesson time rather than wall-clock: a seek past
 * the transition's end is already past it.
 */

async function mount() {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: transitionLesson(),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const stages = () => container.querySelectorAll('.cs-stage').length
  return { container, ports, stages, transport: () => transport! }
}

describe('interrupting a transition', () => {
  it('settles when the learner seeks past it', async () => {
    const { ports, stages, transport } = await mount()
    await runFrames(ports, 8100)
    expect(stages()).toBe(2)

    await act(async () => {
      transport().seek(3000)
    })
    await frame()
    expect(stages()).toBe(1)
  })

  it('settles when the learner navigates away', async () => {
    const { ports, stages, transport } = await mount()
    await runFrames(ports, 8100)
    expect(stages()).toBe(2)

    await act(async () => {
      transport().goToSlide(0)
    })
    await frame()
    expect(stages()).toBe(1)
  })

  it('never leaves two slides visible once it has resolved', async () => {
    const { ports, stages, transport } = await mount()
    await runFrames(ports, 8100)
    await act(async () => {
      transport().seek(3000)
    })
    await runFrames(ports, 1000)
    expect(stages()).toBe(1)
  })

  it('hides the outgoing slide from assistive technology while it runs', async () => {
    // Both are on screen. A screen reader meeting two copies of a lesson would read the old
    // one first, which is the wrong content and in the wrong order.
    const { container, ports } = await mount()
    await runFrames(ports, 8100)
    const leaving = container.querySelector('[data-cs-transition="leaving"]')
    const entering = container.querySelector('[data-cs-transition="entering"]')
    expect(leaving!.getAttribute('aria-hidden')).toBe('true')
    expect(entering!.hasAttribute('aria-hidden')).toBe(false)
  })
})
