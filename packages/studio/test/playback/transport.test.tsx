import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor, runFrames } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { element } from '../harness/corpus.js'

/**
 * Playback runs the player's transport, on a clock the test advances by hand.
 *
 * `createTransport` has been in `@cuestack/core` since Wave 1. The editor becomes its second
 * consumer and ED-6 will be its third — one engine, many consumers, which is what
 * Constitution V is for. Nothing here implements timing, and `no-clock-in-studio` makes that
 * a rule rather than an intention.
 *
 * **Nothing waits.** Constitution II forbids wall-clock sleeps and real
 * `requestAnimationFrame`; the transport takes its clock as a port precisely so a test can
 * step it. A test in this file containing `await sleep(...)` is a test to delete.
 */

describe('the editor drives the transport', () => {
  it('starts idle at the slide’s beginning', () => {
    const { handle } = renderEditor(timelineLesson([element()]), { playback: true, ports: fakePorts() })
    expect(handle.playback.state).toBe('idle')
    expect(handle.playback.atMs).toBe(0)
  })

  it('advances the playhead while playing', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(timelineLesson([element()]), { playback: true, ports })

    act(() => handle.playback.play())
    expect(handle.playback.state).toBe('playing')

    await runFrames(ports, 1500)
    expect(handle.playback.atMs).toBe(1500)
  })

  it('holds the moment when paused, however far the clock then runs', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(timelineLesson([element()]), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 2000)
    act(() => handle.playback.pause())

    await runFrames(ports, 5000)
    expect(handle.playback.state).toBe('paused')
    expect(handle.playback.atMs).toBe(2000)
  })

  it('returns to the beginning on restart and plays from there', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(timelineLesson([element()]), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 3000)
    act(() => handle.playback.restart())
    expect(handle.playback.atMs).toBe(0)

    await runFrames(ports, 700)
    expect(handle.playback.atMs).toBe(700)
  })

  it('continues from where a seek left it, rather than snapping back', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(timelineLesson([element()]), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 1000)
    act(() => handle.playback.seek(6000))
    expect(handle.playback.atMs).toBe(6000)

    await runFrames(ports, 500)
    expect(handle.playback.atMs).toBe(6500)
  })
})

describe('an element entering mid-slide appears during playback', () => {
  /**
   * The assertion no other test in this feature makes, and the one that matters most.
   *
   * Every other playback test drives a `seek()` — which emits a snapshot and re-renders, so
   * all of them would pass over a canvas that never updates during real playback. That is
   * exactly how the same defect shipped in Wave 2, and `useFrameLoop`'s own header records
   * it: "every test drove `seek()`, which does emit, so the one path a learner takes was the
   * one path untested."
   *
   * Green here means three things worked at once: the writer reached real nodes, the
   * visible-set trigger fired, and the render read the *frame's* state rather than
   * re-deriving it from an authoring time that is stale by contract.
   */
  const lesson = () =>
    timelineLesson([
      element({ startMs: 0, endMs: 8000, payload: { text: 'always here' } }),
      element({ startMs: 3000, endMs: 8000, payload: { text: 'arrives later' } }),
    ])

  it('mounts with no seek issued at all', async () => {
    const ports = fakePorts()
    const { handle, container } = renderEditor(lesson(), { playback: true, ports })

    expect(container.textContent).not.toContain('arrives later')

    act(() => handle.playback.play())
    await runFrames(ports, 4000)

    expect(container.textContent).toContain('arrives later')
  })

  it('leaves when its window ends, still with no seek', async () => {
    const ports = fakePorts()
    const { handle, container } = renderEditor(
      timelineLesson([element({ startMs: 0, endMs: 2000, payload: { text: 'brief' } })]),
      { playback: true, ports },
    )

    expect(container.textContent).toContain('brief')
    act(() => handle.playback.play())
    await runFrames(ports, 3000)
    expect(container.textContent).not.toContain('brief')
  })
})
