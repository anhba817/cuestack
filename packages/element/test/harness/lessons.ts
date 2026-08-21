import type { LessonManifest } from '@cuestack/schema'

/**
 * Lessons shaped for what this adapter does and — more often — does not do.
 *
 * The covered set is `text`, `shape`, and `image`; `video`, `audio`, `button`, and `question` report
 * themselves unavailable. That makes the *unavailable* path the ordinary one rather than the edge
 * one, so two of the three fixtures below exist to exercise it.
 */

type Slide = LessonManifest['slides'][number]
type Element = Slide['elements'][number]

const element = (over: Record<string, unknown>): Element =>
  ({
    id: 'e1',
    type: 'text',
    x: 0,
    y: 0,
    width: 400,
    height: 80,
    zIndex: 1,
    startMs: 0,
    endMs: 8000,
    payload: { text: 'Hello' },
    ...over,
  }) as unknown as Element

const lesson = (slides: Slide[]): LessonManifest =>
  ({
    schemaVersion: '1.0',
    lesson: { id: 'lesson_test', title: 'Test', language: 'en', aspectRatio: '16:9' },
    slides,
  }) as unknown as LessonManifest

const slide = (elements: Element[], over: Record<string, unknown> = {}): Slide =>
  ({
    id: 'slide_0',
    durationMs: 8000,
    advance: { mode: 'after_duration' },
    elements,
    ...over,
  }) as unknown as Slide

/** Only what this adapter renders. Two elements with different lifetimes, so timing is observable. */
export const covered = (): LessonManifest =>
  lesson([
    slide([
      element({ id: 'title', payload: { text: 'Photosynthesis' } }),
      element({
        id: 'later',
        startMs: 4000,
        payload: { text: 'Appears halfway' },
      }),
      element({
        id: 'box',
        type: 'shape',
        y: 200,
        payload: { shape: 'rect' },
      }),
    ]),
  ])

/** One of each kind this adapter cannot show, so the unavailable path is exercised per type. */
export const uncovered = (): LessonManifest =>
  lesson([
    slide([
      element({
        id: 'clip',
        type: 'video',
        payload: { asset: { assetId: 'asset_v', mimeType: 'video/mp4' } },
        accessibility: { label: 'A clip' },
      }),
      element({
        id: 'quiz',
        type: 'question',
        y: 200,
        payload: {
          interactionType: 'multiple_choice',
          prompt: 'Which one?',
          options: [
            { id: 'a', label: 'First' },
            { id: 'b', label: 'Second' },
          ],
          correctResponse: 'a',
          required: false,
        },
        accessibility: { label: 'A question' },
      }),
    ]),
  ])

/**
 * The sharp one: a slide that can only be left by answering a question this adapter cannot render.
 *
 * Without a report, a learner sits on a slide that never ends and nothing says why. `resolve` already
 * returns `blockingUnknownRequired` for this shape; the adapter's job is to surface it.
 */
export const stranding = (): LessonManifest =>
  lesson([
    slide(
      [
        element({ id: 'prompt', payload: { text: 'Answer to continue' } }),
        element({
          id: 'gate',
          type: 'question',
          y: 200,
          payload: {
            interactionType: 'true_false',
            prompt: 'Ready?',
            options: [
              { id: 'y', label: 'Yes' },
              { id: 'n', label: 'No' },
            ],
            correctResponse: 'y',
            required: true,
          },
          accessibility: { label: 'A gate' },
        }),
      ],
      { advance: { mode: 'after_interaction', interactionElementId: 'gate' } },
    ),
  ])

/** An image, which this adapter renders only when the host supplies a resolver. */
export const withImage = (): LessonManifest =>
  lesson([
    slide([
      element({
        id: 'diagram',
        type: 'image',
        payload: { asset: { assetId: 'asset_i', mimeType: 'image/png' } },
        accessibility: { altText: 'A diagram' },
      }),
    ]),
  ])

/**
 * Two slides, with a transition authored on the second.
 *
 * **Every other fixture here is a single slide**, which meant the adapter's slide *advance* — the
 * first thing FR-010 lists — was never crossed by a test at all, and transitions were not
 * implemented because nothing asked for them. A fixture set that never changes slide will report a
 * player that cannot change slide as working.
 */
export const twoSlides = (): LessonManifest =>
  lesson([
    slide([element({ id: 'first', payload: { text: 'Slide one' } })], {
      id: 'slide_0',
      durationMs: 4000,
    }),
    slide([element({ id: 'second', payload: { text: 'Slide two' } })], {
      id: 'slide_1',
      durationMs: 4000,
      transition: { type: 'fade', durationMs: 600 },
    }),
  ])

/** The same pair with no transition authored, so the absence is observable rather than assumed. */
export const twoSlidesPlain = (): LessonManifest =>
  lesson([
    slide([element({ id: 'first', payload: { text: 'Slide one' } })], {
      id: 'slide_0',
      durationMs: 4000,
    }),
    slide([element({ id: 'second', payload: { text: 'Slide two' } })], {
      id: 'slide_1',
      durationMs: 4000,
    }),
  ])

/**
 * One slide, two elements, and effects that actually move and filter.
 *
 * **Every other fixture here is effect-free**, which meant the agreement suite — the mechanism
 * SC-005 names, and SC-005 says "the same slides, elements, and *effects* at the same times" —
 * compared geometry and opacity over lessons where nothing was ever animating. A comparison of two
 * renderers that never runs an effect is not a comparison of the thing most likely to differ.
 *
 * `slide` moves (transform) and `highlight` filters. The two are deliberately different kinds: a
 * transform reaches CSS through `--cs-tx`/`--cs-sx`/`--cs-rotate` and a filter through
 * `--cs-brightness`/`--cs-blur`, and an adapter can implement one and silently drop the other.
 */
export const withEffects = (): LessonManifest =>
  lesson([
    slide([
      element({
        id: 'mover',
        payload: { text: 'Moves in' },
        effects: [
          {
            id: 'fx_move',
            type: 'slide',
            phase: 'enter',
            startMs: 0,
            durationMs: 2000,
            order: 1,
            params: { from: 'left', distance: 40 },
          },
        ],
      }),
      element({
        id: 'lit',
        y: 200,
        payload: { text: 'Brightens' },
        effects: [
          {
            id: 'fx_lit',
            type: 'highlight',
            phase: 'emphasis',
            startMs: 1000,
            durationMs: 3000,
            order: 1,
            params: { amount: 0.6 },
          },
        ],
      }),
    ]),
  ])

/**
 * A slide carrying 55 elements — the density `tools/scripts/fixtures/heavy-lesson.mjs` uses for its
 * dense slide, matched deliberately so the adapter's budget is measured against the same shape as
 * the player's rather than against a number chosen here.
 */
const many = (count: number, from = 0): Element[] =>
  Array.from({ length: count }, (_, i) =>
    element({
      id: `e${from + i}`,
      y: (i % 11) * 80,
      x: Math.floor(i / 11) * 300,
      payload: { text: `Element ${from + i}` },
    }),
  )

export const dense = (): LessonManifest => lesson([slide(many(55))])

/** The same density, twice, with a transition — the densest single frame the adapter ever runs. */
export const denseWithTransition = (): LessonManifest =>
  lesson([
    slide(many(55), { id: 'slide_0', durationMs: 4000 }),
    slide(many(55, 100), {
      id: 'slide_1',
      durationMs: 4000,
      transition: { type: 'fade', durationMs: 600 },
    }),
  ])

/** A stranding slide followed by an ordinary one, so leaving the problem behind is observable. */
export const strandThenPlain = (): LessonManifest =>
  lesson([
    slide(
      [
        element({ id: 'prompt', payload: { text: 'Answer to continue' } }),
        element({
          id: 'quiz',
          type: 'question',
          y: 200,
          payload: {
            interactionType: 'multiple_choice',
            prompt: 'Which one?',
            options: [
              { id: 'a', label: 'First' },
              { id: 'b', label: 'Second' },
            ],
            correctResponse: 'a',
            required: true,
          },
        }),
      ],
      { id: 'slide_0', durationMs: 4000, advance: { mode: 'after_interaction', interactionElementId: 'quiz' } },
    ),
    slide([element({ id: 'after', payload: { text: 'Next slide' } })], {
      id: 'slide_1',
      durationMs: 4000,
    }),
  ])
