import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { element } from '../harness/corpus.js'

/**
 * Dragging the playhead during playback commands the clock rather than fighting it.
 *
 * There is one clock in the editor (FR-011): the playhead reflects it while playing and
 * commands it while seeking. A second timing mechanism would show up exactly here — as a
 * drag that the clock overwrites on the next frame.
 */

const lesson = () => timelineLesson([element()])

describe('seeking during playback', () => {
  it('continues from where the drag left it', () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { timeline: true, ports })

    act(() => handle.playback.play())
    act(() => {
      ports.advance(1000)
    })
    act(() => handle.playback.seek(5000))

    expect(handle.playback.state).toBe('playing')
    act(() => {
      ports.advance(250)
    })
    expect(handle.playback.atMs).toBe(5250)
  })

  it('does not snap back to where the clock had reached', () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { timeline: true, ports })

    act(() => handle.playback.play())
    act(() => {
      ports.advance(4000)
    })
    act(() => handle.playback.seek(500))
    act(() => {
      ports.advance(1)
    })
    expect(handle.playback.atMs).toBeLessThan(1000)
  })

  it('is the same value a paused seek sets — one clock, two situations', () => {
    const ports = fakePorts()
    const a = renderEditor(lesson(), { timeline: true, ports: fakePorts() })
    const b = renderEditor(lesson(), { timeline: true, ports })

    act(() => a.handle.playback.seek(3000))

    act(() => b.handle.playback.play())
    act(() => b.handle.playback.seek(3000))
    act(() => b.handle.playback.pause())

    expect(a.handle.playback.atMs).toBe(b.handle.playback.atMs)
  })
})
