import { describe, expect, it } from 'vitest'
import { createTransport } from '../../src/time/transport.js'
import { createTestPorts } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'

describe('snapshots and subscription', () => {
  it('every operation returns the resulting snapshot synchronously', () => {
    const t = createTransport(lessonOf(), createTestPorts())
    expect(t.play().state).toBe('playing')
    expect(t.seek(100).slideTimeMs).toBe(100)
    expect(t.pause().state).toBe('paused')
    expect(t.restart().slideTimeMs).toBe(0)
  })

  it('a listener observes a state that is already committed', () => {
    const t = createTransport(lessonOf(), createTestPorts())
    const seen: string[] = []
    t.subscribe((snap) => {
      seen.push(snap.state)
      // Reading through the transport must agree with the snapshot handed over.
      expect(t.state).toBe(snap.state)
    })
    t.play()
    t.pause()
    expect(seen).toEqual(['playing', 'paused'])
  })

  it('unsubscribe stops delivery', () => {
    const t = createTransport(lessonOf(), createTestPorts())
    let count = 0
    const off = t.subscribe(() => count++)
    t.play()
    off()
    t.pause()
    expect(count).toBe(1)
  })

  it('notifies when visibility forces a pause', () => {
    const ports = createTestPorts()
    const t = createTransport(lessonOf(), ports)
    const states: string[] = []
    t.subscribe((s) => states.push(s.state))
    t.play()
    ports.setHidden(true)
    expect(states).toContain('paused')
  })
})
