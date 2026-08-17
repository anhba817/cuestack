import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor, runFrames } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { element } from '../harness/corpus.js'

/**
 * BR-013 in the editor, and the editor does not implement it.
 *
 * `createTransport` has paused on `visibilitychange` since Wave 1 and resumed when the
 * document returns. Driving the same transport means the rule holds here without the editor
 * knowing the rule exists — which is the argument for reusing it rather than writing a
 * second clock that would have to re-implement a *business* rule to stay correct.
 */

describe('playback pauses when the document is hidden (BR-013)', () => {
  const lesson = () => timelineLesson([element()])

  it('stops advancing while hidden', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 1000)
    act(() => ports.setHidden(true))

    const atHide = handle.playback.atMs
    await runFrames(ports, 5000)
    expect(handle.playback.atMs).toBe(atHide)
  })

  it('resumes on return, rather than leaving the teacher to press play again', async () => {
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    act(() => handle.playback.play())
    await runFrames(ports, 1000)
    act(() => ports.setHidden(true))
    await runFrames(ports, 5000)
    act(() => ports.setHidden(false))

    expect(handle.playback.state).toBe('playing')
    await runFrames(ports, 500)
    expect(handle.playback.atMs).toBe(1500)
  })

  it('leaves a paused lesson paused when the document returns', async () => {
    // Only a pause the *visibility* rule caused is undone by returning. A teacher who
    // pressed pause and switched tabs should come back to a paused lesson.
    const ports = fakePorts()
    const { handle } = renderEditor(lesson(), { playback: true, ports })

    act(() => handle.playback.play())
    act(() => handle.playback.pause())
    act(() => ports.setHidden(true))
    act(() => ports.setHidden(false))

    expect(handle.playback.state).toBe('paused')
  })
})
