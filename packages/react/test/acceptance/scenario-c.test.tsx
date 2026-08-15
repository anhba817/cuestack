import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts } from '../harness/media.js'
import type { Transport } from '@cuestack/core'

/**
 * **MVP Acceptance Scenario C**, from `docs/Cuestack_Framework.md` §34, verbatim:
 *
 * > Given a slide configured to advance after a selected video ends:
 * >  - The slide shall not advance while the video is still playing.
 * >  - Pausing the video shall also postpone advancement.
 * >  - Seeking to the video end shall trigger completion according to the media event.
 * >  - A duplicate end event shall not advance two slides.
 *
 * Driven by a scripted fake, never a real `<video>` — Constitution II forbids a test that
 * depends on real media playback. The last clause tests Wave 1 behaviour through a new path:
 * the single-fire guard is keyed on `slideId#visitCount`, so a duplicate within one visit
 * cannot fire twice while a replayed slide still can.
 */

async function frame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  })
}

describe('§34 Scenario C — media-controlled advancement', () => {
  it('walks the scenario as written', async () => {
    // Given a slide configured to advance after a selected video ends.
    const lesson = lessonOf([
      slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
        durationMs: 8000,
        advance: { mode: 'after_media_ends', mediaElementId: 'v' },
      }),
      slide([element({ id: 'next', effects: [] })], { durationMs: 4000 }),
    ])

    const ports = mediaPorts()
    ports.media.attach('v', { durationMs: 6000, positionMs: 0, paused: false })
    let transport: Transport | null = null
    await client(
      h(LessonPlayer, {
        lesson,
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )

    // The slide shall not advance while the video is still playing — including past the
    // slide's own duration, which a media-gated slide deliberately ignores.
    for (let at = 1000; at <= 10_000; at += 1000) {
      ports.clock.advance(1000)
      await act(async () => {
        ports.media.report('v', { positionMs: Math.min(at, 6000) })
      })
      await frame()
    }
    expect(transport!.slideIndex).toBe(0)

    // Pausing the video shall also postpone advancement.
    await act(async () => {
      ports.media.report('v', { paused: true })
    })
    ports.clock.advance(5000)
    await frame()
    expect(transport!.slideIndex).toBe(0)

    // Seeking to the video end shall trigger completion according to the media event.
    await act(async () => {
      ports.media.report('v', { positionMs: 6000, ended: true, paused: true })
    })
    await frame()
    expect(transport!.slideIndex).toBe(1)
  })

  it('does not advance two slides on a duplicate end event', async () => {
    const lesson = lessonOf([
      slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
        durationMs: 8000,
        advance: { mode: 'after_media_ends', mediaElementId: 'v' },
      }),
      slide([element({ id: 'b', effects: [] })], { durationMs: 4000 }),
      slide([element({ id: 'c', effects: [] })], { durationMs: 4000 }),
    ])

    const ports = mediaPorts()
    ports.media.attach('v', { durationMs: 6000, positionMs: 0, paused: false })
    let transport: Transport | null = null
    await client(
      h(LessonPlayer, {
        lesson,
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )

    // The end, reported three times over. BR-007 keys on slide instance, so a repeated
    // condition within one visit fires once.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        ports.media.report('v', { positionMs: 6000, ended: true })
      })
      await frame()
    }

    expect(transport!.slideIndex).toBe(1)
  })

  it('lets a replayed slide advance again, which the same guard must permit', async () => {
    // The other half of BR-007, and the half a slide-id-keyed guard gets wrong.
    const lesson = lessonOf([
      slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
        durationMs: 8000,
        advance: { mode: 'after_media_ends', mediaElementId: 'v' },
      }),
      slide([element({ id: 'b', effects: [] })], { durationMs: 4000 }),
    ])

    const ports = mediaPorts()
    ports.media.attach('v', { durationMs: 6000, positionMs: 0, paused: false })
    let transport: Transport | null = null
    await client(
      h(LessonPlayer, {
        lesson,
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )

    await act(async () => {
      ports.media.report('v', { positionMs: 6000, ended: true })
    })
    await frame()
    expect(transport!.slideIndex).toBe(1)

    await act(async () => {
      transport!.goToSlide(0)
    })
    await act(async () => {
      ports.media.report('v', { positionMs: 6000, ended: true })
    })
    await frame()
    expect(transport!.slideIndex).toBe(1)
  })
})
