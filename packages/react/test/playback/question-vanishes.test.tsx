import { createElement as h } from 'react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { vanishingQuestionLesson, element, lessonOf, slide, questionElement } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts, type TestPorts } from '../harness/ports.js'
import type { Transport } from '@cuestack/core'

/**
 * Spec Edge Case: a required question whose `endMs` precedes the learner's answer.
 *
 * The format permits authoring it, and BR-011 makes it an authoring concern — Wave 5's
 * validation engine is where an author is warned. The player's obligation is narrower and
 * absolute: **do not deadlock.** A required question that has vanished can never be
 * completed, so a slide that waits for it waits forever, and a learner sits on a stalled
 * slide with nothing to read and nothing to press.
 *
 * What the player must not do is silently advance either. The gate is real; what is wrong is
 * the authoring. So the condition is *reported* — US5 presents it — and the learner is not
 * left guessing.
 */

async function runFrames(ports: TestPorts, ms: number, stepMs = 100): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    ports.clock.advance(stepMs)
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    })
  }
}

async function play(lesson: ReturnType<typeof lessonOf>) {
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
  return { container, ports, transport: () => transport! }
}

describe('a required question that disappears before it is answered', () => {
  it('leaves the slide, having vanished from the visible set', async () => {
    const { container, ports } = await play(vanishingQuestionLesson())
    await runFrames(ports, 3500)
    expect(container.querySelector('[data-cs-element-type="question"]')).toBeNull()
  })

  it('does not crash the player', async () => {
    // The first thing to establish: the stage is still there and still rendering.
    const { container, ports } = await play(vanishingQuestionLesson())
    await runFrames(ports, 6000)
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })

  it('holds the slide rather than advancing past an unanswered requirement', async () => {
    // BR-005 does not stop applying because the element is off screen. Advancing would let a
    // learner skip a required question by waiting, which is worse than stalling.
    const lesson = lessonOf([
      slide([questionElement({ id: 'q', startMs: 0, endMs: 2000 })], { durationMs: 4000 }),
      slide([element({ id: 'after', effects: [] })], { durationMs: 4000 }),
    ])
    const { ports, transport } = await play(lesson)
    await runFrames(ports, 6000)
    expect(transport().slideIndex).toBe(0)
  })

  it('is a reachable state, so US5 has something real to present', async () => {
    // Recorded as a fact rather than a wish: this lesson reaches a slide the learner cannot
    // leave. US5's no-stranding sweep must find it and the player must say so.
    const lesson = lessonOf([
      slide([questionElement({ id: 'q', startMs: 0, endMs: 2000 })], { durationMs: 4000 }),
      slide([element({ id: 'after', effects: [] })], { durationMs: 4000 }),
    ])
    const { ports, transport, container } = await play(lesson)
    await runFrames(ports, 8000)
    expect(transport().slideIndex).toBe(0)
    expect(container.querySelector('[data-cs-element-type="question"]')).toBeNull()
  })
})
