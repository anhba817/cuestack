import { describe, expect, it } from 'vitest'
import { exportLesson } from '../../src/packaging/index.js'
import { withAssets, withAddress } from '../harness/packages.js'

/**
 * FR-005 and SC-003, asserted by walking the whole document.
 *
 * A check that named the fields it disapproved of would pass the day somebody added a field — which
 * is exactly when it would matter. So this walks every key and value in the produced document and
 * asserts that nothing resembling a credential, a learner, or a host's storage appears anywhere.
 */
const FORBIDDEN = [
  /token/i, /secret/i, /password/i, /credential/i, /authorization/i, /bearer/i, /api[-_]?key/i,
  /learner/i, /student/i, /session/i, /cookie/i,
  /storageKey/i, /bucket/i, /endpoint/i,
]

function everyString(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value)
  else if (Array.isArray(value)) for (const v of value) everyString(v, into)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.push(k)
      everyString(v, into)
    }
  }
  return into
}

describe('a package contains nothing it should not', () => {
  for (const [name, make] of [
    ['a lesson with assets', withAssets],
    ['a lesson with an address', withAddress],
  ] as const) {
    it(`carries no credential and no learner identity for ${name}`, () => {
      const strings = everyString(exportLesson(make(), { kind: 'draft' }))
      const offenders = strings.filter((s) => FORBIDDEN.some((p) => p.test(s)))
      expect(offenders).toEqual([])
    })
  }

  it('carries nothing about the host at all', () => {
    /**
     * Note what is absent from the top-level shape: no exporter identity, no timestamp, no host
     * address. Each would be either a leak or a value that goes stale against the manifest beside
     * it — and a teacher taking a copy is not an audit event.
     */
    const pkg = exportLesson(withAssets(), { kind: 'draft' })
    expect(Object.keys(pkg).sort()).toEqual([
      'assetMode',
      'assets',
      'kind',
      'lesson',
      'packageVersion',
      'schemaVersion',
    ])
  })
})
