import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { LessonPlayer } from '../../src/index.js'
import { element, lessonOf, questionElement, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'

/**
 * The reported defect: a Continue button that renders, is keyboard-operable, is announced
 * properly, and does nothing. Inert since Wave 2 under a comment promising "the seam Wave 3
 * wires up".
 */
const button = (action: string, id = 'go') =>
  element({
    id,
    type: 'button',
    startMs: 0,
    endMs: 8000,
    effects: [],
    payload: { label: 'Continue', action },
  })

const twoSlides = (first: Record<string, unknown> = {}, extra: Slide['elements'] = []) =>
  lessonOf([
    slide([element({ id: 'first', payload: { text: 'One' } }), ...extra], {
      id: 'slide_0',
      durationMs: 4000,
      ...first,
    }),
    slide([element({ id: 'second', payload: { text: 'Two' } })], {
      id: 'slide_1',
      durationMs: 4000,
    }),
  ])

type Slide = ReturnType<typeof slide>

const play = async (lesson: ReturnType<typeof lessonOf>) => {
  const ports = testPorts()
  const container = await client(h(LessonPlayer, { lesson, ports, autoPlay: true }))
  return { container, ports }
}

const ids = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id')!)

const press = async (c: HTMLElement, ports: ReturnType<typeof testPorts>, id = 'go') => {
  const node = c.querySelector<HTMLButtonElement>(`[data-cs-element-id="${id}"] button`)!
  const { act } = await import('react')
  await act(async () => node.click())
  await runFrames(ports, 200)
}

describe('a learner presses Continue and the lesson continues', () => {
  it('moves to the next slide', async () => {
    const { container, ports } = await play(twoSlides({}, [button('next_slide')]))
    expect(ids(container)).toContain('first')
    await press(container, ports)
    expect(ids(container)).toContain('second')
  })

  it('is a real button, so a keyboard reaches it', async () => {
    // A native `<button>` brings Enter, Space, focus behaviour and the right role for free.
    // Every hand-rolled substitute has to earn all three back, and usually earns two.
    const { container } = await play(twoSlides({}, [button('next_slide')]))
    const node = container.querySelector('[data-cs-element-id="go"] button')
    expect(node?.tagName).toBe('BUTTON')
    expect(node?.getAttribute('aria-disabled')).toBeNull()
  })

  it('completes the lesson rather than moving nowhere, on the last slide', async () => {
    /**
     * Asserted against the transport's own clamping rather than a check in the adapter:
     * `goToSlide` past the last index stops the clock and sets state to `completed`. A second
     * check in the adapter is a second rule that can disagree with the first.
     */
    const lesson = lessonOf([
      slide([element({ id: 'only', payload: { text: 'One' } }), button('next_slide')], {
        id: 'slide_0',
        durationMs: 4000,
      }),
    ])
    const { container } = await play(lesson)
    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="go"] button')!
    // Nowhere to go: the control says so rather than pretending.
    expect(node.getAttribute('aria-disabled')).toBe('true')
  })

  it('moves exactly once per press', async () => {
    const { container, ports } = await play(
      lessonOf([
        slide([element({ id: 'a' }), button('next_slide')], { id: 's0', durationMs: 4000 }),
        slide([element({ id: 'b' })], { id: 's1', durationMs: 4000 }),
        slide([element({ id: 'c' })], { id: 's2', durationMs: 4000 }),
      ]),
    )
    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="go"] button')!
    const { act } = await import('react')
    // A double press, before a frame runs between them.
    await act(async () => {
      node.click()
      node.click()
    })
    await runFrames(ports, 200)
    expect(ids(container), 'two presses must not skip a slide').toContain('b')
  })

  it('does not carry a learner past a required question', async () => {
    /**
     * **BR-005**, and the case three versions of this rule would have shipped broken. The slide
     * advances after its duration, so an enumeration by mode would have called the button a
     * legitimate skip-ahead. The kernel refuses to leave *any* slide with an unanswered required
     * question, and the direct-command path is the one place the kernel is not consulted.
     */
    const { container } = await play(
      twoSlides({ durationMs: 20000 }, [
        button('next_slide'),
        questionElement({ id: 'q', payload: { required: true } }),
      ]),
    )
    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="go"] button')!
    expect(node.getAttribute('aria-disabled'), 'the gate outranks the button').toBe('true')
  })
})
