import type { MigrationStep } from '../types.js'
import { v0_9_to_1_0 } from './v0_9.js'
import { v1_0 } from './v1_0.js'

/**
 * The ordered chain. Every version change registers a step here, including the
 * no-op ones: gap detection depends on the chain staying contiguous, so a
 * "nothing to do" step is not optional bookkeeping — it is what makes a genuine
 * gap distinguishable from a version nobody bothered to record.
 */
export const STEPS: readonly MigrationStep[] = [v0_9_to_1_0, v1_0]
