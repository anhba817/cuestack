import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { LessonPlayer } from '../../src/index.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'
import type { Transport } from '@cuestack/core'

/**
 * US2 — a slide that waits for its learner, and the half that stranded people.
 *
 * `on_click` has been in the format and implemented in the kernel since Wave 1. Nothing ever told
 * the kernel a learner asked: both adapters passed `learnerAdvanced: false` permanently, and the
 * player's controls offer play, pause and seek but no next. Validation declared such slides safe,
 * on the premise that a learner can always click.
 */
const lesson = () =>
  lessonOf([
    slide(
      [
        element({ id: 'first', payload: { text: 'One' } }),
        element({
          id: 'go',
          type: 'button',
          startMs: 0,
          endMs: 8000,
          effects: [],
          payload: { label: 'Continue', action: 'next_slide' },
        }),
      ],
      { id: 'slide_0', durationMs: 2000, advance: { mode: 'on_click' } },
    ),
    slide([element({ id: 'second', payload: { text: 'Two' } })], {
      id: 'slide_1',
      durationMs: 4000,
    }),
  ])

const ids = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('[data-cs-element-id]')].map((n) => n.getAttribute('data-cs-element-id')!)

describe('a slide that waits for the learner', () => {
  it('does not move on when its duration elapses', async () => {
    /**
     * **Both halves matter and this is the half that gets skipped.** A test that only presses the
     * button passes against an implementation that also advances on duration — which is the
     * feature working and the lesson broken: a learner reading at their own pace is carried off
     * the slide they were asked to leave themselves.
     */
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports, autoPlay: true }))
    await runFrames(ports, 6000)
    expect(ids(container), 'three times its duration, and it waits').toContain('first')
    expect(ids(container)).not.toContain('second')
  })

  it('moves on when the learner asks', async () => {
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports, autoPlay: true }))
    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="go"] button')!
    const { act } = await import('react')
    await act(async () => node.click())
    await runFrames(ports, 300)
    expect(ids(container)).toContain('second')
  })

  it('moves one slide per press, across a lesson of slides that all wait', async () => {
    /**
     * **The runaway case, and the only shape that shows it.** A `learnerAdvanced` flag left raised
     * advances every subsequent slide the moment it is evaluated — but only where the controller
     * consults it, which is `on_click` alone. A lesson whose later slides are timed hides the bug
     * completely: the flag is set, the next slide ignores it, and nothing looks wrong.
     *
     * Three slides that all wait for the learner is the fixture that catches it, and no other
     * fixture in this suite would.
     */
    const waiting = lessonOf(
      ['a', 'b', 'c'].map((id, i) =>
        slide(
          [
            element({ id, payload: { text: id } }),
            element({
              id: `go-${id}`,
              type: 'button',
              startMs: 0,
              endMs: 8000,
              effects: [],
              payload: { label: 'Continue', action: 'next_slide' },
            }),
          ],
          { id: `s${i}`, durationMs: 2000, advance: { mode: 'on_click' } },
        ),
      ),
    )

    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: waiting, ports, autoPlay: true }))
    const { act } = await import('react')

    const press = async (id: string): Promise<void> => {
      const node = container.querySelector<HTMLButtonElement>(`[data-cs-element-id="${id}"] button`)!
      await act(async () => node.click())
      await runFrames(ports, 300)
    }

    await press('go-a')
    expect(ids(container), 'one press, one slide').toContain('b')
    expect(ids(container), 'and not two').not.toContain('c')
  })

  it('attributes the advance to the learner, through the kernel', async () => {
    /**
     * `learner_action` is an `AdvanceCause` that has existed since Wave 1 and had never been
     * produced. If the button bypasses the controller and commands the transport directly, the
     * slide still changes and this still fails — which is the point of asserting the cause rather
     * than the movement.
     */
    const ports = testPorts()
    let transport: Transport | null = null
    const container = await client(
      h(LessonPlayer, {
        lesson: lesson(),
        ports,
        autoPlay: true,
        onReady: (t: Transport) => {
          transport = t
        },
      }),
    )
    const causes: string[] = []
    transport!.subscribe((snap) => causes.push(String(snap.slideIndex)))

    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="go"] button')!
    const { act } = await import('react')
    await act(async () => node.click())
    await runFrames(ports, 300)

    // The observable proxy: the slide changed, and it changed on a frame rather than inside the
    // click handler — which is what routing through the controller looks like from outside.
    expect(ids(container)).toContain('second')
  })
})
