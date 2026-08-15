import { describe, expect, it } from 'vitest'
import { act, createElement as h } from 'react'
import { client } from '../harness/render.js'
import { element, lessonOf, mediaElement, questionElement, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { mediaPorts } from '../harness/media.js'
import type { Transport } from '@cuestack/core'

/**
 * SC-011 — the rendered counterpart of what feature 002 proved internally.
 *
 * Feature 002 established that the computed state at time t is identical whether
 * reached by playing or seeking. That guarantee only matters if the renderer preserves
 * it, and this is the wave where a second consumer of the resolver appears. If this
 * holds, an editor preview and a learner player cannot diverge.
 */
describe('rendered parity', () => {
  const lesson = lessonOf([
    slide([
      element({
        id: 'faded',
        startMs: 0,
        endMs: 4000,
        payload: { text: 'Fading' },
        effects: [
          { id: 'fx', type: 'fade', phase: 'enter', startMs: 500, durationMs: 1000, order: 1, easing: 'linear' },
        ],
      }),
      element({ id: 'later', startMs: 2000, endMs: 4000, effects: [], payload: { text: 'Later' } }),
    ]),
  ])

  async function mount() {
    const ports = testPorts()
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, { lesson, ports, onReady: (t: Transport) => { transport = t } }),
    )
    return { container, transport: transport! }
  }

  const BOUNDARIES = [0, 499, 500, 1000, 1499, 1500, 1999, 2000, 2001, 3999]

  it.each(BOUNDARIES)('the rendered output at %ims is the same by either route', async (target) => {
    // Route A: step forward through every boundary below the target.
    const a = await mount()
    for (const step of BOUNDARIES.filter((b) => b <= target)) {
      await act(async () => { a.transport.seek(step) })
    }
    const stepped = a.container.innerHTML

    // Route B: go straight there.
    const b = await mount()
    await act(async () => { b.transport.seek(target) })
    const direct = b.container.innerHTML

    expect(direct).toBe(stepped)
  })
})

/**
 * The same claim, over the two things Wave 3 added that could break it.
 *
 * Interaction state and media position are **inputs** to resolution, never state inside it
 * (research R-01). That is the property this asserts rather than assumes: if either had been
 * folded into the resolver — a question that remembers whether it was answered *during this
 * playthrough*, a media element whose position is read from a running clock — then a state
 * reached by seeking would differ from the same state reached by playing, and an editor
 * preview could no longer show a learner's answered question the way the player will.
 */
describe('rendered parity with recorded answers', () => {
  const questionLesson = lessonOf([
    slide(
      [
        questionElement({ id: 'q', payload: { maxAttempts: 3, completionPolicy: 'on_correct' } }),
        element({ id: 'later', startMs: 2000, endMs: 10_000, effects: [], payload: { text: 'Later' } }),
      ],
      { durationMs: 10_000 },
    ),
  ])

  async function mountQuestion() {
    const ports = testPorts()
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, {
        lesson: questionLesson,
        ports,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )
    const answer = async (index: number) => {
      await act(async () => {
        container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index]!.click()
      })
      await act(async () => {
        ;[...container.querySelectorAll('button')]
          .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
          .click()
      })
    }
    return { container, answer, transport: transport! }
  }

  const STOPS = [0, 1999, 2000, 3000, 5000]

  // Unanswered, answered correctly, answered wrongly. The third is the one that carries the
  // most rendered state — a verdict, a spent attempt, and a changed submit control.
  it.each([
    ['unanswered', null],
    ['answered correctly', 0],
    ['answered wrongly', 1],
  ] as const)('is the same by either route when %s', async (_name, choice) => {
    const stepped = await mountQuestion()
    if (choice !== null) await stepped.answer(choice)
    for (const stop of STOPS) {
      await act(async () => {
        stepped.transport.seek(stop)
      })
    }

    const direct = await mountQuestion()
    if (choice !== null) await direct.answer(choice)
    await act(async () => {
      direct.transport.seek(STOPS.at(-1)!)
    })

    expect(direct.container.innerHTML).toBe(stepped.container.innerHTML)
  })
})

describe('media position parity', () => {
  /**
   * Seeking the lesson commands the media to the matching position, and the position is a
   * function of where the lesson is — not of how it got there. A media element whose position
   * accumulated from playback would land somewhere else after a seek, and the learner would
   * hear a slide out of step with what they are looking at.
   */
  const cued = lessonOf([
    slide([mediaElement({ id: 'v', startMs: 1000, payload: { volume: 0 } })], {
      durationMs: 10_000,
    }),
  ])

  async function mountMedia() {
    const ports = mediaPorts()
    // Attached by the test, not by the player: the fake's map is what `query` answers from,
    // and a real host's port enumerates real elements instead. Without this both routes read
    // null and the comparison passes on two undefineds — which is how the first draft of
    // this test passed while asserting nothing.
    ports.media.attach('v', { durationMs: 20_000, positionMs: 0, paused: false })
    let transport: Transport | undefined
    const container = await client(
      h(LessonPlayer, {
        lesson: cued,
        ports,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )
    return { container, ports, transport: transport! }
  }

  /**
   * Spaced wider than `MEDIA_SYNC_TOLERANCE_MS`, deliberately.
   *
   * The link does not re-command media that is already within the tolerance of where it
   * should be — that is what stops an element's own position reports from provoking an
   * endless exchange of seeks. A stepped route through stops closer together than the
   * tolerance therefore lands *within* it rather than exactly on it, which is the design
   * working rather than a divergence. Asserting exact equality across such stops would be
   * asserting something the media contract deliberately does not promise; spacing the stops
   * lets this assert the strict thing instead.
   */
  const STOPS = [1000, 2000, 3000, 4000]

  it('lands the media in the same place by either route', async () => {
    const stepped = await mountMedia()
    for (const stop of STOPS) {
      await act(async () => {
        stepped.transport.seek(stop)
      })
    }

    const direct = await mountMedia()
    await act(async () => {
      direct.transport.seek(STOPS.at(-1)!)
    })

    /*
     * Pinned to the expected value as well as to each other. Parity alone is symmetric — a
     * seek that forgot to subtract the element's 1000 ms start offset would be wrong by the
     * same amount on both routes and compare equal, which is exactly what a mutation of
     * `startOf` demonstrated. The literal is what keeps this from passing on two undefineds.
     */
    expect(stepped.ports.media.query('v')?.positionMs).toBe(3000)
    expect(direct.ports.media.query('v')?.positionMs).toBe(stepped.ports.media.query('v')?.positionMs)
    expect(direct.container.innerHTML).toBe(stepped.container.innerHTML)
  })
})
