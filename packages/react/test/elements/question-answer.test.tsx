import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { questionElement, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'

/**
 * Answering a question, from the learner's side.
 *
 * Wave 2 rendered questions that said they could not be answered. This is the story that
 * makes the claim false.
 */

const mount = async (payload: Record<string, unknown> = {}) => {
  const lesson = lessonOf([
    slide([questionElement({ id: 'q', payload })], { durationMs: 10_000 }),
  ])
  const container = await client(h(LessonPlayer, { lesson, ports: testPorts() }))
  const options = () => [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
  const submitButton = () =>
    [...container.querySelectorAll('button')].find((b) => /submit|answer/i.test(b.textContent ?? ''))!
  const answer = async (index: number) => {
    await act(async () => {
      options()[index]!.click()
    })
    await act(async () => {
      submitButton().click()
    })
  }
  return { container, options, submitButton, answer }
}

describe('answering a question', () => {
  it('lets the learner select an option', async () => {
    const { options } = await mount()
    await act(async () => {
      options()[0]!.click()
    })
    expect(options()[0]!.checked).toBe(true)
  })

  it('will not submit nothing', async () => {
    // A submit with no selection consumes an attempt for an answer the learner did not give.
    const { submitButton } = await mount({ maxAttempts: 2 })
    expect(submitButton().getAttribute('aria-disabled')).toBe('true')
  })

  it('shows feedback once answered', async () => {
    const { container, answer } = await mount()
    await answer(0)
    expect(container.textContent).toMatch(/correct/i)
  })

  it('distinguishes a wrong answer from a right one', async () => {
    const { container, answer } = await mount()
    await answer(1)
    expect(container.textContent).toMatch(/not quite|incorrect/i)
  })

  it('shows the authored feedback where the author supplied it', async () => {
    const { container, answer } = await mount({
      correctFeedback: 'Exactly — near-misses are reportable.',
    })
    await answer(0)
    expect(container.textContent).toContain('Exactly — near-misses are reportable.')
  })

  it('states the remaining attempts', async () => {
    const { container, answer } = await mount({ maxAttempts: 3, completionPolicy: 'on_correct' })
    await answer(1)
    expect(container.textContent).toMatch(/2 attempts? (remaining|left)/i)
  })

  it('lets the learner try again while attempts remain', async () => {
    const { options, answer, container } = await mount({ maxAttempts: 3, completionPolicy: 'on_correct' })
    await answer(1)
    expect(options()[0]!.getAttribute('aria-disabled')).not.toBe('true')
    await answer(0)
    expect(container.textContent).toMatch(/correct/i)
  })

  it('closes the controls when the answer is final', async () => {
    // Default policy is on_first_attempt: one answer and it is done.
    const { options, submitButton, answer } = await mount()
    await answer(0)
    for (const option of options()) expect(option.getAttribute('aria-disabled')).toBe('true')
    expect(submitButton().getAttribute('aria-disabled')).toBe('true')
  })

  it('closes the controls when the attempts run out', async () => {
    const { options, answer, container } = await mount({ maxAttempts: 2, completionPolicy: 'on_correct' })
    await answer(1)
    await answer(1)
    for (const option of options()) expect(option.getAttribute('aria-disabled')).toBe('true')
    expect(container.textContent).toMatch(/no attempts remaining|out of attempts/i)
  })

  it('never uses `disabled`, which would remove the controls from the tab order', async () => {
    // The same rule Wave 2 applied to the inert question, for the same reason: a learner
    // using a screen reader must be able to reach the control to hear why it is closed.
    const { container, answer } = await mount()
    await answer(0)
    expect(container.querySelector('input[disabled]')).toBeNull()
    expect(container.querySelector('button[disabled]')).toBeNull()
  })

  it('no longer says the question cannot be answered', async () => {
    // Wave 2's inert notice must be gone, or the lesson contradicts itself.
    const { container } = await mount()
    expect(container.textContent).not.toMatch(/cannot be answered/i)
  })
})
