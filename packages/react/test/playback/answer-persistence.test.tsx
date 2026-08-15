import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { questionElement, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * FR-008: a recorded answer survives seeking and revisiting.
 *
 * This is where a design decision becomes observable. Interaction state is keyed by element
 * rather than by slide visit, deliberately — Wave 1's `slideId#visitCount` key exists to make
 * *advancement* fire once per visit, which is a different question from whether this learner
 * has answered this question. Key answers by visit and a learner who navigates back is asked
 * again, and their attempts are spent by navigating.
 */

async function mount() {
  const ports = testPorts()
  let transport: Transport | null = null
  const lesson = lessonOf([
    slide([questionElement({ id: 'q', payload: { maxAttempts: 3, completionPolicy: 'on_correct' } })], {
      durationMs: 10_000,
    }),
    slide([questionElement({ id: 'q2' })], { durationMs: 10_000 }),
  ])
  const container = await client(
    h(LessonPlayer, {
      lesson,
      ports,
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
  return { container, answer, transport: () => transport! }
}

describe('an answer survives navigation', () => {
  it('is still recorded after seeking backwards past the question', async () => {
    const { container, answer, transport } = await mount()
    await answer(1)
    expect(container.textContent).toMatch(/not quite/i)

    await act(async () => {
      transport().seek(0)
    })
    expect(container.textContent).toMatch(/not quite/i)
  })

  it('does not consume an attempt by seeking', async () => {
    const { container, answer, transport } = await mount()
    await answer(1)
    expect(container.textContent).toMatch(/2 attempts? remaining/i)

    await act(async () => {
      transport().seek(500)
    })
    await act(async () => {
      transport().seek(5000)
    })
    expect(container.textContent).toMatch(/2 attempts? remaining/i)
  })

  it('is still recorded after leaving the slide and returning', async () => {
    const { container, answer, transport } = await mount()
    await answer(1)

    await act(async () => {
      transport().goToSlide(1)
    })
    await act(async () => {
      transport().goToSlide(0)
    })
    expect(container.textContent).toMatch(/not quite/i)
    expect(container.textContent).toMatch(/2 attempts? remaining/i)
  })

  it('keeps a completed question complete across a revisit, so the gate stays open', async () => {
    // The consequence that matters: a learner who answered a gating question correctly must
    // not have to answer it again to pass the same gate.
    const { container, answer, transport } = await mount()
    await answer(0)
    expect(container.textContent).toMatch(/correct/i)

    await act(async () => {
      transport().goToSlide(1)
    })
    await act(async () => {
      transport().goToSlide(0)
    })
    expect(container.textContent).toMatch(/correct/i)
    for (const radio of container.querySelectorAll('input[type="radio"]')) {
      expect(radio.getAttribute('aria-disabled')).toBe('true')
    }
  })
})
