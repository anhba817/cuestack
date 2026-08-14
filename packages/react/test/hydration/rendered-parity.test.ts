import { describe, expect, it } from 'vitest'
import { act, createElement as h } from 'react'
import { client } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * SC-011 — the rendered counterpart of what feature 002 proved internally.
 *
 * Feature 002 established that the computed state at time t is identical whether
 * reached by playing or seeking. That guarantee only matters if the renderer preserves
 * it, and this is the wave where a second consumer of the resolver appears. If this
 * holds, an editor preview and a learner player cannot diverge.
 */
describe('rendered parity', () => {
  const lesson = lessonOf([
    slide([
      element({
        id: 'faded',
        startMs: 0,
        endMs: 4000,
        payload: { text: 'Fading' },
        effects: [
          { id: 'fx', type: 'fade', phase: 'enter', startMs: 500, durationMs: 1000, order: 1, easing: 'linear' },
        ],
      }),
      element({ id: 'later', startMs: 2000, endMs: 4000, effects: [], payload: { text: 'Later' } }),
    ]),
  ])

  async function mount() {
    const ports = testPorts()
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, { lesson, ports, onReady: (t: Transport) => { transport = t } }),
    )
    return { container, transport: transport! }
  }

  const BOUNDARIES = [0, 499, 500, 1000, 1499, 1500, 1999, 2000, 2001, 3999]

  it.each(BOUNDARIES)('the rendered output at %ims is the same by either route', async (target) => {
    // Route A: step forward through every boundary below the target.
    const a = await mount()
    for (const step of BOUNDARIES.filter((b) => b <= target)) {
      await act(async () => { a.transport.seek(step) })
    }
    const stepped = a.container.innerHTML

    // Route B: go straight there.
    const b = await mount()
    await act(async () => { b.transport.seek(target) })
    const direct = b.container.innerHTML

    expect(direct).toBe(stepped)
  })
})
