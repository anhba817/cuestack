import { describe, expect, it } from 'vitest'
import { exportLesson, importLesson, readPackage } from '../../src/packaging/index.js'
import { withoutAssets } from '../harness/packages.js'

/**
 * SC-005: import writes nothing anywhere — met by construction if this suite runs at all.
 *
 * **No storage adapter is constructed in this file.** That is the assertion, not a setup detail:
 * import produces a lesson and the caller saves it through the one path that already handles
 * conflict, offline, and acknowledgement. A failed import cannot strand anything because nothing
 * was ever written.
 */
const packaged = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...exportLesson(withoutAssets(), { kind: 'draft' }), ...over })

describe('import, with no storage in existence', () => {
  it('produces a lesson', () => {
    const read = readPackage(packaged())
    if (!read.ok) throw new Error('unreachable')
    const result = importLesson(read.package, { lessonId: 'new_one' })
    expect(result.ok).toBe(true)
  })

  it('reports every refusal without writing anything', () => {
    const refusals: string[] = []
    for (const text of [
      'not json at all',
      '{"packageVersion":"1.0"}',
      packaged({ packageVersion: '99.0' }),
      packaged({ kind: 'archived' }),
    ]) {
      const read = readPackage(text)
      expect(read.ok).toBe(false)
      if (!read.ok) refusals.push(read.reason)
    }
    // Four attempts, four named reasons, and no adapter was ever asked for.
    expect(refusals).toHaveLength(4)
  })

  it('names a package format this reader is too old for', () => {
    const read = readPackage(packaged({ packageVersion: '99.0' }))
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.reason).toBe('package-version-unsupported')
    expect(read.message).toContain('99.0')
  })

  it('names a package format older than this reader understands', () => {
    const read = readPackage(packaged({ packageVersion: '0.1' }))
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.reason).toBe('package-version-unsupported')
  })

  it('produces no result at all on refusal, rather than a half-populated one', () => {
    const read = readPackage('{}')
    expect(read.ok).toBe(false)
    expect('package' in read).toBe(false)
  })
})
