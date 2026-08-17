import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor, runFrames } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { element } from '../harness/corpus.js'

/**
 * The bound on a divergence this feature declares rather than hides.
 *
 * While playing, `session.authoringTime` is permitted to lag: syncing it per frame would
 * re-render the canvas and every track sixty times a second, which is why `FrameWriter`
 * exists at all. The price of that is a rule — exactly one module may hold the divergence,
 * and it reconciles the moment playback stops (research R-02).
 *
 * The two suites below assert the seam from both sides. Anything reading `authoringTime`
 * during playback is reading a value that is accurate *by contract* only when stopped.
 */

const lesson = () => timelineLesson([element()])

describe('the session and the transport agree once playback stops', () => {
  it('reconciles on pause', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 2500)
    act(() => handle.playback.pause())

    expect(handle.session.authoringTime).toBe(2500)
    expect(handle.session.authoringTime).toBe(handle.playback.atMs)
  })

  it('reconciles on seek', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    act(() => handle.playback.seek(4321))
    expect(handle.session.authoringTime).toBe(4321)
  })

  it('reconciles on restart', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 3000)
    act(() => handle.playback.restart())
    act(() => handle.playback.pause())

    expect(handle.session.authoringTime).toBe(0)
  })
})

describe('idle costs nothing', () => {
  /**
   * Stated as a property of the writer rather than as "the loop is not mounted", because a
   * cancelled `requestAnimationFrame` is not observable and asserting on rAF in happy-dom
   * would be asserting against the environment rather than against the code.
   *
   * The guard matters: `useFrameLoop` has no state guard of its own — it ticks from mount —
   * so an unguarded loop would resolve and write every frame while a teacher is merely
   * dragging an element, against SC-004's budget at 300 elements.
   */
  it('writes nothing while nothing is playing, however far the clock runs', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    const before = handle.playback.writeCount()
    act(() => {
      ports.advance(10_000)
    })
    expect(handle.playback.writeCount()).toBe(before)
  })

  it('writes exactly once for a seek, because the writer owns the continuous properties', async () => {
    // The rule that makes guarding the loop safe. Most continuous values would survive an
    // unguarded gap on their own — reconciling on stop re-renders the moment the writer last
    // wrote, and React takes ownership of those keys. `will-change` cannot: it is set
    // imperatively and rendered by nobody, so nothing else could ever remove it.
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    const before = handle.playback.writeCount()
    act(() => handle.playback.seek(1000))
    expect(handle.playback.writeCount()).toBe(before + 1)
  })
})
