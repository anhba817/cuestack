import { describe, expect, it } from 'vitest'
import { act, createElement as h } from 'react'
import { client } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/** US2 #4, #5 / FR-021, FR-022. */
describe('pause and seek', () => {
  const lesson = lessonOf([
    slide([element({ id: 'only', startMs: 0, endMs: 4000, effects: [], payload: { text: 'Held' } })]),
  ])

  async function mount() {
    const ports = testPorts()
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, { lesson, ports, onReady: (t: Transport) => { transport = t } }),
    )
    return { container, ports, transport: transport! }
  }

  it('pausing holds the visible state rather than resetting it', async () => {
    const { container, transport } = await mount()
    await act(async () => { transport.play(); transport.seek(2000); transport.pause() })
    expect(container.textContent).toContain('Held')
    expect(transport.slideTimeMs).toBe(2000)
  })

  it('outside time passing while paused does not advance the lesson', async () => {
    const { ports, transport } = await mount()
    await act(async () => { transport.play(); transport.pause() })
    ports.clock.advance(30_000)
    expect(transport.slideTimeMs).toBe(0)
  })

  it('seeking lands exactly where asked', async () => {
    const { transport } = await mount()
    await act(async () => { transport.seek(1234) })
    expect(transport.slideTimeMs).toBe(1234)
  })

  it('restart returns to zero', async () => {
    const { transport } = await mount()
    await act(async () => { transport.seek(3000); transport.restart() })
    expect(transport.slideTimeMs).toBe(0)
  })
})
