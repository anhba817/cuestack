import { describe, expect, it } from 'vitest'
import { createAdvanceController } from '../../src/advance/controller.js'
import { createTestPorts } from '../harness/ports.js'
import { signals, snapshot } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/**
 * FR-024 / US2 #8: the override exists for testing and must be unreachable in
 * normal playback. A test affordance that leaks into the player is worse than no
 * affordance, because it will eventually be triggered by accident.
 */
describe('progression override', () => {
  const gated = slide(
    [textElement({ id: 'q', type: 'question', startMs: 0, endMs: 9000, effects: [], payload: { interactionType: 'true_false', prompt: 'p', options: [{ id: 'y', label: 'Y' }, { id: 'n', label: 'N' }], correctResponse: 'y', required: true } })],
    { durationMs: 9000, advance: { mode: 'after_interaction', interactionElementId: 'q' } },
  )

  it('a controller built for normal playback will not advance a gated slide', () => {
    const controller = createAdvanceController(createTestPorts())
    expect(controller.evaluate(gated, snapshot({ slideTimeMs: 9000 }), signals())).toBeNull()
  })

  it('a controller built with the override advances it', () => {
    const controller = createAdvanceController(createTestPorts(), { allowOverride: true })
    const d = controller.evaluate(gated, snapshot({ slideTimeMs: 9000 }), signals({ overrideAdvance: true }))
    expect(d?.cause).toBe('override')
  })

  it('the override signal is inert unless the controller was built to allow it', () => {
    const controller = createAdvanceController(createTestPorts())
    expect(
      controller.evaluate(gated, snapshot({ slideTimeMs: 9000 }), signals({ overrideAdvance: true })),
    ).toBeNull()
  })

  it('defaults to disallowed, so forgetting the option is safe', () => {
    const controller = createAdvanceController(createTestPorts(), {})
    expect(
      controller.evaluate(gated, snapshot({ slideTimeMs: 9000 }), signals({ overrideAdvance: true })),
    ).toBeNull()
  })
})
