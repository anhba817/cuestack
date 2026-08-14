import { describe, expect, it } from 'vitest'
import { act, createElement as h } from 'react'
import { client } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * US2 #3. Elements appear and disappear at their authored times.
 *
 * The transport is driven directly through `onReady` rather than waiting for the frame
 * loop to tick. Two reasons: nothing in this suite may wait in real time, and a test
 * racing an animation frame would be flaky for reasons unrelated to what it asserts.
 * The frame loop's own behaviour is covered by frame-cost.test.ts.
 */
describe('playback after hydration', () => {
  const lesson = lessonOf([
    slide([
      element({ id: 'first', startMs: 0, endMs: 1000, effects: [], payload: { text: 'First' } }),
      element({ id: 'second', startMs: 1000, endMs: 3000, effects: [], payload: { text: 'Second' } }),
    ]),
  ])

  async function mount() {
    const ports = testPorts()
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, { lesson, ports, onReady: (t: Transport) => { transport = t } }),
    )
    return { container, ports, transport: transport! }
  }

  it('shows only the time-zero element before playing', async () => {
    const { container } = await mount()
    expect(container.textContent).toContain('First')
    expect(container.textContent).not.toContain('Second')
  })

  it('hands the host a transport', async () => {
    const { transport } = await mount()
    expect(typeof transport?.play).toBe('function')
  })

  it('swaps elements as lesson time advances', async () => {
    const { container, transport } = await mount()
    await act(async () => {
      transport.seek(1200)
    })
    expect(container.textContent).toContain('Second')
    expect(container.textContent).not.toContain('First')
  })

  it('returns to the earlier element when seeking back', async () => {
    const { container, transport } = await mount()
    await act(async () => { transport.seek(1200) })
    await act(async () => { transport.seek(200) })
    expect(container.textContent).toContain('First')
    expect(container.textContent).not.toContain('Second')
  })
})
