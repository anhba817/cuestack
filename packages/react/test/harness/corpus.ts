import type { LessonManifest, Slide } from '@cuestack/schema'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }

/**
 * Slides for rendering tests. The reference manifest plus cases the reference does
 * not contain: every element type on one slide, an off-canvas element, and a theme
 * that omits a token a renderer wants.
 */

export const referenceLesson = reference as unknown as LessonManifest

let seq = 0
const id = (p: string) => `${p}_${++seq}`

export function element(overrides: Record<string, unknown> = {}): Slide['elements'][number] {
  return {
    id: id('el'),
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
  } as unknown as Slide['elements'][number]
}

export function slide(elements: Slide['elements'], overrides: Record<string, unknown> = {}): Slide {
  return {
    id: id('slide'),
    durationMs: 8000,
    advance: { mode: 'after_duration' },
    elements,
    ...overrides,
  } as unknown as Slide
}

export function lessonOf(slides: Slide[], theme: Record<string, string | number> = {}): LessonManifest {
  return {
    schemaVersion: '1.0',
    lesson: {
      id: 'lesson_render_test',
      title: 'Render Test',
      language: 'en',
      aspectRatio: '16:9',
      ...(Object.keys(theme).length > 0 ? { themeId: 'test' } : {}),
    },
    slides,
  } as unknown as LessonManifest
}

const asset = (mimeType: string, extra: Record<string, unknown> = {}) => ({
  assetId: 'asset_1',
  mimeType,
  ...extra,
})

/** One slide carrying all seven element types. */
export function allTypesSlide(): Slide {
  return slide([
    element({ id: 'el_text', type: 'text', zIndex: 1, payload: { text: 'Some words' } }),
    element({
      id: 'el_image',
      type: 'image',
      zIndex: 2,
      payload: { asset: asset('image/webp', { width: 1200, height: 900 }), caption: 'A caption' },
      accessibility: { altText: 'A worker wearing safety equipment' },
    }),
    element({ id: 'el_shape', type: 'shape', zIndex: 3, payload: { shape: 'rect' } }),
    element({
      id: 'el_video',
      type: 'video',
      zIndex: 4,
      payload: {
        asset: asset('video/mp4', { width: 1920, height: 1080, durationMs: 5000, captionTrack: 'cap_1' }),
        showControls: true,
      },
    }),
    element({
      id: 'el_audio',
      type: 'audio',
      zIndex: 5,
      payload: { asset: asset('audio/mpeg', { durationMs: 5000, transcript: 'tr_1' }), showControls: true },
    }),
    element({ id: 'el_button', type: 'button', zIndex: 6, payload: { label: 'Continue', action: 'next_slide' } }),
    element({
      id: 'el_question',
      type: 'question',
      zIndex: 7,
      payload: {
        interactionType: 'true_false',
        prompt: 'Near-misses must be reported.',
        options: [
          { id: 'yes', label: 'True' },
          { id: 'no', label: 'False' },
        ],
        correctResponse: 'yes',
        required: false,
      },
    }),
  ])
}

export interface CorpusEntry {
  name: string
  lesson: LessonManifest
}

export function corpus(): CorpusEntry[] {
  return [
    { name: 'reference lesson', lesson: referenceLesson },
    { name: 'all element types', lesson: lessonOf([allTypesSlide()]) },
    {
      name: 'element off-canvas',
      lesson: lessonOf([slide([element({ x: 1900, y: -200, effects: [] })])]),
    },
    {
      name: 'element entering later',
      lesson: lessonOf([slide([element({ id: 'later', startMs: 500, endMs: 8000, effects: [] })])]),
    },
    { name: 'empty slide', lesson: lessonOf([slide([])]) },
    {
      name: 'unregistered optional type',
      lesson: lessonOf([
        slide([
          element({ id: 'known', effects: [] }),
          element({ id: 'exotic', type: 'hologram', effects: [], payload: {} }),
        ]),
      ]),
    },
  ]
}
