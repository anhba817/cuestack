import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { createTransport } from '../../src/time/transport.js'
import { createTestPorts, runFrames } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'

describe('seek and restart', () => {
  it('seeking lands exactly where asked', () => {
    const t = createTransport(lessonOf(), createTestPorts())
    expect(t.seek(4321).slideTimeMs).toBe(4321)
  })

  it('seeking clamps a negative target to zero', () => {
    const t = createTransport(lessonOf(), createTestPorts())
    expect(t.seek(-500).slideTimeMs).toBe(0)
  })

  it('restart returns to zero and matches resolve(slide, 0)', () => {
    const ports = createTestPorts()
    const lesson = lessonOf()
    const t = createTransport(lesson, ports)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 2000)
    const snap = t.restart()
    expect(snap.slideTimeMs).toBe(0)
    const slide = lesson.slides[snap.slideIndex]!
    expect(resolve(slide, snap.slideTimeMs)).toEqual(resolve(slide, 0))
  })

  it('goToSlide changes slide and resets slide time', () => {
    const t = createTransport(lessonOf({ slides: 3 }), createTestPorts())
    const snap = t.goToSlide(2)
    expect(snap.slideIndex).toBe(2)
    expect(snap.slideTimeMs).toBe(0)
  })

  it('a new visit to a slide gets a fresh instance id', () => {
    const t = createTransport(lessonOf({ slides: 2 }), createTestPorts())
    const first = t.goToSlide(0).instanceId
    t.goToSlide(1)
    const second = t.goToSlide(0).instanceId
    expect(second).not.toBe(first)
  })

  it('advancing past the last slide completes the lesson', () => {
    const t = createTransport(lessonOf({ slides: 2 }), createTestPorts())
    t.goToSlide(1)
    expect(t.goToSlide(2).state).toBe('completed')
  })
})
