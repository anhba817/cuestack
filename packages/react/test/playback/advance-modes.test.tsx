import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, mediaElement, questionElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts, type TestPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * The four advance modes, through the player.
 *
 * Two of them work at the end of this phase and two deliberately do not. `after_media_ends`
 * needs US2's media link and `after_interaction` needs US1's answers, so both are asserted
 * here as *not yet advancing* — a red line for those stories to move rather than a gap
 * nobody notices.
 *
 * Stating it as a passing assertion of current behaviour rather than a skipped test is the
 * point: a skipped test reports nothing, while this one fails the moment either story lands
 * and forgets to come back and change it.
 */

/**
 * Advance the *lesson* clock, then let one animation frame actually fire.
 *
 * Lesson time stays virtual and hand-advanced — Constitution II forbids a timing test that
 * waits out real durations, and nothing here does: a four-second slide is crossed in forty
 * synthetic steps, instantly. What is real is only the *scheduling*. happy-dom implements
 * `requestAnimationFrame` on a timer, and the frame loop is the one thing that runs as time
 * passes, so a test that never let a frame fire would be testing the seek path and calling
 * it playback. That is precisely how Wave 2 shipped a loop no test had ever driven.
 */
async function runFrames(ports: TestPorts, ms: number, stepMs = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    ports.clock.advance(stepMs)
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
  }
}

async function play(lesson: ReturnType<typeof lessonOf>) {
  const ports = testPorts()
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

const second = () => slide([element({ id: 'second', effects: [] })], { durationMs: 4000 })

describe('advance modes through the player', () => {
  it('after_duration advances when the duration elapses', async () => {
    const lesson = lessonOf([
      slide([element({ id: 'first', effects: [] })], { durationMs: 2000, advance: { mode: 'after_duration' } }),
      second(),
    ])
    const { ports, transport } = await play(lesson)
    await runFrames(ports, 2400)
    expect(transport().slideIndex).toBe(1)
  })

  it('on_click does not advance on the timer alone', async () => {
    // The whole point of the mode: the duration passing must not move it.
    const lesson = lessonOf([
      slide([element({ id: 'first', effects: [] })], { durationMs: 2000, advance: { mode: 'on_click' } }),
      second(),
    ])
    const { ports, transport } = await play(lesson)
    await runFrames(ports, 6000)
    expect(transport().slideIndex).toBe(0)
  })

  it('after_media_ends does not advance yet — US2 supplies the media link', async () => {
    const lesson = lessonOf([
      slide([mediaElement({ id: 'el_video' })], {
        durationMs: 2000,
        advance: { mode: 'after_media_ends', mediaElementId: 'el_video' },
      }),
      second(),
    ])
    const { ports, transport } = await play(lesson)
    await runFrames(ports, 6000)
    expect(transport().slideIndex).toBe(0)
  })

  it('after_interaction does not advance yet — US1 supplies the answers', async () => {
    const lesson = lessonOf([
      slide([questionElement({ id: 'q' })], {
        durationMs: 2000,
        advance: { mode: 'after_interaction', interactionElementId: 'q' },
      }),
      second(),
    ])
    const { ports, transport } = await play(lesson)
    await runFrames(ports, 6000)
    expect(transport().slideIndex).toBe(0)
  })

  it('a required question holds a duration-advanced slide once US1 lands', async () => {
    // BR-005 through the player. It reads as "does not advance" now for the wrong reason —
    // nothing supplies completions yet — and must still read that way afterwards for the
    // right one. US1's T016 is where it starts meaning something.
    const lesson = lessonOf([
      slide([questionElement({ id: 'q' })], { durationMs: 2000, advance: { mode: 'after_duration' } }),
      second(),
    ])
    const { ports, transport } = await play(lesson)
    await runFrames(ports, 6000)
    expect(transport().slideIndex).toBe(0)
  })
})
