import { describe, expect, it } from 'vitest'
import { exportLesson, importLesson, readPackage, HARDENING_DEFAULTS } from '../../src/packaging/index.js'
import { withAddress, withoutAssets } from '../harness/packages.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * FR-031 and NFR-USA-004: a code is not a message.
 *
 * `too-deep` tells a teacher nothing, and these refusals are the **only** thing they will see when a
 * package does not open — there is no lesson to look at and no report to read. Feature 009 shipped
 * the same suite for its validation report and it caught real degradation.
 */
const packaged = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...exportLesson(withoutAssets(), { kind: 'draft' }), ...over })

const hostileUrl = (): string => {
  const lesson = withAddress()
  const slide = lesson.slides[0]!
  return JSON.stringify(
    exportLesson(
      {
        ...lesson,
        slides: [
          {
            ...slide,
            elements: [
              { ...slide.elements[0]!, payload: { label: 'Go', action: 'open_url', url: 'javascript:x' } },
            ],
          },
        ],
      } as unknown as LessonManifest,
      { kind: 'draft' },
    ),
  )
}

/**
 * Read or import, because the refusals are split between the two steps by design: reading answers
 * "is this a package", importing answers "is this a lesson I can carry forward".
 */
const refusalFor = (text: string) => {
  const read = readPackage(text)
  if (!read.ok) return read
  return importLesson(read.package, { lessonId: 'mine' })
}

const olderLesson = (): string => {
  const current = withoutAssets()
  const ancient = { schemaVersion: '9.9', lesson: current.lesson, slides: current.slides }
  return JSON.stringify({
    ...exportLesson(ancient as unknown as LessonManifest, { kind: 'draft' }),
    schemaVersion: '9.9',
  })
}

const CASES: [string, string][] = [
  ['too-large', 'x'.repeat(HARDENING_DEFAULTS.maxBytes + 1)],
  ['unreadable', 'not a package at all'],
  ['package-version-unsupported', packaged({ packageVersion: '99.0' })],
  ['lesson-version-unsupported', olderLesson()],
  ['unsafe-address', hostileUrl()],
]

describe('every refusal a teacher can meet', () => {
  for (const [reason, text] of CASES) {
    it(`${reason}: says what is wrong and what to do`, () => {
      const result = refusalFor(text)
      expect(result.ok).toBe(false)
      if (result.ok) return

      // A sentence, not a token.
      expect(result.message.length).toBeGreaterThan(40)
      expect(result.message).not.toBe(result.reason)
      expect(result.message.trimEnd().endsWith('.')).toBe(true)
      // Nothing a teacher cannot act on: no bare identifiers standing in for prose.
      expect(result.message).not.toMatch(/^[A-Z_]+$/)
    })
  }

  it('says five different things', () => {
    const messages = new Set<string>()
    for (const [, text] of CASES) {
      const result = refusalFor(text)
      if (!result.ok) messages.add(result.message)
    }
    // A teacher told the same sentence about a corrupt file and about a version they cannot read
    // learns nothing from either.
    expect(messages.size).toBe(CASES.length)
  })

  it('a too-deep package explains itself too', () => {
    let nested = '1'
    for (let i = 0; i < HARDENING_DEFAULTS.maxDepth + 5; i += 1) nested = `[${nested}]`
    const result = readPackage(nested)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message.length).toBeGreaterThan(40)
  })
})
