import { describe, expect, it } from 'vitest'
import { createTransport } from '../../src/time/transport.js'
import { createTestPorts, runFrames } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * BR-013 — the timeline pauses while the learner's browser document is hidden.
 *
 * A rule-named file so compliance is greppable by rule id (SC-004). The same
 * behaviour is exercised from the monotonicity angle in transport/monotonic.test.ts;
 * this one exists to make the rule itself findable.
 */
describe('BR-013', () => {
  it('lesson time stops advancing while the document is hidden', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 400)
    const atHide = t.slideTimeMs

    ports.setHidden(true)
    runFrames(ports, () => t.slideTimeMs, 10_000)
    expect(t.slideTimeMs).toBe(atHide)
  })

  it('resumes from the stored position, not from where wall-clock time reached', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 600)

    ports.setHidden(true)
    ports.clock.advance(300_000) // five minutes away
    ports.setHidden(false)

    runFrames(ports, () => t.slideTimeMs, 400)
    expect(t.slideTimeMs).toBe(1000)
  })

  it('reports paused while hidden', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    ports.setHidden(true)
    expect(t.state).toBe('paused')
    ports.setHidden(false)
    expect(t.state).toBe('playing')
  })

  it('starting playback while already hidden does not accumulate unseen time', () => {
    const ports = createTestPorts()
    ports.setHidden(true)
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 5000)
    expect(t.slideTimeMs).toBe(0)
  })

  it('a hidden interval does not resume playback that the learner had paused', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 200)
    t.pause()
    ports.setHidden(true)
    ports.setHidden(false)
    expect(t.state).toBe('paused')
  })
})
