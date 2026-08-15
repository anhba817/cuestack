import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, mediaElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts, degenerate } from '../harness/media.js'
import { createAdvanceController } from '@cuestack/core'
import type { Transport } from '@cuestack/core'

/**
 * FR-017: a slide gated on media that fails must not strand the learner.
 *
 * The kernel has reported `ADVANCE_MEDIA_FAILED` since Wave 1 and no consumer has ever
 * displayed one. US5 builds the presentation; what this establishes is that the condition is
 * *reachable* — which is the precondition for US5 having anything real to show.
 */

const gated = () =>
  lessonOf([
    slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
      durationMs: 8000,
      advance: { mode: 'after_media_ends', mediaElementId: 'v' },
    }),
    slide([element({ id: 'after', effects: [] })], { durationMs: 4000 }),
  ])

describe('media that fails to load', () => {
  it('is reported as failed rather than never reported', async () => {
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'v')
    expect(ports.media.query('v')?.failed).toBe(true)
  })

  it('makes the slide reachable as blocked rather than merely stuck', () => {
    // The kernel's own answer, asked directly: reachability says this rule can never be
    // satisfied, which is what distinguishes "waiting" from "will wait forever".
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'v')
    const controller = createAdvanceController(ports)
    const slideWithMedia = gated().slides[0]!
    const problem = controller.reachability(slideWithMedia, ports.media)
    expect(problem?.code).toBe('ADVANCE_MEDIA_FAILED')
  })

  it('does not advance the lesson on its own', async () => {
    // Advancing would skip content the author gated deliberately. The learner is told
    // instead — US5's work, on the state this makes reachable.
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'v')
    let transport: Transport | null = null
    await client(
      h(LessonPlayer, {
        lesson: gated(),
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(transport!.slideIndex).toBe(0)
  })

  it('leaves the rest of the slide playing', async () => {
    // FR-PLY-012 in spirit: one broken asset must not take the slide with it.
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'v')
    const container = await client(
      h(LessonPlayer, { lesson: gated(), ports, autoPlay: true }),
    )
    expect(container.querySelector('.cs-stage')).not.toBeNull()
    expect(container.querySelector('[data-cs-element-id="v"]')).not.toBeNull()
  })
})
