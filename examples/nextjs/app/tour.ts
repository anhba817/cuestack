import type { LessonManifest } from '@cuestack/schema'

/**
 * A lesson that can actually be finished.
 *
 * The reference lesson is the *format's* showcase and it is deliberately hard: its second
 * slide waits for a video, its assets are opaque ids with nothing serving them, and its last
 * slide advances `on_click`, which no player supports yet. All three are honest, and all
 * three stop a visitor from reaching the end — so it demonstrates the format well and this
 * wave's claim not at all.
 *
 * This one is the claim, end to end: a slide that plays itself out, a required question that
 * holds the lesson until it is answered, a transition into the last slide, progress
 * throughout, and a completion state at the end. No media, so no gesture prompt stands in
 * front of it; no assets, so nothing renders a fallback.
 *
 * Written here rather than added to `packages/schema/fixtures/`. That directory holds the
 * artefacts the schema's own tests are built on, and a demo lesson shaped for a browser
 * would be a fixture nobody validates against a requirement. It is checked against the
 * schema at render time instead — see `page.tsx` — so a format change breaks this loudly
 * rather than silently.
 */
export const tourLesson: LessonManifest = {
  schemaVersion: '1.0',
  lesson: {
    id: 'lesson_cuestack_tour',
    title: 'A lesson worth finishing',
    description: 'Three slides that demonstrate answering, progress, and an ending.',
    language: 'en',
    aspectRatio: '16:9',
  },
  slides: [
    {
      id: 'slide_welcome',
      name: 'Welcome',
      durationMs: 6000,
      advance: { mode: 'after_duration' },
      elements: [
        {
          id: 'element_welcome_title',
          type: 'text',
          x: 120,
          y: 200,
          width: 1080,
          height: 140,
          rotation: 0,
          zIndex: 1,
          startMs: 0,
          endMs: 6000,
          payload: { text: 'This slide plays itself out.' },
          effects: [
            {
              id: 'effect_welcome_enter',
              type: 'slide',
              phase: 'enter',
              startMs: 0,
              durationMs: 800,
              order: 1,
              easing: 'ease-out',
            },
          ],
        },
        {
          id: 'element_welcome_note',
          type: 'text',
          x: 120,
          y: 360,
          width: 1080,
          height: 120,
          rotation: 0,
          zIndex: 2,
          startMs: 1200,
          endMs: 6000,
          payload: {
            text: 'The title slides in — or fades, if you have asked for reduced motion.',
          },
          effects: [
            {
              id: 'effect_welcome_note_enter',
              type: 'fade',
              phase: 'enter',
              startMs: 1200,
              durationMs: 500,
              order: 1,
              easing: 'ease-out',
            },
          ],
        },
      ],
    },
    {
      id: 'slide_question',
      name: 'A question',
      durationMs: 20_000,
      transition: { type: 'fade', durationMs: 400 },
      // The lesson stops here until the question is complete, however long the slide runs.
      advance: { mode: 'after_interaction', interactionElementId: 'element_question_tour' },
      elements: [
        {
          id: 'element_question_tour',
          type: 'question',
          x: 200,
          y: 140,
          width: 1120,
          height: 460,
          rotation: 0,
          zIndex: 1,
          startMs: 0,
          // Outlasts the slide deliberately: element windows are half-open, so a question
          // ending exactly at its slide's duration would vanish at the moment it is needed.
          endMs: 60_000,
          payload: {
            interactionType: 'multiple_choice',
            prompt: 'What holds this slide open?',
            options: [
              { id: 'opt_timer', label: 'A timer that has not finished' },
              { id: 'opt_required', label: 'This question, which is required' },
              { id: 'opt_nothing', label: 'Nothing — it is already over' },
            ],
            correctResponse: 'opt_required',
            required: true,
            maxAttempts: 3,
            correctFeedback: 'Yes. A required question gates the slide until it is complete.',
            incorrectFeedback: 'Not this time — the slide is waiting on you, not on a clock.',
            // Two more tries, and never a dead end: `on_first_attempt` would let the lesson
            // move on before the point had landed, `on_correct` with one attempt would trap
            // anyone who guessed.
            completionPolicy: 'on_correct',
          },
        },
      ],
    },
    {
      id: 'slide_end',
      name: 'The end',
      durationMs: 5000,
      transition: { type: 'slide', durationMs: 500 },
      advance: { mode: 'after_duration' },
      elements: [
        {
          id: 'element_end_title',
          type: 'text',
          x: 120,
          y: 260,
          width: 1080,
          height: 140,
          rotation: 0,
          zIndex: 1,
          startMs: 0,
          endMs: 5000,
          payload: { text: 'When this runs out, the lesson says so.' },
          effects: [
            {
              id: 'effect_end_enter',
              type: 'fade',
              phase: 'enter',
              startMs: 0,
              durationMs: 400,
              order: 1,
              easing: 'ease-out',
            },
          ],
        },
      ],
    },
  ],
}
