import { describe, expect, it } from 'vitest'
import { CLAMP_CEILING_MS, createTransport } from '../../src/time/transport.js'
import { createTestPorts, runFrames } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * FR-017 / research R-03. Machine sleep, a blocked main thread, and a paused
 * debugger all produce the same enormous delta, and none of them happened to the
 * learner — so all three clamp identically and the platform question of whether a
 * monotonic source advances during sleep becomes moot rather than researched.
 */
describe('delta clamping', () => {
  it('an hour-long jump barely moves lesson time', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    ports.clock.advance(60 * 60 * 1000)
    expect(t.slideTimeMs).toBeLessThanOrEqual(CLAMP_CEILING_MS)
  })

  it('a delta at the ceiling passes through unclamped', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    ports.clock.advance(CLAMP_CEILING_MS)
    expect(t.slideTimeMs).toBe(CLAMP_CEILING_MS)
  })

  it('normal frame deltas accumulate exactly', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 960)
    expect(t.slideTimeMs).toBe(960)
  })

  it('treats a debugger pause the same as a sleep — neither happened to the learner', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 100)
    const before = t.slideTimeMs
    ports.clock.advance(30_000)
    expect(t.slideTimeMs - before).toBeLessThanOrEqual(CLAMP_CEILING_MS)
  })
})
