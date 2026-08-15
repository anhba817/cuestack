import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { deadEndQuestionLesson, element, lessonOf, mediaElement, questionElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { LessonPlayer, createRendererRegistry } from '../../src/index.js'
import { builtinRenderers } from '../../src/elements/builtin/index.js'
import { mediaPorts, degenerate } from '../harness/media.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import { DESCRIBED_CODES } from '../../src/player/problems.js'
import { act } from 'react'

/**
 * FR-030: every blocking condition the kernel reports is presented in terms a learner can
 * act on.
 *
 * The kernel has produced these since Wave 1 and nothing has ever displayed one — a learner
 * met them as a slide that never moved, which is indistinguishable from a broken page and
 * offers nothing to try. This story is presentation, not detection, which is why it is
 * ranked last and is still not optional.
 */

const problem = (c: HTMLElement) => c.querySelector('[role="alert"]')

describe('a slide gated on media that failed', () => {
  async function mount() {
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'v')
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([mediaElement({ id: 'v', payload: { volume: 0 } })], {
            durationMs: 4000,
            advance: { mode: 'after_media_ends', mediaElementId: 'v' },
          }),
          slide([element({ id: 'after', endMs: 60_000, effects: [] })], { durationMs: 4000 }),
        ]),
        ports,
        autoPlay: true,
      }),
    )
    return { container, ports }
  }

  it('tells the learner, rather than sitting silent', async () => {
    const { container } = await mount()
    expect(problem(container)).not.toBeNull()
  })

  it('names the problem, the object, and the action (NFR-USA-004)', async () => {
    const { container } = await mount()
    const text = problem(container)!.textContent ?? ''
    expect(text).toMatch(/video|audio/i)
    expect(text).toMatch(/could not be loaded/i)
    expect(text).toMatch(/try|skip/i)
  })

  it('offers a retry, because the usual cause is the usual cure', async () => {
    const { container } = await mount()
    const retry = [...container.querySelectorAll('button')].find((b) => /try again/i.test(b.textContent ?? ''))
    expect(retry).toBeDefined()
  })
})

describe('a slide whose advance rule can never be satisfied', () => {
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

  it('reports it once the outcome becomes unreachable', async () => {
    // `on_correct`, one attempt, answered wrongly. The gate can never open, and the player
    // says so rather than waiting forever.
    const { container, answer, ports } = await mount()
    await answer(1)
    await runFrames(ports, 2000)
    expect(problem(container)).not.toBeNull()
  })

  it('offers no retry, because retrying cannot change it', async () => {
    // An honest dead end beats a button that cannot help — a learner presses it repeatedly
    // before reaching the same conclusion, with less trust left.
    const { container, answer, ports } = await mount()
    await answer(1)
    await runFrames(ports, 2000)
    const retry = [...container.querySelectorAll('button')].find((b) => /try again/i.test(b.textContent ?? ''))
    expect(retry).toBeUndefined()
  })
})

describe('a required interaction this player cannot render', () => {
  it('is reported rather than silently dropped (FR-027/028 asymmetry)', async () => {
    // Losing a decoration and stranding a learner on an unanswerable question are not
    // comparable, which is why an unknown *required* type blocks where a decorative one
    // degrades.
    const registry = createRendererRegistry(builtinRenderers.filter((r) => r.type !== 'question'))
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([slide([questionElement({ id: 'q' })], { durationMs: 4000 })]),
        ports: testPorts(),
        elements: registry,
        autoPlay: true,
      }),
    )
    expect(problem(container)).not.toBeNull()
    expect(problem(container)!.textContent).toMatch(/question this player cannot show/i)
  })
})

describe('every code the kernel can report has a message', () => {
  it('covers all three', () => {
    // A code with no message would render an empty alert: the learner is told the lesson
    // stopped and nothing else.
    expect([...DESCRIBED_CODES].sort()).toEqual([
      'ADVANCE_MEDIA_FAILED',
      'ADVANCE_UNSATISFIABLE',
      'UNKNOWN_REQUIRED_INTERACTION',
    ])
  })
})

describe('nothing internal leaks to the learner (FR-024)', () => {
  async function blockedMarkup(): Promise<string> {
    const ports = mediaPorts()
    degenerate.fails(ports.media, 'el_video')
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([mediaElement({ id: 'el_video', payload: { volume: 0 } })], {
            durationMs: 4000,
            advance: { mode: 'after_media_ends', mediaElementId: 'el_video' },
          }),
        ]),
        ports,
        autoPlay: true,
      }),
    )
    return problem(container)!.textContent ?? ''
  }

  it('shows no error code', async () => {
    const text = await blockedMarkup()
    expect(text).not.toMatch(/ADVANCE_|UNKNOWN_|_FAILED/)
  })

  it('shows no element identifier', async () => {
    // "The video on this slide" is an object a learner recognises. `el_video` is a fact
    // about our data model, and being shown one teaches them the software is talking to
    // somebody else.
    const text = await blockedMarkup()
    expect(text).not.toContain('el_video')
    expect(text).not.toMatch(/element_|slide_\d/)
  })

  it('shows no authoring diagnostics, only blocking conditions', async () => {
    // `RenderState.problems` are notes to an author about a lesson the learner cannot fix.
    // Showing them would breach FR-024 and NFR-USA-004 at once.
    const ports = testPorts()
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([
            element({ id: 'known', effects: [] }),
            element({ id: 'exotic', type: 'hologram', effects: [], payload: {} }),
          ]),
        ]),
        ports,
        autoPlay: true,
      }),
    )
    expect(container.textContent).not.toMatch(/UNKNOWN_ELEMENT_TYPE|EFFECT_BEYOND_SLIDE/)
    expect(problem(container)).toBeNull()
  })
})
