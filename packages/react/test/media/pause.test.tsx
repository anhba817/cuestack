import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts } from '../harness/media.js'
import type { Transport } from '@cuestack/core'

/** FR-016: pausing the lesson pauses its media, and resuming continues where it stopped. */

async function mount() {
  const ports = mediaPorts()
  ports.media.attach('v', { durationMs: 20_000, positionMs: 0, paused: true })
  let transport: Transport | null = null
  await client(
    h(LessonPlayer, {
      lesson: lessonOf([slide([mediaElement({ id: 'v', payload: { volume: 0 } })], { durationMs: 20_000 })]),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  return { ports, transport: () => transport! }
}

describe('media pauses and resumes with the lesson', () => {
  it('plays the media when the lesson plays', async () => {
    const { ports } = await mount()
    expect(ports.media.query('v')?.paused).toBe(false)
  })

  it('pauses the media when the lesson pauses', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      transport().pause()
    })
    expect(ports.media.query('v')?.paused).toBe(true)
  })

  it('resumes from the stopped position rather than the beginning', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      ports.media.report('v', { positionMs: 7000 })
    })
    await act(async () => {
      transport().pause()
    })
    await act(async () => {
      transport().play()
    })
    expect(ports.media.query('v')?.positionMs).toBe(7000)
    expect(ports.media.query('v')?.paused).toBe(false)
  })

})
