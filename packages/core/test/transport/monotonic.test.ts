import { describe, expect, it } from 'vitest'
import { createTransport } from '../../src/time/transport.js'
import { createTestPorts } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'

/** SC-010: lesson time never decreases during continuous playback. */
describe('monotonicity', () => {
  it('holds across a long session with hidden periods and a simulated sleep', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf({ slides: 1, durationMs: 10_000_000 }), ports)
    t.play()

    let previous = t.slideTimeMs
    for (let tick = 0; tick < 400; tick++) {
      if (tick === 90) ports.setHidden(true)
      if (tick === 140) ports.setHidden(false)
      if (tick === 250) ports.clock.advance(2 * 60 * 60 * 1000) // machine sleep
      ports.clock.advance(16)
      const now = t.slideTimeMs
      expect(now).toBeGreaterThanOrEqual(previous)
      previous = now
    }
  })

  it('does not advance while the document is hidden (BR-013)', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    ports.clock.advance(500)
    const atHide = t.slideTimeMs
    ports.setHidden(true)
    ports.clock.advance(5000)
    expect(t.slideTimeMs).toBe(atHide)
  })
})
