#!/usr/bin/env node
/**
 * The performance fixture: 50 slides, 300 elements.
 *
 * Generated at run time rather than committed. Feature 001 found a checked-in artefact
 * disagreeing with the schema on its first real run, and a 300-element manifest is exactly
 * the file nobody re-reads — it would drift silently, and it would invite being edited to
 * make a failing budget pass. Generating it means a format change breaks the fixture loudly.
 *
 * **Composition is part of the requirement, not a detail.** SC-008 measures seeking with
 * media and interactions present, so a fixture of 300 text and shape elements would produce
 * a number that does not answer the criterion — fast, truthful, and about the wrong thing.
 * Every tenth slide carries a video and a required question.
 *
 * **The last slide is dense**, carrying 55 of the 300 elements. The editor's timeline is
 * per slide, so an even six-per-slide spread would let SC-012 pass while measuring nothing.
 *
 * Deterministic: no clock, no randomness. A performance comparison between two runs is only
 * meaningful if the input is identical, and a fixture that varied would make every budget
 * regression ambiguous.
 */

const SLIDES = 50
const ELEMENTS = 300
const SLIDE_MS = 8000

/**
 * The last slide is dense, and that is a requirement rather than a quirk.
 *
 * Feature 006 T004. An even spread puts six elements on every slide, and the editor's
 * timeline is *per slide* (FR-TIM-001) — so SC-012's "stays responsive at 50 slides and 300
 * elements" would have been measured against six tracks, which is not a load. A criterion
 * that passes because the fixture is easy is the theme-gate mistake in a new place: green
 * while measuring nothing (research R-09).
 *
 * One fixture, not two. The Constitution names *the* performance fixture; a second one is
 * the copy that drifts. `ELEMENTS` is unchanged at 300 — this redistributes, it does not add.
 */
const DENSE_SLIDE_ELEMENTS = 55

/** The remaining 245 spread evenly over the other 49; any remainder rides on the dense one. */
const PER_SLIDE = Math.floor((ELEMENTS - DENSE_SLIDE_ELEMENTS) / (SLIDES - 1))
const REMAINDER = ELEMENTS - DENSE_SLIDE_ELEMENTS - PER_SLIDE * (SLIDES - 1)

const EFFECT_CYCLE = [
  { type: 'fade', phase: 'enter' },
  { type: 'slide', phase: 'enter' },
  { type: 'zoom', phase: 'enter' },
  { type: 'pulse', phase: 'emphasis' },
]

function textElement(slideIndex, i) {
  // Staggered starts, so a seek to any moment finds a different set visible. A fixture
  // where everything is visible at once would measure one code path fifty times.
  const startMs = (i % 4) * 500
  const effect = EFFECT_CYCLE[(slideIndex + i) % EFFECT_CYCLE.length]
  return {
    id: `s${slideIndex}_e${i}`,
    type: 'text',
    x: (i % 5) * 300,
    y: Math.floor(i / 5) * 150,
    width: 280,
    height: 120,
    zIndex: i + 1,
    startMs,
    endMs: SLIDE_MS,
    payload: { text: `Slide ${slideIndex} element ${i}` },
    effects: [
      {
        id: `s${slideIndex}_e${i}_fx`,
        type: effect.type,
        phase: effect.phase,
        startMs,
        durationMs: 600,
        order: 1,
        easing: 'ease_out',
      },
    ],
  }
}

function videoElement(slideIndex) {
  return {
    id: `s${slideIndex}_video`,
    type: 'video',
    x: 900,
    y: 500,
    width: 600,
    height: 340,
    zIndex: 90,
    startMs: 0,
    endMs: SLIDE_MS,
    effects: [],
    payload: {
      asset: {
        assetId: `https://example.test/clip-${slideIndex}.mp4`,
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        durationMs: 6000,
      },
      volume: 1,
      showControls: true,
    },
  }
}

function questionElement(slideIndex) {
  return {
    id: `s${slideIndex}_question`,
    type: 'question',
    x: 100,
    y: 620,
    width: 700,
    height: 240,
    zIndex: 95,
    startMs: 0,
    endMs: SLIDE_MS,
    effects: [],
    payload: {
      interactionType: 'multiple_choice',
      prompt: `Question on slide ${slideIndex}?`,
      options: [
        { id: 'a', label: 'First' },
        { id: 'b', label: 'Second' },
      ],
      correctResponse: 'a',
      required: true,
    },
  }
}

export function heavyLesson() {
  const slides = []
  let emitted = 0

  for (let s = 0; s < SLIDES; s += 1) {
    // Every tenth slide is the interesting one: media and a required question, which is
    // what SC-008 measures a seek against.
    const rich = s % 10 === 0
    const dense = s === SLIDES - 1
    const count = dense ? DENSE_SLIDE_ELEMENTS + REMAINDER : PER_SLIDE
    const elements = []

    const fillers = rich ? count - 2 : count
    for (let i = 0; i < fillers; i += 1) elements.push(textElement(s, i))
    if (rich) {
      elements.push(videoElement(s))
      elements.push(questionElement(s))
    }
    emitted += elements.length

    slides.push({
      id: `slide_${s}`,
      durationMs: SLIDE_MS,
      // A media-gated slide would stall a playback measurement on a fake that never ends,
      // so the rich slides still advance on duration. What they contribute is *elements to
      // resolve*, which is what the budget is about.
      advance: { mode: 'after_duration' },
      ...(s > 0 ? { transition: { type: 'fade', durationMs: 300 } } : {}),
      elements,
    })
  }

  if (emitted !== ELEMENTS) {
    throw new Error(`heavy-lesson: emitted ${emitted} elements, expected ${ELEMENTS}`)
  }

  return {
    schemaVersion: '1.0',
    lesson: {
      id: 'lesson_perf_fixture',
      title: 'Performance fixture',
      language: 'en',
      aspectRatio: '16:9',
    },
    slides,
  }
}

/** Slide count, element count, how many carry media or a question, and the densest slide. */
export function heavyLessonShape() {
  const lesson = heavyLesson()
  const elements = lesson.slides.flatMap((s) => s.elements)
  return {
    slides: lesson.slides.length,
    elements: elements.length,
    // What the editor's timeline actually faces, which is not elements/slides (research R-09).
    densestSlide: Math.max(...lesson.slides.map((s) => s.elements.length)),
    media: elements.filter((e) => e.type === 'video' || e.type === 'audio').length,
    questions: elements.filter((e) => e.type === 'question').length,
  }
}

// Run directly to check the fixture against the schema it claims to satisfy — the check
// feature 001 wished the committed artefact had had.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  // The built package by relative path. `tools/` is not a workspace package and has no
  // dependency on the schema; adding one to the root manifest to make this import tidy would
  // put a runtime dependency in the repository root for the sake of one self-check.
  const { validate } = await import('../../../packages/schema/dist/validate/index.js')
  const result = validate(heavyLesson())
  const shape = heavyLessonShape()
  if (!result.ok) {
    console.error('heavy-lesson: the generated fixture does not satisfy the schema.\n')
    for (const issue of result.issues.slice(0, 10)) {
      console.error(`  ${issue.code} at ${issue.path}: ${issue.message}`)
    }
    process.exit(1)
  }
  console.log(
    `heavy-lesson: ok — ${shape.slides} slides, ${shape.elements} elements ` +
      `(${shape.media} media, ${shape.questions} required questions, ` +
      `densest slide ${shape.densestSlide})`,
  )
}
