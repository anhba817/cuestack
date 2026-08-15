import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts, degenerate } from '../harness/media.js'
import type { Transport } from '@cuestack/core'

/**
 * Spec Edge Cases: a slide gated on media that is muted, or reports zero duration.
 *
 * The failure to avoid is a lesson that waits forever for an end that will not come. A muted
 * video still ends; a zero-duration one has arguably already ended. Neither is a reason to
 * strand a learner on a slide.
 */

async function play(lesson: ReturnType<typeof lessonOf>, script?: (ports: ReturnType<typeof mediaPorts>) => void) {
  const ports = mediaPorts()
  script?.(ports)
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
  return { container, ports, transport: () => transport! }
}

const gated = (payload: Record<string, unknown> = {}) =>
  lessonOf([
    slide([mediaElement({ id: 'v', payload })], {
      durationMs: 8000,
      advance: { mode: 'after_media_ends', mediaElementId: 'v' },
    }),
    slide([element({ id: 'after', effects: [] })], { durationMs: 4000 }),
  ])

describe('muted media', () => {
  it('needs no gesture, so the lesson starts', async () => {
    const { transport } = await play(gated({ volume: 0 }), (ports) =>
      ports.media.attach('v', { durationMs: 5000, paused: false }),
    )
    expect(transport().state).toBe('playing')
  })

  it('still advances the slide when it ends', async () => {
    // Silence is not a reason to gate differently. A muted video ends like any other.
    const { ports, transport } = await play(gated({ volume: 0 }), (p) =>
      p.media.attach('v', { durationMs: 5000, paused: false }),
    )
    await act(async () => {
      ports.media.report('v', { positionMs: 5000, ended: true })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(transport().slideIndex).toBe(1)
  })
})

describe('media reporting zero duration', () => {
  it('does not strand the learner waiting for an end', async () => {
    // A runtime behaviour of the element, not a manifest field — which is why it is scripted
    // by the fake rather than authored in the corpus.
    const { ports, transport } = await play(gated({ volume: 0 }), (p) =>
      degenerate.zeroDuration(p.media, 'v'),
    )
    await act(async () => {
      ports.media.report('v', { positionMs: 0, ended: true })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(transport().slideIndex).toBe(1)
  })
})

describe('media that never reports an end', () => {
  it('leaves the slide gated rather than advancing on a guess', async () => {
    // The honest outcome: the rule says advance when the media ends, and it has not. What
    // must not happen is inventing an end from the manifest's duration, which may be wrong.
    const { transport } = await play(gated({ volume: 0 }), (p) =>
      degenerate.neverEnds(p.media, 'v', 5000),
    )
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(transport().slideIndex).toBe(0)
  })
})
