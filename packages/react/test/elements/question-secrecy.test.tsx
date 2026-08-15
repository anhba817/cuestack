import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { questionElement, lessonOf, slide } from '../harness/corpus.js'
import { client, server } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { LessonPlayer as ServerPlayer } from '../../src/server.js'
import { testPorts } from '../harness/ports.js'

/**
 * FR-009: the correct answer does not reach the page before the response is final.
 *
 * `correctResponse` is in the manifest the client already holds — what a learner's copy
 * contains is Wave 5's publishing decision. What must not happen is the *renderer* putting
 * it in the markup, where it is one inspection away from any learner who thinks to look.
 */

const lesson = () =>
  lessonOf([
    slide([questionElement({ id: 'q', payload: { maxAttempts: 3, completionPolicy: 'on_correct' } })], {
      durationMs: 10_000,
    }),
  ])

describe('the correct answer stays out of the markup', () => {
  it('is absent from the server render', async () => {
    const markup = server(h(ServerPlayer, { lesson: lesson() }))
    expect(markup).not.toContain('correctResponse')
    expect(markup).not.toMatch(/data-correct/)
  })

  it('is absent before the learner answers', async () => {
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports: testPorts() }))
    expect(container.innerHTML).not.toContain('correctResponse')
    expect(container.innerHTML).not.toMatch(/data-correct|data-answer/)
  })

  it('marks no option as already chosen', async () => {
    // `checked` or `aria-checked="true"` on the right answer would give it away without
    // naming it.
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports: testPorts() }))
    for (const radio of container.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      expect(radio.checked).toBe(false)
      expect(radio.getAttribute('aria-checked')).not.toBe('true')
    }
  })

  it('does not reveal it after a wrong answer while attempts remain', async () => {
    // The moment worth guarding. A learner who guessed wrong and can try again must not be
    // handed the answer by the feedback.
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports: testPorts() }))
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    await act(async () => {
      radios[1]!.click()
    })
    await act(async () => {
      ;[...container.querySelectorAll('button')]
        .find((b) => /submit|answer/i.test(b.textContent ?? ''))!
        .click()
    })
    expect(container.innerHTML).not.toContain('correctResponse')
    // The right option must not be marked in any way the wrong one is not.
    const marked = radios.filter((r) => r.getAttribute('data-correct') !== null)
    expect(marked).toEqual([])
  })
})
