import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts, type TestPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * The lesson moves from one slide to the next.
 *
 * **This did not exist before Wave 3.** `slideIndex` was a fixed prop, nothing in
 * `@cuestack/react` imported `createAdvanceController`, and no test noticed because every
 * player test rendered a single slide. Feature 003's quickstart stated that a slide advances
 * at the end of its duration, and it did not.
 *
 * Everything else in this wave rests on it: US1's gating is vacuous with nothing to gate,
 * US3 is about moving between slides, and US2's media-end advance has nothing to advance.
 */

const twoSlides = () =>
  lessonOf([
    slide([element({ id: 'first', effects: [] })], { durationMs: 4000 }),
    slide([element({ id: 'second', effects: [] })], { durationMs: 4000 }),
  ])

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

async function play(lesson: ReturnType<typeof twoSlides>) {
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

const visibleIds = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id')!)

describe('a lesson advances from slide to slide', () => {
  it('starts on the first slide', async () => {
    const { container } = await play(twoSlides())
    expect(visibleIds(container)).toContain('first')
    expect(visibleIds(container)).not.toContain('second')
  })

  it('reaches the second slide when the first slide’s duration elapses', async () => {
    const { container, ports } = await play(twoSlides())
    await runFrames(ports, 4200)
    expect(visibleIds(container)).toContain('second')
    expect(visibleIds(container)).not.toContain('first')
  })

  it('stops at the last slide rather than running off the end', async () => {
    // The failure this guards is an index walking past `slides.length`. It is asserted on
    // the index and on the stage surviving — deliberately *not* on the last slide's elements
    // still being visible, which they are not: after twelve seconds the slide's own time has
    // passed its element's `endMs`, and an empty stage is the correct answer. A first draft
    // asserted visibility here and failed for that reason, which would have been a real
    // defect reported against correct code.
    const { container, ports, transport } = await play(twoSlides())
    await runFrames(ports, 12_000)
    expect(transport().slideIndex).toBe(1)
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })

  it('does not advance while paused', async () => {
    const { container, ports, transport } = await play(twoSlides())
    await act(async () => {
      transport().pause()
    })
    await runFrames(ports, 6000)
    expect(visibleIds(container)).toContain('first')
  })

  it('resets slide time when it advances, rather than carrying it forward', async () => {
    // A slide arriving at 4000ms of its own time would skip straight past everything
    // authored in its first four seconds.
    const { ports, transport } = await play(twoSlides())
    await runFrames(ports, 4200)
    expect(transport().slideIndex).toBe(1)
    expect(transport().slideTimeMs).toBeLessThan(1000)
  })
})
