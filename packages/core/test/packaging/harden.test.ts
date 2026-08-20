import { describe, expect, it, vi } from 'vitest'
import { readPackage, HARDENING_DEFAULTS } from '../../src/packaging/index.js'
import { exportLesson } from '../../src/packaging/index.js'
import { withAddress, withoutAssets } from '../harness/packages.js'

const good = () => JSON.stringify(exportLesson(withoutAssets(), { kind: 'draft' }))

/**
 * A package is a file somebody was emailed. These are the attacks that are worth defending against
 * and the boundary that is deliberately not defended — FR-016c requires the second to be documented
 * rather than implied, and an undocumented boundary is read as a guarantee.
 */
describe('hardening', () => {
  it('refuses an oversized package before parsing it', () => {
    /**
     * "Before parsing" is asserted rather than assumed: the parser is a spy that must never be
     * called. A check that discovered the problem by parsing has already done the expensive thing.
     */
    const parse = vi.fn(JSON.parse)
    const huge = 'x'.repeat(HARDENING_DEFAULTS.maxBytes + 1)

    const result = readPackage(huge, { parse })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too-large')
    expect(parse).not.toHaveBeenCalled()
  })

  it('refuses nesting deeper than the bound', () => {
    let nested = '1'
    for (let i = 0; i < HARDENING_DEFAULTS.maxDepth + 5; i += 1) nested = `[${nested}]`
    const result = readPackage(nested)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(['too-deep', 'unreadable']).toContain(result.reason)
  })

  it('lets a caller raise the bounds for a lesson that needs it', () => {
    const tiny = readPackage(good(), { maxBytes: 10 })
    expect(tiny.ok).toBe(false)
    expect(readPackage(good()).ok).toBe(true)
  })

  it('refuses an executable address, naming the field and the scheme', () => {
    const lesson = withAddress()
    const slide = lesson.slides[0]!
    const hostile = {
      ...lesson,
      slides: [
        {
          ...slide,
          elements: [
            {
              ...slide.elements[0]!,
              payload: { label: 'Go', action: 'open_url', url: 'javascript:alert(1)' },
            },
          ],
        },
      ],
    } as unknown as typeof lesson

    const result = readPackage(JSON.stringify(exportLesson(hostile, { kind: 'draft' })))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsafe-address')
    expect(result.message).toContain('url')
    expect(result.message).toContain('javascript')
  })

  it('refuses a data: address too, and allows the three that cannot execute', () => {
    const withUrl = (url: string): string => {
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
                  { ...slide.elements[0]!, payload: { label: 'Go', action: 'open_url', url } },
                ],
              },
            ],
          } as typeof lesson,
          { kind: 'draft' },
        ),
      )
    }

    for (const url of ['https://example.org', 'http://example.org', 'mailto:a@example.org']) {
      expect(readPackage(withUrl(url)).ok).toBe(true)
    }
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'JavaScript:alert(1)']) {
      expect(readPackage(withUrl(url)).ok).toBe(false)
    }
  })

  it('checks addresses by key rather than by element type', () => {
    /**
     * A check written as `if (element.type === 'button')` is a switch on element type inside core,
     * which Constitution I calls a defect — and the linter does not catch the `if` form, only
     * `switch`. It would also miss a third-party plugin carrying an address, which is this case.
     */
    const lesson = withoutAssets()
    const slide = lesson.slides[0]!
    const plugin = {
      ...lesson,
      slides: [
        {
          ...slide,
          elements: [
            { ...slide.elements[0]!, payload: { text: 'x', link: { href: 'javascript:alert(1)' } } },
          ],
        },
      ],
    } as unknown as typeof lesson

    const result = readPackage(JSON.stringify(exportLesson(plugin, { kind: 'draft' })))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsafe-address')
  })

  it('refuses something that is not a package at all', () => {
    for (const text of ['', 'not json', '{"a":1}', '[]', 'null']) {
      const result = readPackage(text)
      expect(result.ok).toBe(false)
    }
  })

  it('does NOT inspect asset content, and the limit is documented rather than implied', () => {
    /**
     * FR-016c. The framework renders nothing itself, so sanitizing embedded content would mean
     * guessing at a renderer — and a check that guesses wrong reads as protection while providing
     * none. An embedded document that could carry a script is imported unexamined, and this asserts
     * that the boundary is where the documentation says it is.
     */
    const pkg = {
      ...exportLesson(withoutAssets(), { kind: 'draft' }),
      assetMode: 'files' as const,
      assets: [
        {
          assetId: 'a',
          mediaType: 'image/svg+xml',
          // An SVG carrying a script, Base64. Not inspected, by decision.
          content: 'PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
        },
      ],
    }
    expect(readPackage(JSON.stringify(pkg)).ok).toBe(true)
  })
})
