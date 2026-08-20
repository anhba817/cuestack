import { describe, it } from 'vitest'
import {
  assertAssets,
  assertConflict,
  assertPublishing,
  assertRestoreToken,
  assertSaveHandshake,
} from './behaviour.js'
import { SHAPES } from './harness/shapes.js'
import { lesson } from './harness/lesson.js'

/**
 * SC-008, and the reason it is two shapes rather than one.
 *
 * A single API shape cannot demonstrate the adapter is not quietly built around it. These differ in
 * path structure (flat vs nested under a course), in how the version token travels (body vs an
 * ETag-shaped header), and in how a conflict is signalled (409 vs 412 with a flag) — and **only the
 * mapping changes** between the runs.
 *
 * The second shape has already earned its place: writing it is what found that `read` needed the
 * whole response rather than the body alone, because a token in a header is unreadable otherwise.
 */
describe.each(SHAPES.map((shape) => [shape.name, shape] as const))(
  'the %s API shape',
  (_name, shape) => {
    it('handles the save handshake', () => assertSaveHandshake(shape, lesson()))
    it('reports a conflict its own way', () => assertConflict(shape, lesson()))
    it('returns the current draft token on restore', () => assertRestoreToken(shape, lesson()))
    it('publishes, withdraws, restores, and records', () => assertPublishing(shape, lesson()))
    it('resolves assets', () => assertAssets(shape, lesson()))
  },
)
