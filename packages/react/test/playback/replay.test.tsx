import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { LessonPlayer } from '../../src/index.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'

/**
 * US3 — back and replay, the other two actions inert since Wave 1.
 *
 * **Run this file first.** Implemented as `transport.restart()` the slide restarts perfectly and
 * then never advances again: `restart()` resets the clock without bumping the visit counter,
 * `instanceId` is "slide id plus visit counter", and the advance controller keys its decided-set
 * on it. The first assertion passes and the lesson is broken. The better-named function is the
 * wrong one.
 */
const control = (action: string, id: string) =>
  element({
    id,
    type: 'button',
    startMs: 0,
    endMs: 8000,
    effects: [],
    payload: { label: action, action },
  })

const lesson = () =>
  lessonOf([
    slide([element({ id: 'a' }), control('replay_slide', 'again')], {
      id: 's0',
      durationMs: 2000,
    }),
    slide([element({ id: 'b' }), control('previous_slide', 'back')], {
      id: 's1',
      durationMs: 2000,
    }),
  ])

const ids = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id')!)

const press = async (c: HTMLElement, ports: ReturnType<typeof testPorts>, id: string) => {
  const node = c.querySelector<HTMLButtonElement>(`[data-cs-element-id="${id}"] button`)!
  const { act } = await import('react')
  await act(async () => node.click())
  await runFrames(ports, 200)
}

describe('a learner can go back and repeat', () => {
  it('replays the slide, and the slide still advances afterwards', async () => {
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports, autoPlay: true }))

    await runFrames(ports, 1000)
    await press(container, ports, 'again')
    expect(ids(container), 'still on the first slide').toContain('a')

    // **The assertion `restart()` fails.** A replayed slide that kept its instance id stays
    // decided, so the controller never advances it again and the learner is stuck on the slide
    // they chose to repeat.
    await runFrames(ports, 4000)
    expect(ids(container), 'a replayed slide must still be able to end').toContain('b')
  })

  it('lets a learner finish a lesson twice', async () => {
    /**
     * **This is the assertion `restart()` fails, and the earlier one is not.**
     *
     * A replay before the slide has decided works either way: the controller's decided-set has no
     * entry to be stuck on. The trap needs an instance that *has* decided and is still on screen,
     * and there is exactly one — the last slide, after the lesson completes and stops.
     *
     * `restart()` resets the clock and leaves the visit counter alone, so the instance id is
     * unchanged, the controller still holds it as decided, and the lesson never completes again.
     * `goToSlide(current)` bumps the visit, which is what makes the second completion possible.
     *
     * Found by running the control: the obvious replay test passed against `restart()`.
     */
    const ports = testPorts()
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([element({ id: 'only' }), control('replay_slide', 'again')], {
            id: 's0',
            durationMs: 1000,
          }),
        ]),
        ports,
        autoPlay: true,
      }),
    )

    const finished = (): boolean => container.querySelector('.cs-complete') !== null

    await runFrames(ports, 2000)
    expect(finished(), 'the lesson finishes').toBe(true)

    // The completion screen replaces the slide, so pressing Replay means finding the control that
    // is still there — the review button the completion screen offers.
    const review = container.querySelector<HTMLButtonElement>('.cs-complete-button')!
    const { act } = await import('react')
    await act(async () => review.click())
    expect(finished(), 'reviewing puts the learner back in the lesson').toBe(false)

    await runFrames(ports, 2000)
    expect(finished(), 'a learner who plays it again has finished it again').toBe(true)
  })

  it('goes back to the previous slide', async () => {
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports, autoPlay: true }))
    await runFrames(ports, 3000)
    expect(ids(container)).toContain('b')

    await press(container, ports, 'back')
    expect(ids(container)).toContain('a')
  })

  it('says so when there is nowhere to go back to', async () => {
    // Asserted against the transport's own clamping (`index < 0 ? 0 : index`), not a second check
    // in the adapter that could disagree with it.
    const ports = testPorts()
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([element({ id: 'a' }), control('previous_slide', 'back')], {
            id: 's0',
            durationMs: 4000,
          }),
        ]),
        ports,
        autoPlay: true,
      }),
    )
    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="back"] button')!
    expect(node.getAttribute('aria-disabled')).toBe('true')
  })

  it('leaves Back and Replay available on a slide that waits for a question', async () => {
    /**
     * FR-003c. Neither carries a learner *past* the gate — both move away from it — and a slide
     * that questions you about its own content is exactly where you want to re-read what came
     * before or repeat this one. A rule reading "navigation is unavailable on a gated slide"
     * traps a learner in front of a question with no way to review it.
     */
    const ports = testPorts()
    const container = await client(
      h(LessonPlayer, {
        lesson: lessonOf([
          slide([element({ id: 'x' })], { id: 's0', durationMs: 2000 }),
          slide(
            [element({ id: 'a' }), control('previous_slide', 'back'), control('replay_slide', 'again')],
            { id: 's1', durationMs: 4000, advance: { mode: 'after_interaction', interactionElementId: 'q' } },
          ),
        ]),
        ports,
        autoPlay: true,
      }),
    )
    await runFrames(ports, 2500)
    for (const id of ['back', 'again']) {
      const node = container.querySelector<HTMLButtonElement>(`[data-cs-element-id="${id}"] button`)
      expect(node?.getAttribute('aria-disabled'), id).toBeNull()
    }
  })
})
