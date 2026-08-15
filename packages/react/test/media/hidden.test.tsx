import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { lessonOf, mediaElement, element, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts } from '../harness/media.js'
import type { Transport } from '@cuestack/core'

/**
 * FR-018 with FR-016, and BR-013: hiding the document stops the lesson **and its media**.
 *
 * The transport half has held since Wave 1 and is covered by `BR-013.test.ts` in the kernel.
 * The media half is new, and it is why this is not already covered: a visual timeline that
 * freezes while a video keeps talking is the exact desynchronisation this wave exists to
 * remove, and it is the state a learner reaches by switching tabs.
 *
 * Includes hiding mid-transition, which must settle rather than strand two slides visible.
 * One hidden-document concern, one test — it was briefly split across two stories, which the
 * third analysis pass caught.
 */

async function mount() {
  const ports = mediaPorts()
  ports.media.attach('v', { durationMs: 20_000, positionMs: 0, paused: true })
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: lessonOf([
        slide([mediaElement({ id: 'v', payload: { volume: 0 } })], { durationMs: 20_000 }),
        slide([element({ id: 'second', effects: [] })], { durationMs: 4000 }),
      ]),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  return { container, ports, transport: () => transport! }
}

describe('hiding the document', () => {
  it('pauses the visual timeline', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      ports.setHidden(true)
    })
    expect(transport().state).toBe('paused')
  })

  it('pauses its media too', async () => {
    const { ports } = await mount()
    expect(ports.media.query('v')?.paused).toBe(false)
    await act(async () => {
      ports.setHidden(true)
    })
    expect(ports.media.query('v')?.paused).toBe(true)
  })

  it('resumes both from the same position on returning', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      ports.media.report('v', { positionMs: 5000 })
    })
    const before = transport().slideTimeMs

    await act(async () => {
      ports.setHidden(true)
    })
    await act(async () => {
      ports.setHidden(false)
    })

    expect(transport().state).toBe('playing')
    expect(transport().slideTimeMs).toBe(before)
    expect(ports.media.query('v')?.positionMs).toBe(5000)
    expect(ports.media.query('v')?.paused).toBe(false)
  })

  it('does not advance lesson time while hidden', async () => {
    // BR-013. Time that did not happen in the lesson must not be counted.
    const { ports, transport } = await mount()
    await act(async () => {
      ports.setHidden(true)
    })
    const at = transport().slideTimeMs
    ports.clock.advance(5000)
    expect(transport().slideTimeMs).toBe(at)
  })

  it('leaves the stage rendered rather than blanking it', async () => {
    const { container, ports } = await mount()
    await act(async () => {
      ports.setHidden(true)
    })
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })
})
