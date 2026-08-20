import { describe, expect, it } from 'vitest'
import { exportLesson, readPackage } from '../../src/packaging/index.js'
import { withAddress } from '../harness/packages.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * NFR-SEC-007 for the import path: content is checked against script injection.
 *
 * Named for the requirement because that is what it discharges, and this is the one place in the
 * feature where an attacker is the adversary rather than an accident. A package is a file somebody
 * was emailed; a button's address is followed by a learner's click, inside the host's application.
 *
 * **The hole is wider than import, and this feature does not close it.** `elementSchema` declares a
 * button's address as `url: z.string().max(2000).optional()` — no scheme constraint — so a lesson
 * authored in this editor can already carry `javascript:` today. Tightening the schema would reject
 * manifests that are valid now and needs its own decision about versioning and migration
 * (research R-06). Recorded in the framework plan rather than fixed here.
 */
const packagedWithUrl = (url: string): string => {
  const lesson = withAddress()
  const slide = lesson.slides[0]!
  const manifest = {
    ...lesson,
    slides: [
      {
        ...slide,
        elements: [{ ...slide.elements[0]!, payload: { label: 'Go', action: 'open_url', url } }],
      },
    ],
  } as unknown as LessonManifest
  return JSON.stringify(exportLesson(manifest, { kind: 'draft' }))
}

describe('NFR-SEC-007', () => {
  const allowed = ['https://example.org/a', 'http://example.org/a', 'mailto:teacher@example.org']
  const refused = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
  ]

  for (const url of allowed) {
    it(`allows ${url.split(':')[0]}`, () => {
      expect(readPackage(packagedWithUrl(url)).ok).toBe(true)
    })
  }

  for (const url of refused) {
    it(`refuses ${JSON.stringify(url.slice(0, 22))}`, () => {
      const result = readPackage(packagedWithUrl(url))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('unsafe-address')
    })
  }

  it('names the field and the scheme, so the reason is actionable', () => {
    const result = readPackage(packagedWithUrl('javascript:alert(1)'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('url')
    expect(result.message.toLowerCase()).toContain('javascript')
  })

  it('is case- and whitespace-insensitive, because an attacker reads the check too', () => {
    for (const url of ['JaVaScRiPt:alert(1)', '\tjavascript:alert(1)', '\njavascript:alert(1)']) {
      expect(readPackage(packagedWithUrl(url)).ok).toBe(false)
    }
  })
})
