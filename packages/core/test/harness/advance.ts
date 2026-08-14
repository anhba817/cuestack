import type { Slide } from '@cuestack/schema'
import { createAdvanceController, type AdvanceController, type AdvanceSignals } from '../../src/advance/controller.js'
import type { TransportSnapshot } from '../../src/time/transport.js'
import { createTestPorts, type TestPorts } from './ports.js'

/** A transport snapshot without needing a transport — US2 is testable alone
 *  because the controller takes injected signals, not resolved state. */
export function snapshot(overrides: Partial<TransportSnapshot> = {}): TransportSnapshot {
  return {
    state: 'playing',
    slideIndex: 0,
    slideTimeMs: 0,
    instanceId: 'slide_a#1',
    ...overrides,
  }
}

export function signals(overrides: Partial<AdvanceSignals> = {}): AdvanceSignals {
  return {
    learnerAdvanced: false,
    completedInteractions: new Set<string>(),
    ...overrides,
  }
}

export interface AdvanceHarness {
  controller: AdvanceController
  ports: TestPorts
  evaluate(slide: Slide, snap?: Partial<TransportSnapshot>, sig?: Partial<AdvanceSignals>): ReturnType<AdvanceController['evaluate']>
}

export function createAdvanceHarness(): AdvanceHarness {
  const ports = createTestPorts()
  const controller = createAdvanceController(ports)
  return {
    controller,
    ports,
    evaluate(slide, snap = {}, sig = {}) {
      return controller.evaluate(slide, snapshot(snap), signals(sig))
    },
  }
}
