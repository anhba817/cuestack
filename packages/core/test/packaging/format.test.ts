import { describe, expect, it } from 'vitest'
import {
  PACKAGE_FORMAT_VERSION,
  comparePackageVersions,
  isLessonPackage,
} from '../../src/packaging/format.js'
import { withAssets, withoutAssets } from '../harness/packages.js'

/**
 * The guard, tested one malformation at a time.
 *
 * A case carrying two faults tests that the guard rejects *something*; a case carrying one tests
 * that it rejects *that*, and a regression in any single check shows up as a named failure rather
 * than as a count that moved.
 */
const wellFormed = (over: Record<string, unknown> = {}): unknown => ({
  packageVersion: PACKAGE_FORMAT_VERSION,
  schemaVersion: '1.0',
  kind: 'draft',
  assetMode: 'references',
  lesson: withoutAssets(),
  assets: [],
  ...over,
})

describe('the package guard', () => {
  it('accepts a well-formed document', () => {
    expect(isLessonPackage(wellFormed())).toBe(true)
  })

  it('accepts one carrying files-mode assets', () => {
    expect(
      isLessonPackage(
        wellFormed({
          assetMode: 'files',
          lesson: withAssets(),
          assets: [{ assetId: 'asset_photo', mediaType: 'image/png', content: 'AAAA' }],
        }),
      ),
    ).toBe(true)
  })

  const malformations: [string, Record<string, unknown>][] = [
    ['no packageVersion', { packageVersion: undefined }],
    ['no schemaVersion', { schemaVersion: undefined }],
    ['no kind', { kind: undefined }],
    ['a kind nobody declared', { kind: 'archived' }],
    ['no assetMode', { assetMode: undefined }],
    ['an assetMode nobody declared', { assetMode: 'embedded' }],
    ['no lesson', { lesson: undefined }],
    ['no assets list', { assets: undefined }],
    ['an asset with no mediaType', { assets: [{ assetId: 'a' }] }],
    ['an asset with no assetId', { assets: [{ mediaType: 'image/png' }] }],
  ]

  for (const [name, over] of malformations) {
    it(`rejects ${name}`, () => {
      expect(isLessonPackage(wellFormed(over))).toBe(false)
    })
  }

  it('rejects files mode carrying an asset with no content', () => {
    /**
     * The one malformation that is about agreement between two fields rather than about a field.
     * `assetMode` is the claim a reader trusts before it looks at anything else, and a document
     * saying `files` while carrying references would have a reader treat an incomplete package as
     * complete — the failure the mode distinction exists to prevent.
     */
    expect(
      isLessonPackage(
        wellFormed({ assetMode: 'files', assets: [{ assetId: 'a', mediaType: 'image/png' }] }),
      ),
    ).toBe(false)
  })

  it('rejects things that are not documents at all', () => {
    for (const value of [null, undefined, 'a string', 42, [], () => {}]) {
      expect(isLessonPackage(value)).toBe(false)
    }
  })
})

describe('the package version comparator', () => {
  it('orders versions numerically rather than as text', () => {
    // '1.10' after '1.9' is the case string comparison gets wrong, and the one that arrives
    // eventually rather than never.
    expect(comparePackageVersions('1.10', '1.9')).toBeGreaterThan(0)
    expect(comparePackageVersions('1.0', '1.0')).toBe(0)
    expect(comparePackageVersions('0.9', '1.0')).toBeLessThan(0)
  })

  it('treats a missing segment as zero', () => {
    expect(comparePackageVersions('1', '1.0')).toBe(0)
  })

  it('covers only the package format version', () => {
    /**
     * Research R-05: the lesson version is `migrate`'s entirely. This comparator exists because
     * packaging has a version of its own; a second lesson-version comparison anywhere would be a
     * second place to disagree with the one that already distinguishes newer from older well.
     */
    expect(PACKAGE_FORMAT_VERSION).toBe('1.0')
  })
})
