import { afterEach, describe, expect, it } from 'vitest'
import { mount, rendered } from './harness/mount.js'
import { covered } from './harness/lessons.js'
import type { LessonManifest } from '@cuestack/schema'

let mounted: { unmount(): void } | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const withText = (text: string): LessonManifest => {
  const lesson = covered()
  const slide = lesson.slides[0]!
  return {
    ...lesson,
    slides: [{ ...slide, elements: [{ ...slide.elements[0]!, payload: { text } }] }],
  } as unknown as LessonManifest
}

/**
 * The protection React gave for free, and which does not come along.
 *
 * React escapes children, and its escape hatch is banned by a rule whose selectors only exist in JSX.
 * A custom element writing a DOM by hand has neither, and lesson text is author-supplied — a package
 * imported from elsewhere may have been written by anybody.
 *
 * The lint rule stops `innerHTML`; this proves the thing the rule exists to protect.
 */
describe('author-supplied content is text, never markup', () => {
  it('renders a script tag as characters', async () => {
    const m = (mounted = await mount(withText('<script>alert(1)</script>')))
    const node = rendered(m.root).get('title')!

    expect(node.textContent).toBe('<script>alert(1)</script>')
    expect(node.querySelector('script')).toBeNull()
  })

  it('creates no element the manifest did not describe', async () => {
    const m = (mounted = await mount(withText('<img src=x onerror="alert(1)"><b>bold</b>')))
    expect(m.root.querySelectorAll('img')).toHaveLength(0)
    expect(m.root.querySelectorAll('b')).toHaveLength(0)
  })

  it('escapes in alt text too, which is the field people forget', async () => {
    const lesson = covered()
    const slide = lesson.slides[0]!
    const hostile = {
      ...lesson,
      slides: [
        {
          ...slide,
          elements: [
            {
              ...slide.elements[0]!,
              id: 'diagram',
              type: 'image',
              payload: { asset: { assetId: 'a', mimeType: 'image/png' } },
              accessibility: { altText: '"><script>alert(1)</script>' },
            },
          ],
        },
      ],
    } as unknown as LessonManifest

    const m = (mounted = await mount(hostile, { resolveAsset: () => 'https://cdn.test/a.png' }))
    expect(m.root.querySelectorAll('script')).toHaveLength(0)
    expect(m.root.querySelector('img')?.getAttribute('alt')).toBe('"><script>alert(1)</script>')
  })
})
