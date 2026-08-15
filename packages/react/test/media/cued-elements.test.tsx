import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { lessonOf, mediaElement, element, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { mediaPorts } from '../harness/media.js'
import { MEDIA_SYNC_TOLERANCE_MS } from '@cuestack/core'

/**
 * FR-013 / SC-006: an element cued to media appears when the media reaches its cue.
 *
 * Measured against the media's *reported position*, not wall-clock time — which is the whole
 * point. A caption timed to a narrator's words has to arrive when the narrator says them,
 * however the learner got there: playing, scrubbing, or after a buffering stall.
 *
 * The mechanism is the one the wave already built: the learner moving the media moves the
 * lesson (FR-036), and the lesson's own time is what element windows are resolved against.
 * So a cued element is an ordinary timed element, and what is under test is that media
 * position genuinely drives lesson time.
 */

const cued = () =>
  lessonOf([
    slide(
      [
        mediaElement({ id: 'v', payload: { volume: 0 } }),
        element({ id: 'caption', startMs: 4000, endMs: 8000, effects: [] }),
      ],
      { durationMs: 20_000 },
    ),
  ])

async function mount() {
  const ports = mediaPorts()
  ports.media.attach('v', { durationMs: 20_000, positionMs: 0, paused: false })
  const container = await client(h(LessonPlayer, { lesson: cued(), ports, autoPlay: true }))
  const visible = () =>
    [...container.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id'))
  return { container, ports, visible }
}

describe('an element cued to media position', () => {
  it('is absent before the media reaches its cue', async () => {
    const { visible } = await mount()
    expect(visible()).not.toContain('caption')
  })

  it('appears when the media reaches it', async () => {
    const { ports, visible } = await mount()
    await act(async () => {
      ports.media.report('v', { positionMs: 5000 })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(visible()).toContain('caption')
  })

  it('appears within the media synchronisation tolerance of its cue', async () => {
    // SC-006. Not the tighter non-streaming tolerance, which a media clock cannot meet.
    const { ports, visible } = await mount()
    await act(async () => {
      ports.media.report('v', { positionMs: 4000 + MEDIA_SYNC_TOLERANCE_MS - 1 })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(visible()).toContain('caption')
  })

  it('disappears again when the learner scrubs back before it', async () => {
    // The property that makes this synchronisation rather than a one-way trigger: seeking
    // backwards recomputes, it does not leave fired cues showing.
    const { ports, visible } = await mount()
    await act(async () => {
      ports.media.report('v', { positionMs: 5000 })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(visible()).toContain('caption')

    await act(async () => {
      ports.media.report('v', { positionMs: 1000 })
    })
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
    expect(visible()).not.toContain('caption')
  })
})
