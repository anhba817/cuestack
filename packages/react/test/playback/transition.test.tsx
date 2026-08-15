import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide, transitionLesson } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'

/**
 * US3 #1, #2 · FR-019: the authored transition plays for the authored duration.
 *
 * A transition is, definitionally, both slides being visible. Each is resolved at its **own**
 * slide time throughout, so effects still running on the outgoing slide keep running while it
 * leaves — a frozen snapshot would stop them mid-effect, which is visible and wrong
 * (research R-06).
 */

async function play(lesson: ReturnType<typeof lessonOf>) {
  const ports = testPorts()
  const container = await client(h(LessonPlayer, { lesson, ports, autoPlay: true }))
  const stages = () => [...container.querySelectorAll('.cs-stage')]
  const ids = () =>
    [...container.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id'))
  return { container, ports, stages, ids }
}

describe('an authored transition', () => {
  it('shows both slides while it runs', async () => {
    const { ports, ids } = await play(transitionLesson())
    await runFrames(ports, 8100)
    expect(ids()).toContain('first')
    expect(ids()).toContain('second')
  })

  it('marks which slide is leaving and which is arriving', async () => {
    // Not two anonymous stages: the stylesheet has to animate them differently, and a
    // reviewer has to be able to tell them apart in the DOM.
    const { container, ports } = await play(transitionLesson())
    await runFrames(ports, 8100)
    expect(container.querySelector('[data-cs-transition="leaving"]')).not.toBeNull()
    expect(container.querySelector('[data-cs-transition="entering"]')).not.toBeNull()
  })

  it('carries the authored type and duration to the stylesheet', async () => {
    const { container, ports } = await play(transitionLesson())
    await runFrames(ports, 8100)
    const entering = container.querySelector('[data-cs-transition="entering"]') as HTMLElement
    expect(entering.getAttribute('data-cs-transition-type')).toBe('slide')
    expect(entering.style.getPropertyValue('--cs-transition-ms')).toBe('400')
  })

  it('leaves only the incoming slide once it has finished', async () => {
    const { ports, ids, stages } = await play(transitionLesson())
    await runFrames(ports, 9000)
    expect(stages()).toHaveLength(1)
    expect(ids()).toContain('second')
    expect(ids()).not.toContain('first')
  })

  it('resolves each slide at its own time, not one shared clock', async () => {
    // The outgoing slide is at ~8s of its own eight seconds; the incoming one has just
    // started. An element authored to appear at 3s on the incoming slide must NOT be visible
    // simply because the lesson has been running for eight.
    const lesson = lessonOf([
      // The outgoing element outlasts its slide, or it has already gone when the slide
      // leaves and there is nothing to compare against.
      slide([element({ id: 'first', endMs: 60_000, effects: [] })], { durationMs: 8000 }),
      slide([element({ id: 'late', startMs: 3000, endMs: 8000, effects: [] })], {
        durationMs: 8000,
        transition: { type: 'fade', durationMs: 400 },
      }),
    ])
    const { ports, ids } = await play(lesson)
    await runFrames(ports, 8100)
    expect(ids()).toContain('first')
    expect(ids()).not.toContain('late')
  })
})

describe('a slide with no authored transition', () => {
  it('changes immediately when the type is none', async () => {
    const lesson = lessonOf([
      slide([element({ id: 'a', effects: [] })], { durationMs: 4000 }),
      slide([element({ id: 'b', effects: [] })], {
        durationMs: 4000,
        transition: { type: 'none', durationMs: 400 },
      }),
    ])
    const { ports, stages } = await play(lesson)
    await runFrames(ports, 4200)
    expect(stages()).toHaveLength(1)
  })

  it('changes immediately when the duration is zero', async () => {
    // The format permits either, so both have to be handled. A zero-duration fade that
    // still rendered two stages would leave a frame of doubled content.
    const lesson = lessonOf([
      slide([element({ id: 'a', effects: [] })], { durationMs: 4000 }),
      slide([element({ id: 'b', effects: [] })], {
        durationMs: 4000,
        transition: { type: 'fade', durationMs: 0 },
      }),
    ])
    const { ports, stages } = await play(lesson)
    await runFrames(ports, 4200)
    expect(stages()).toHaveLength(1)
  })

  it('changes immediately when nothing is authored at all', async () => {
    const lesson = lessonOf([
      slide([element({ id: 'a', effects: [] })], { durationMs: 4000 }),
      slide([element({ id: 'b', effects: [] })], { durationMs: 4000 }),
    ])
    const { ports, stages } = await play(lesson)
    await runFrames(ports, 4200)
    expect(stages()).toHaveLength(1)
  })
})
