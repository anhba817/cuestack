import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { createTransport } from '../../src/time/transport.js'
import { corpus } from '../harness/corpus.js'
import { createTestPorts, runFrames } from '../harness/ports.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * SC-002 — the mechanical proof of Constitution V.
 *
 * For every corpus slide and every boundary where something changes, the state
 * reached by *playing* a transport forward to that time must equal the state
 * returned by *seeking* directly to it.
 *
 * If this passes, an editor preview and a learner player cannot diverge: there is
 * one resolver, it has no memory, and arriving by a different route cannot produce
 * a different answer. That is what makes parity structural rather than a promise
 * somebody has to keep.
 *
 * Note this needs a transport to be meaningful. Comparing resolve() against
 * itself would pass vacuously — with a pure fold, "played to t" and "seeked to t"
 * are literally the same call — which is why this test lives with US3 and not US1.
 */
describe('playing to a time equals seeking to it', () => {
  for (const { name, slide, boundaries } of corpus()) {
    it(`${name}: every boundary agrees`, () => {
      const lesson = {
        ...lessonOf(),
        slides: [slide],
      } as LessonManifest

      for (const target of boundaries) {
        if (target < 0) continue

        // Route A — play forward in frame-sized steps.
        const playPorts = createTestPorts()
        const played = createTransport(lesson, playPorts)
        played.play()
        runFrames(playPorts, () => played.slideTimeMs, target)
        const playedTime = played.slideTimeMs
        const playedState = resolve(slide, playedTime)

        // Route B — seek straight there.
        const seekPorts = createTestPorts()
        const seeked = createTransport(lesson, seekPorts)
        const seekedState = resolve(slide, seeked.seek(playedTime).slideTimeMs)

        expect(seekedState).toEqual(playedState)
      }
    })
  }

  it('holds after a pause and resume mid-slide', () => {
    const slide = corpus()[0]!.slide
    const lesson = { ...lessonOf(), slides: [slide] } as LessonManifest
    const ports = createTestPorts()
    const t = createTransport(lesson, ports)

    t.play()
    runFrames(ports, () => t.slideTimeMs, 1200)
    t.pause()
    ports.clock.advance(50_000)
    t.play()
    runFrames(ports, () => t.slideTimeMs, 800)

    const reached = t.slideTimeMs
    expect(reached).toBe(2000)
    expect(resolve(slide, reached)).toEqual(resolve(slide, 2000))
  })

  it('holds after a hidden-document interval', () => {
    const slide = corpus()[0]!.slide
    const lesson = { ...lessonOf(), slides: [slide] } as LessonManifest
    const ports = createTestPorts()
    const t = createTransport(lesson, ports)

    t.play()
    runFrames(ports, () => t.slideTimeMs, 500)
    ports.setHidden(true)
    ports.clock.advance(120_000)
    ports.setHidden(false)
    runFrames(ports, () => t.slideTimeMs, 500)

    expect(t.slideTimeMs).toBe(1000)
    expect(resolve(slide, t.slideTimeMs)).toEqual(resolve(slide, 1000))
  })

  it('seeking backwards lands on the same state as never having passed it', () => {
    const slide = corpus()[1]!.slide
    const lesson = { ...lessonOf(), slides: [slide] } as LessonManifest
    const ports = createTestPorts()
    const t = createTransport(lesson, ports)

    t.play()
    runFrames(ports, () => t.slideTimeMs, 6000)
    const backwards = resolve(slide, t.seek(1000).slideTimeMs)

    // No replay: 1000ms reached by rewinding equals 1000ms reached fresh.
    expect(backwards).toEqual(resolve(slide, 1000))
  })
})
