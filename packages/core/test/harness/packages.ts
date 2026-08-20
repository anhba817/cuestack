import type { LessonManifest } from '@cuestack/schema'
import { lessonOf } from './lesson.js'

/**
 * Lessons shaped for the packaging suites, each carrying one property those suites need.
 *
 * Separate from `faulty.ts`, whose fixtures each carry one deliberate *fault*. These carry one
 * deliberate *shape* — assets or none, an address or none, valid or not — and the distinction is
 * worth the second file: a suite reaching into the fault corpus for "a lesson with assets" would
 * bind packaging's tests to whatever fault that lesson happened to also have.
 */

type Element = LessonManifest['slides'][number]['elements'][number]

const IMAGE = { assetId: 'asset_photo', mimeType: 'image/png' }
const AUDIO = { assetId: 'asset_clip', mimeType: 'audio/mpeg' }

const element = (over: Record<string, unknown>): Element =>
  ({
    id: 'e1',
    type: 'text',
    x: 0,
    y: 0,
    width: 400,
    height: 80,
    zIndex: 0,
    startMs: 0,
    endMs: 8000,
    payload: { text: 'content' },
    ...over,
  }) as unknown as Element

function withElements(elements: Element[]): LessonManifest {
  const lesson = lessonOf({ slides: 1 })
  return { ...lesson, slides: [{ ...lesson.slides[0]!, elements }] } as LessonManifest
}

/**
 * Two elements sharing one asset, plus a second asset.
 *
 * The sharing is the point: FR-009 requires each distinct asset to appear once however many
 * elements reference it, and a fixture where every asset is referenced once cannot show it.
 */
export const withAssets = (): LessonManifest =>
  withElements([
    element({
      id: 'img_a',
      type: 'image',
      payload: { asset: IMAGE },
      accessibility: { altText: 'A diagram' },
    }),
    element({
      id: 'img_b',
      type: 'image',
      payload: { asset: IMAGE },
      accessibility: { altText: 'The same diagram again' },
    }),
    element({
      id: 'clip',
      type: 'audio',
      payload: { asset: AUDIO },
      accessibility: { label: 'Narration' },
    }),
  ])

/** Nothing to fetch, so files mode and reference mode produce the same document. */
export const withoutAssets = (): LessonManifest =>
  withElements([element({ id: 't1', payload: { text: 'All words, no media.' } })])

/** A button whose address is ordinary. The hostile variants are built from this one. */
export const withAddress = (): LessonManifest =>
  withElements([
    element({
      id: 'go',
      type: 'button',
      payload: { label: 'Read more', action: 'open_url', url: 'https://example.org/more' },
      accessibility: { label: 'Read more about this topic' },
    }),
  ])

/**
 * A lesson the format rejects.
 *
 * FR-008 requires export to work on one, and a corpus of only valid lessons cannot show that. The
 * fault is a negative duration — structural, so `validate` refuses it, and nothing about it stops a
 * teacher from being handed their own work.
 */
export const invalidLesson = (): LessonManifest => {
  const lesson = withoutAssets()
  return {
    ...lesson,
    slides: [{ ...lesson.slides[0]!, durationMs: -1 }],
  } as unknown as LessonManifest
}

/** The asset ids `withAssets` references, in the order a walk finds them. */
export const ASSET_IDS = ['asset_photo', 'asset_clip'] as const
