import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames, frame } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * **MVP Acceptance Scenario A**, from `docs/Cuestack_Framework.md` §34, verbatim:
 *
 * > Given a slide with an eight-second duration:
 * >  - Title fades in at 0.5 seconds.
 * >  - Image slides in at 2 seconds.
 * >  - Explanation appears at 4 seconds.
 * >  - Slide transitions at 8 seconds.
 * >
 * > The preview and published player shall execute this sequence in the same order and within
 * > the accepted timing tolerance.
 *
 * The first three clauses have worked since Wave 2. The fourth is what this wave adds, and it
 * is the reason the scenario could not be written before: nothing advanced.
 *
 * Asserted **both by playing and by seeking**, because the last sentence is about the
 * *sequence* being the same however it is reached. That is Principle V restated as an
 * acceptance criterion, and it is the criterion that fails first if seeking ever replays
 * rather than recomputes.
 */

const scenarioA = () =>
  lessonOf([
    slide(
      [
        element({
          id: 'title',
          startMs: 500,
          endMs: 60_000,
          effects: [
            { id: 'fx_title', type: 'fade', phase: 'enter', startMs: 500, durationMs: 400, order: 1 },
          ],
        }),
        element({
          id: 'image',
          startMs: 2000,
          endMs: 60_000,
          effects: [
            { id: 'fx_image', type: 'slide', phase: 'enter', startMs: 2000, durationMs: 400, order: 1 },
          ],
        }),
        element({ id: 'explanation', startMs: 4000, endMs: 60_000, effects: [] }),
      ],
      { durationMs: 8000 },
    ),
    slide([element({ id: 'next', endMs: 60_000, effects: [] })], {
      durationMs: 4000,
      transition: { type: 'fade', durationMs: 400 },
    }),
  ])

async function mount() {
  const ports = testPorts()
  let transport: Transport | null = null
  const container = await client(
    h(LessonPlayer, {
      lesson: scenarioA(),
      ports,
      autoPlay: true,
      onReady: (t: Transport) => {
        transport = t
      },
    }),
  )
  const visible = () =>
    [...container.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id'))
  return { container, ports, visible, transport: () => transport! }
}

describe('§34 Scenario A — timed effects and automatic progression', () => {
  it('executes the sequence in order while playing', async () => {
    const { ports, visible, transport, container } = await mount()

    // Before 0.5s: nothing yet.
    await runFrames(ports, 400)
    expect(visible()).toEqual([])

    // Title fades in at 0.5 seconds.
    await runFrames(ports, 300)
    expect(visible()).toContain('title')
    expect(visible()).not.toContain('image')

    // Image slides in at 2 seconds.
    await runFrames(ports, 1400)
    expect(visible()).toContain('image')
    expect(visible()).not.toContain('explanation')

    // Explanation appears at 4 seconds.
    await runFrames(ports, 2000)
    expect(visible()).toContain('explanation')

    // Slide transitions at 8 seconds.
    expect(transport().slideIndex).toBe(0)
    await runFrames(ports, 4100)
    expect(transport().slideIndex).toBe(1)
    expect(container.querySelector('[data-cs-transition="entering"]')).not.toBeNull()
  })

  it('shows the same state when seeking to each moment as when playing to it', async () => {
    // The scenario's last sentence, and Principle V's whole claim. If seeking replayed
    // effects rather than recomputing from the manifest, these would diverge.
    const { visible, transport } = await mount()

    const atTime = async (ms: number): Promise<string[]> => {
      await act(async () => {
        transport().seek(ms)
      })
      await frame()
      return [...visible()].sort() as string[]
    }

    expect(await atTime(400)).toEqual([])
    expect(await atTime(700)).toEqual(['title'])
    expect(await atTime(2100)).toEqual(['image', 'title'])
    expect(await atTime(4100)).toEqual(['explanation', 'image', 'title'])

    // And backwards, which is where a replaying implementation gives itself away.
    expect(await atTime(700)).toEqual(['title'])
    expect(await atTime(400)).toEqual([])
  })
})
