import { describe, expect, it } from 'vitest'
import { createTransport } from '../../src/time/transport.js'
import { createTestPorts, runFrames } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'

describe('pause and resume', () => {
  it('outside time passing while paused does not become lesson time', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 3000)
    expect(t.pause().slideTimeMs).toBe(3000)
    ports.clock.advance(10_000) // paused: outside time must not count
    expect(t.slideTimeMs).toBe(3000)
  })

  it('resuming continues from the stored position', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 1500)
    t.pause()
    ports.clock.advance(60_000) // a long absence: must contribute nothing
    t.play()
    runFrames(ports, () => t.slideTimeMs, 500)
    expect(t.slideTimeMs).toBe(2000)
  })

  it('play on an already-playing transport is a no-op', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 1000)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 1000)
    expect(t.slideTimeMs).toBe(2000)
  })

  it('reports its state', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    expect(t.state).toBe('idle')
    expect(t.play().state).toBe('playing')
    expect(t.pause().state).toBe('paused')
  })
})
