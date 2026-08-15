import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts, type TestPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * BR-007: a slide advances exactly once for the same slide state.
 *
 * The guard is Wave 1's and is keyed on `slideId#visitCount`, so this is not new behaviour
 * — it is the first time that behaviour is reachable through a player, because nothing
 * advanced before. What makes it worth a test of its own is the asymmetry: a condition
 * reporting satisfied repeatedly must fire once, and the *same slide visited again* must be
 * able to fire again. A guard keyed on slide id alone would get the first right and the
 * second wrong, and only replay would reveal it.
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

const threeSlides = () =>
  lessonOf([
    slide([element({ id: 'a', effects: [] })], { durationMs: 2000 }),
    slide([element({ id: 'b', effects: [] })], { durationMs: 2000 }),
    slide([element({ id: 'c', effects: [] })], { durationMs: 2000 }),
  ])

async function play(lesson: ReturnType<typeof threeSlides>) {
  const ports = testPorts()
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
  return { ports, transport: () => transport! }
}

describe('advancement fires once per slide visit', () => {
  it('advances one slide when a duration elapses, not several', async () => {
    // Frames keep arriving after the condition is met. Without the guard, every one of them
    // is another advance, and a three-slide lesson ends after a single overrun.
    const { ports, transport } = await play(threeSlides())
    await runFrames(ports, 2400)
    expect(transport().slideIndex).toBe(1)
  })

  it('advances again on a later slide, so the guard is per slide and not once per lesson', async () => {
    const { ports, transport } = await play(threeSlides())
    await runFrames(ports, 2400)
    await runFrames(ports, 2400)
    expect(transport().slideIndex).toBe(2)
  })

  it('can advance a second time from a slide that is revisited', async () => {
    // The half a slide-id-keyed guard gets wrong. Go back, play through again, and the
    // slide must be able to advance once more — its visit count differs, so its instance
    // does too.
    const { ports, transport } = await play(threeSlides())
    await runFrames(ports, 2400)
    expect(transport().slideIndex).toBe(1)

    await act(async () => {
      transport().goToSlide(0)
    })
    await runFrames(ports, 2400)
    expect(transport().slideIndex).toBe(1)
  })
})
