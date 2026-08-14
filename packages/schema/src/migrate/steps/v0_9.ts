import type { MigrationStep } from '../types.js'

/**
 * 0.9 -> 1.0: the lesson metadata block was named `metadata` and moved to
 * `lesson`, freeing `metadata` for the per-slide string map it holds today.
 */
export const v0_9_to_1_0: MigrationStep = {
  from: '0.9',
  to: '1.0',
  up(manifest) {
    const input = manifest as Record<string, unknown>
    const { metadata, ...rest } = input
    return { ...rest, lesson: metadata, schemaVersion: '1.0' }
  },
}
