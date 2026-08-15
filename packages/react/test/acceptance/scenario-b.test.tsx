import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, questionElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts, type TestPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * **MVP Acceptance Scenario B**, from `docs/Cuestack_Framework.md` §34, verbatim:
 *
 * > Given a slide with a ten-second duration and a required question:
 * >  - The timer reaches ten seconds.
 * >  - The learner has not answered.
 * >  - The player remains on the slide.
 * >  - The learner answers.
 * >  - Feedback is displayed.
 * >  - The player advances according to the configured policy.
 *
 * Constitution II requires every §34 scenario to exist as an automated end-to-end test
 * before the corresponding feature is called done. This is the first of them to be
 * written — none had subject matter until this wave, because nothing advanced and nothing
 * could be answered.
 *
 * Written as one test walking the scenario in order, rather than six. The scenario is a
 * sequence and its value is that the *sequence* holds; split into independent cases, each
 * would set up a state the previous one was supposed to establish.
 */

async function runFrames(ports: TestPorts, ms: number, stepMs = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    ports.clock.advance(stepMs)
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
  }
}

describe('§34 Scenario B — a required interaction overrides the timer', () => {
  it('walks the scenario as written', async () => {
    // Given a slide with a ten-second duration and a required question.
    const lesson = lessonOf([
      // The question outlasts the slide's duration deliberately. Element windows are
      // half-open, so `endMs: 10_000` on a ten-second slide means the question vanishes at
      // the exact instant the timer fires — which is the deadlock edge case
      // (`question-vanishes.test.tsx`), not this scenario. A required question an author
      // means a learner to answer has to still be there when they are asked to.
      slide([questionElement({ id: 'q', startMs: 0, endMs: 60_000 })], { durationMs: 10_000 }),
      slide([element({ id: 'next', effects: [] })], { durationMs: 4000 }),
    ])

    const ports = testPorts()
    let transport: Transport | null = null
    const container = await client(
      h(LessonPlayer, {
        lesson,
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )

    // The timer reaches ten seconds. The learner has not answered.
    await runFrames(ports, 10_500)
    expect(transport!.slideTimeMs).toBeGreaterThanOrEqual(10_000)

    // The player remains on the slide.
    expect(transport!.slideIndex).toBe(0)
    expect(container.querySelector('[data-cs-element-type="question"]')).not.toBeNull()

    // …and keeps remaining on it. A timer that fires once and gives up would pass the
    // assertion above and fail a learner who took a moment to think.
    await runFrames(ports, 10_000)
    expect(transport!.slideIndex).toBe(0)

    // The learner answers.
    await act(async () => {
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })

    // Feedback is displayed — and stays displayed long enough to be read. Without the
    // dwell, the completed question released a timer that had been satisfied for twenty
    // seconds, and the slide changed in the same tick as the answer: the verdict was
    // rendered and destroyed inside one frame, announced to a screen reader that never got
    // to read it. The scenario sequences these as two steps, so they are two.
    const live = container.querySelector('[role="status"], [aria-live]')
    expect(live?.textContent).toMatch(/correct/i)
    expect(transport!.slideIndex).toBe(0)

    // The player advances according to the configured policy. The default policy is
    // on_first_attempt, so the answer completes the question and the elapsed timer — which
    // has been satisfied for twenty seconds — is no longer overridden.
    await runFrames(ports, 2000)
    expect(transport!.slideIndex).toBe(1)
    expect(container.querySelector('[data-cs-element-id="next"]')).not.toBeNull()
  })

  it('does not advance on an answer that leaves the question incomplete', async () => {
    // "According to the configured policy" is the clause that matters. Under `on_correct`
    // with attempts remaining, a wrong answer is an answer and is not completion.
    const lesson = lessonOf([
      slide(
        [
          questionElement({
            id: 'q',
            startMs: 0,
            endMs: 60_000,
            payload: { completionPolicy: 'on_correct', maxAttempts: 3 },
          }),
        ],
        { durationMs: 10_000 },
      ),
      slide([element({ id: 'next', effects: [] })], { durationMs: 4000 }),
    ])

    const ports = testPorts()
    let transport: Transport | null = null
    const container = await client(
      h(LessonPlayer, {
        lesson,
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )

    await runFrames(ports, 10_500)
    await act(async () => {
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })

    await runFrames(ports, 1000)
    expect(transport!.slideIndex).toBe(0)

    // Answer correctly and it releases — after the feedback dwell, not instantly.
    await act(async () => {
      container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[0]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
    await runFrames(ports, 500)
    expect(transport!.slideIndex, 'advanced before the verdict could be read').toBe(0)

    await runFrames(ports, 1500)
    expect(transport!.slideIndex).toBe(1)
  })
})
