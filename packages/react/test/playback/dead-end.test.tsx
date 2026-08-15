import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { deadEndQuestionLesson } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import { emptyInteractionState, evaluate, submit } from '@cuestack/core'
import { question } from '../../../core/test/harness/interactions.js'

/**
 * The dead end the format permits: `on_correct`, one attempt, answered wrongly.
 *
 * The kernel does not rescue the learner by opening the gate — that would make the policy
 * mean something other than what it says. It reports `unsatisfiable`, and the player offers
 * the way forward FR-030 requires. Wave 5's validation engine is where an author is warned
 * before a learner ever meets it.
 */

async function mount() {
  const ports = testPorts()
  const container = await client(
    h(LessonPlayer, { lesson: deadEndQuestionLesson(), ports, autoPlay: true }),
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
  return { container, ports, answer }
}

describe('the kernel', () => {
  it('reports the outcome as unreachable rather than quietly completing it', () => {
    const definition = question({ completionPolicy: 'on_correct', maxAttempts: 1 })
    const { state } = submit(emptyInteractionState(), 'q', definition, 'b', 0)
    const outcome = evaluate(definition, state.responses.get('q') ?? [])
    expect(outcome.complete).toBe(false)
    expect(outcome.unsatisfiable).toBe(true)
  })
})

describe('the player', () => {
  it('shows nothing wrong before the attempt is spent', async () => {
    const { container } = await mount()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('reports it once the last attempt is spent on a wrong answer', async () => {
    const { container, answer, ports } = await mount()
    await answer(1)
    await runFrames(ports, 1000)
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('does not report it when the learner answers correctly', async () => {
    const { container, answer, ports } = await mount()
    await answer(0)
    await runFrames(ports, 1000)
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('explains it without blaming the learner or naming the rule', async () => {
    // "You got it wrong and now you are stuck" is true and useless. The lesson is at fault
    // here — the author configured a question that cannot be completed — and the learner
    // needs a way on, not a diagnosis.
    const { container, answer, ports } = await mount()
    await answer(1)
    await runFrames(ports, 1000)
    const text = container.querySelector('[role="alert"]')!.textContent ?? ''
    expect(text).not.toMatch(/on_correct|maxAttempts|policy|unsatisfiable/i)
    expect(text).toMatch(/cannot continue/i)
  })
})
