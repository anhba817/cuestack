import { describe, expect, it } from 'vitest'
import { memoryAdapters } from '../../src/adapters/memory/index.js'
import { createTransport } from '../../src/time/transport.js'
import { createAdvanceController } from '../../src/advance/controller.js'
import { resolve } from '../../src/resolve/index.js'
import { lessonOf } from '../harness/lesson.js'
import { createSyntheticClock } from '../harness/clock.js'

/**
 * FR-032: the framework works with no host implementation configured.
 *
 * That is what makes "the framework ships no backend" a workable position rather
 * than a limitation — resolve and playback can be exercised, and the Next.js
 * example can run, before anyone writes a backend.
 */
describe('default adapters', () => {
  it('memoryAdapters supplies all three interfaces', () => {
    const adapters = memoryAdapters()
    expect(typeof adapters.storage.loadDraft).toBe('function')
    expect(typeof adapters.assets.resolve).toBe('function')
    expect(typeof adapters.analytics.record).toBe('function')
  })

  it('a transport runs against them with no host code', () => {
    const clock = createSyntheticClock()
    const lesson = lessonOf()
    const transport = createTransport(lesson, {
      time: clock,
      visibility: { isHidden: () => false, subscribe: () => () => undefined },
    })
    expect(transport.play().state).toBe('playing')
  })

  it('an advance controller runs with no media attached', () => {
    const controller = createAdvanceController(undefined)
    const lesson = lessonOf()
    const decision = controller.evaluate(
      lesson.slides[0]!,
      { state: 'playing', slideIndex: 0, slideTimeMs: 99_999, instanceId: 'a#1' },
      { learnerAdvanced: false, completedInteractions: new Set() },
    )
    expect(decision?.cause).toBe('duration')
  })

  it('resolve needs no adapters at all', () => {
    const lesson = lessonOf()
    expect(resolve(lesson.slides[0]!, 0).slideId).toBe(lesson.slides[0]!.id)
  })

  it('assets resolve to a usable location', async () => {
    const location = await memoryAdapters().assets.resolve('asset_1')
    expect(location?.url).toContain('asset_1')
  })
})
