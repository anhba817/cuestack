import type { MigrationStep } from '../types.js'

/**
 * The terminal step for 1.0. It does nothing, and that is the point: the chain
 * must reach the current version by an unbroken path, so the newest version
 * always has an entry even when there is nothing to transform.
 */
export const v1_0: MigrationStep = {
  from: '1.0',
  to: '1.0',
  up(manifest) {
    return manifest
  },
}
