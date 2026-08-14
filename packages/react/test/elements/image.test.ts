import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * US4 #3 · FR-015 · FR-018.
 *
 * Alternative text is exposed, intrinsic dimensions are declared before the bytes
 * arrive, and a failed load leaves reserved space and a description.
 *
 * The dimensions requirement is the reason the manifest carries `width` and `height` on
 * an asset reference at all: without them the slide holds the wrong shape while loading
 * and corrects itself on load, which is the layout shift SC-004 forbids.
 */

const imageEl = (payload: Record<string, unknown>, accessibility?: Record<string, unknown>) =>
  element({
    id: 'img',
    type: 'image',
    effects: [],
    payload,
    ...(accessibility ? { accessibility } : {}),
  })

const asset = { assetId: 'https://example.test/worker.webp', mimeType: 'image/webp', width: 1200, height: 900 }

const render = (el: ReturnType<typeof element>): string =>
  server(h(LessonPlayer, { lesson: lessonOf([slide([el])]) }))

describe('the image renderer', () => {
  it('exposes the author\'s alternative text', () => {
    const markup = render(imageEl({ asset }, { altText: 'Worker wearing safety equipment' }))
    expect(markup).toContain('alt="Worker wearing safety equipment"')
  })

  it('declares intrinsic dimensions before the image loads', () => {
    const markup = render(imageEl({ asset }, { altText: 'A worker' }))
    expect(markup).toMatch(/width="1200"/)
    expect(markup).toMatch(/height="900"/)
  })

  it('marks an image with no alternative text as decorative rather than unnamed', () => {
    // `alt=""` and a missing `alt` are different: the first tells a screen reader to
    // skip, the second makes it read the filename. An author who supplied nothing meant
    // the first far more often than the second.
    const markup = render(imageEl({ asset }))
    expect(markup).toMatch(/alt=""/)
  })

  it('renders a caption as a figure caption rather than loose text', () => {
    const markup = render(imageEl({ asset, caption: 'Correct use of equipment' }, { altText: 'A worker' }))
    expect(markup).toContain('Correct use of equipment')
    expect(markup).toMatch(/<figcaption/)
  })

  it('does not repeat the caption as the accessible name', () => {
    // A caption is already read as part of the figure. Duplicating it into `alt` makes a
    // screen reader announce the same sentence twice.
    const markup = render(imageEl({ asset, caption: 'Same words' }, { altText: 'Same words' }))
    expect(markup.match(/Same words/g)?.length).toBe(1)
  })

  it('reserves space and describes the gap when the asset cannot be addressed', () => {
    // An opaque assetId with no host resolver. Reserved space plus a description, not a
    // broken image and not a collapsed layout (FR-018).
    const markup = render(
      imageEl({ asset: { assetId: 'asset_worker_image', mimeType: 'image/webp', width: 1200, height: 900 } }),
    )
    expect(markup).toContain('cs-asset-fallback')
    expect(markup).not.toMatch(/<img[^>]*src="asset_worker_image"/)
    expect(markup).toMatch(/image/i)
  })

  it('keeps the fallback announced rather than silent', () => {
    const markup = render(
      imageEl(
        { asset: { assetId: 'asset_worker_image', mimeType: 'image/webp' } },
        { altText: 'Worker wearing safety equipment' },
      ),
    )
    // The author's description is the most useful thing to say when the image is absent.
    expect(markup).toContain('Worker wearing safety equipment')
    expect(markup).toMatch(/role="img"/)
  })

  it('does not lazily load — the first slide is the one being looked at', () => {
    // `loading="lazy"` on above-the-fold content delays the thing the learner is
    // waiting for, which is the opposite of what the server render bought.
    expect(render(imageEl({ asset }, { altText: 'A worker' }))).not.toContain('loading="lazy"')
  })
})
