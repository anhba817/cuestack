import type { IdSource } from '../../src/draft/ids.js'

/**
 * A counter, so an edit sequence produces the same manifest every time.
 *
 * The reason the id source is injectable at all (FR-050, research R-08). Wave 1 made the
 * clock injectable for the same reason: a test that cannot predict its own output cannot
 * assert on it, and SC-016 asks for a byte-identical manifest from a replayed sequence.
 */
export function countingIds(prefix = 'el'): IdSource {
  let n = 0
  return () => `${prefix}-${++n}`
}
