import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts } from '../harness/media.js'
import { MEDIA_SYNC_TOLERANCE_MS } from '@cuestack/core'
import type { Transport } from '@cuestack/core'

/**
 * FR-034, FR-035, FR-036, SC-014 — the bidirectional half of the media port.
 *
 * Driven by the scripted fake, never a real `<video>`: Constitution II forbids a test that
 * depends on real media playback, and happy-dom's media elements have no decoder anyway. The
 * *rule* is verified exactly here even though the thing it governs is approximate in life.
 */

async function mount() {
  const ports = mediaPorts()
  ports.media.attach('v', { durationMs: 20_000, positionMs: 0, paused: false })
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
  ports.media.clearCommands()
  return { ports, transport: () => transport! }
}

const seeks = (ports: Awaited<ReturnType<typeof mount>>['ports']) =>
  ports.media.commands.filter((c) => c.kind === 'seek').map((c) => c.positionMs)

describe('seeking the lesson commands the media (FR-034)', () => {
  it('moves the media to the corresponding position', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      transport().seek(6000)
    })
    expect(seeks(ports)).toContain(6000)
  })

  it('does not command it again for its own echo', async () => {
    // The loop the authority rule exists to prevent, observed through the player rather than
    // in the pure function: one seek must produce one command.
    const { ports, transport } = await mount()
    await act(async () => {
      transport().seek(6000)
    })
    await act(async () => {
      ports.media.report('v', { positionMs: 6000 + MEDIA_SYNC_TOLERANCE_MS / 2 })
    })
    expect(seeks(ports)).toEqual([6000])
  })
})

describe('the learner moving the media moves the lesson (FR-036)', () => {
  it('follows a scrub made with the element’s own controls', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      ports.media.report('v', { positionMs: 14_000 })
    })
    expect(transport().slideTimeMs).toBeGreaterThanOrEqual(13_500)
  })

  it('does not fight it back to where the lesson thought it was', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      transport().seek(2000)
    })
    ports.media.clearCommands()
    await act(async () => {
      ports.media.report('v', { positionMs: 15_000 })
    })
    // The lesson followed rather than re-issuing 2000.
    expect(seeks(ports)).not.toContain(2000)
    expect(transport().slideTimeMs).toBeGreaterThanOrEqual(14_500)
  })

  it('ignores playback drift, which is not a scrub', async () => {
    const { ports, transport } = await mount()
    await act(async () => {
      transport().seek(5000)
    })
    ports.media.clearCommands()
    // A playing element creeps by about a report interval. Chasing that would have the
    // transport following playback it is already driving.
    await act(async () => {
      ports.media.report('v', { positionMs: 5200 })
    })
    expect(seeks(ports)).toEqual([])
  })
})

describe('a seek the media cannot honour (FR-035)', () => {
  it('leaves the lesson responsive rather than stalling', async () => {
    const { ports, transport } = await mount()
    ports.media.refuseSeeks('v')
    await act(async () => {
      transport().seek(9000)
    })
    // The transport moved regardless. The lesson never waits on the media.
    expect(transport().slideTimeMs).toBe(9000)
  })

  it('does not swallow the learner’s next genuine scrub', async () => {
    // The failure an `ignoreNextReport` flag would have had: a refused seek never produces
    // the report that clears the latch, and every later scrub is ignored.
    const { ports, transport } = await mount()
    ports.media.refuseSeeks('v')
    await act(async () => {
      transport().seek(9000)
    })
    ports.media.refuseSeeks('v', false)
    await act(async () => {
      ports.media.report('v', { positionMs: 1000 })
    })
    expect(transport().slideTimeMs).toBeLessThanOrEqual(1500)
  })
})
