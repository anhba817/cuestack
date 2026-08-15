import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { questionElement, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import type { LessonEvent } from '@cuestack/core'

/**
 * FR-006, SC-012: a response emits a structured event carrying no learner identifier.
 *
 * The privacy half is asserted by *searching* the payload rather than by naming the fields
 * expected to be absent. A field added later would slip past an assertion that listed what
 * it knew about.
 */

async function answerOne() {
  const ports = testPorts()
  const recorded: LessonEvent[] = []
  const analytics = { record: (e: LessonEvent) => recorded.push(e) }
  const lesson = lessonOf([
    slide([questionElement({ id: 'q', payload: { maxAttempts: 3, completionPolicy: 'on_correct' } })], {
      durationMs: 10_000,
    }),
  ])
  const container = await client(
    h(LessonPlayer, { lesson, ports: { ...ports, analytics } }),
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
  return { recorded, answer }
}

describe('interaction events', () => {
  it('emits one on submission', async () => {
    const { recorded, answer } = await answerOne()
    await answer(0)
    expect(recorded.filter((e) => e.kind === 'interaction_submitted')).toHaveLength(1)
  })

  it('carries the interaction, the attempt, and the outcome', async () => {
    const { recorded, answer } = await answerOne()
    await answer(1)
    const submitted = recorded.find((e) => e.kind === 'interaction_submitted')!
    expect(submitted.interactionId).toBe('q')
    expect(submitted.attempt).toBe(1)
    expect(submitted.outcome).toBe('incorrect')
  })

  it('numbers a second attempt as the second', async () => {
    const { recorded, answer } = await answerOne()
    await answer(1)
    await answer(0)
    const attempts = recorded
      .filter((e) => e.kind === 'interaction_submitted')
      .map((e) => e.attempt)
    expect(attempts).toEqual([1, 2])
  })

  it('reports the outcome as correct when it was', async () => {
    const { recorded, answer } = await answerOne()
    await answer(0)
    expect(recorded.find((e) => e.kind === 'interaction_submitted')?.outcome).toBe('correct')
  })

  it('identifies the lesson, since a host needs to know which one', async () => {
    const { recorded, answer } = await answerOne()
    await answer(0)
    const submitted = recorded.find((e) => e.kind === 'interaction_submitted')!
    expect(submitted.lessonId).toBe('lesson_render_test')
    expect(submitted.schemaVersion).toBe('1.0')
  })

  it('carries no learner identifier of any kind', async () => {
    // Searched, not enumerated. An assertion listing the fields it expects to be absent
    // passes for every field it did not think of.
    const { recorded, answer } = await answerOne()
    await answer(0)
    const serialised = JSON.stringify(recorded).toLowerCase()
    for (const forbidden of ['user', 'learner', 'email', 'session', 'ip', 'device', 'name']) {
      expect(serialised, `event payload mentions "${forbidden}"`).not.toContain(forbidden)
    }
  })

  it('emits the lifecycle events around it', async () => {
    const { recorded, answer } = await answerOne()
    await answer(0)
    const kinds = recorded.map((e) => e.kind)
    expect(kinds).toContain('lesson_started')
    expect(kinds).toContain('slide_started')
  })
})
