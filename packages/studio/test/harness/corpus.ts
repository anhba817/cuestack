import type { Element, LessonManifest, Slide } from '@cuestack/schema'

/**
 * Fixtures for the editor's suites.
 *
 * Deliberately hand-built rather than reusing the player's corpus: every case here exists
 * because an *authoring* rule needs it, and several are states the player has no opinion
 * about — a locked element, two elements sharing a `zIndex`, text carrying markup. Named
 * builders rather than a fixture file, because a test that has to construct a manifest
 * inline stops asserting and starts describing.
 */

let seq = 0
/**
 * Deterministic within a file; every builder call advances it.
 *
 * Fixture ids use a prefix the generator never produces. `countingIds()` mints `el-1`, `el-2`,
 * and so did this builder — so duplicating a fixture element could mint an id the slide
 * already held, which the schema correctly refuses as a duplicate. It only failed when the
 * counter happened to be at 1, which made it order-dependent: the worst kind of red.
 */
const nextId = (prefix: string): string => `${prefix}-${++seq}`

export function element(overrides: Partial<Record<string, unknown>> = {}): Element {
  return {
    id: nextId('fx'),
    type: 'text',
    x: 100,
    y: 100,
    width: 400,
    height: 80,
    zIndex: 1,
    startMs: 0,
    endMs: 8000,
    payload: { text: 'content' },
    ...overrides,
  } as unknown as Element
}

export function slide(elements: Element[], overrides: Partial<Record<string, unknown>> = {}): Slide {
  return {
    id: nextId('slide'),
    durationMs: 8000,
    advance: { mode: 'after_duration' },
    elements,
    ...overrides,
  } as unknown as Slide
}

export function lessonOf(slides: Slide[]): LessonManifest {
  return {
    schemaVersion: '1.0',
    lesson: {
      id: nextId('lesson'),
      title: 'Editor fixture',
      aspectRatio: '16:9',
      language: 'en',
    },
    slides,
  } as unknown as LessonManifest
}

/** A lesson of one slide, which is what most editor tests want. */
export function lessonWith(elements: Element[], slideOverrides = {}): LessonManifest {
  return lessonOf([slide(elements, slideOverrides)])
}

/** An empty slide — the starting point of US1's Independent Test. */
export const emptySlide = (): LessonManifest => lessonOf([slide([])])

/** Outside its window at the low end: not yet, at an authoring time of 0. */
export const notYet = (): Element => element({ startMs: 4000, endMs: 8000 })

/** Outside its window at the high end: no longer, at an authoring time of 5000. */
export const noLonger = (): Element => element({ startMs: 0, endMs: 2000 })

/** Hidden: in the draft, absent from resolve(), still selectable on the canvas (BR-010). */
export const hidden = (): Element => element({ hidden: true })

/** Locked: selectable, not transformable, and — the trap — still unlockable (BR-011). */
export const locked = (): Element => element({ locked: true })

/** Two elements sharing a zIndex, so paint order has to break the tie deterministically. */
export const tied = (): Element[] => [element({ zIndex: 5 }), element({ zIndex: 5 })]

/** Text carrying markup, for the sanitization path (FR-046). */
export const withMarkup = (): Element =>
  element({ payload: { text: '<img src=x onerror="alert(1)">bold</img>' } })

/** One element of each of the seven MVP types, for registry and inspector sweeps. */
export function oneOfEachType(): Element[] {
  return [
    element({ type: 'text', payload: { text: 'a' } }),
    element({ type: 'image', payload: { asset: { assetId: 'img-1', mimeType: 'image/png' } } }),
    element({ type: 'shape', payload: { shape: 'rect' } }),
    element({ type: 'video', payload: { asset: { assetId: 'vid-1', mimeType: 'video/mp4' } } }),
    element({ type: 'audio', payload: { asset: { assetId: 'aud-1', mimeType: 'audio/mpeg' } } }),
    element({ type: 'button', payload: { label: 'Next', action: 'next_slide' } }),
    element({
      type: 'question',
      payload: {
        interactionType: 'multiple_choice',
        prompt: 'Which one?',
        options: [
          { id: 'o1', label: 'First' },
          { id: 'o2', label: 'Second' },
        ],
        correctResponse: 'o1',
        required: false,
      },
    }),
  ]
}
