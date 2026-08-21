import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { LessonPlayer } from '../../src/index.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { client } from '../harness/render.js'
import { testPorts } from '../harness/ports.js'
import { runFrames } from '../harness/frames.js'

/**
 * FR-007a — where a keyboard user is left when the slide changes.
 *
 * The player already announces a slide change: it keys a live region on the slide index, so it
 * covers a change the learner asked for without any change. What was missing is *placement*. No
 * file under `player/` contained `.focus()`, `tabIndex`, or `autoFocus`, so pressing Continue
 * removed the button the learner was on and focus fell to `document.body` — the announcement was
 * heard and the learner was nowhere.
 */
const lesson = () =>
  lessonOf([
    slide(
      [
        element({ id: 'a' }),
        element({
          id: 'go',
          type: 'button',
          startMs: 0,
          endMs: 8000,
          effects: [],
          payload: { label: 'Continue', action: 'next_slide' },
        }),
      ],
      { id: 's0', durationMs: 4000 },
    ),
    slide([element({ id: 'b' })], { id: 's1', durationMs: 4000 }),
  ])

describe('focus after a slide change', () => {
  it('does not move on the first render', async () => {
    /**
     * Focusing the stage on mount takes focus from the host's page — which no learner asked for,
     * and which a host experiences as the player hijacking their document. `announced` starts at
     * -1 precisely so this runs on a *change*.
     */
    const container = await client(
      h(LessonPlayer, { lesson: lesson(), ports: testPorts(), autoPlay: true }),
    )
    expect(container.querySelector('.cs-stage')).not.toBe(document.activeElement)
  })

  it('lands on the slide the learner arrived at', async () => {
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports, autoPlay: true }))
    const node = container.querySelector<HTMLButtonElement>('[data-cs-element-id="go"] button')!
    const { act } = await import('react')
    await act(async () => node.click())
    await runFrames(ports, 300)

    const stage = container.querySelector('.cs-stage:not([data-cs-transition="leaving"])')
    expect(document.activeElement, 'focus must not fall to the body').not.toBe(document.body)
    expect(document.activeElement).toBe(stage)
  })

  it('lands there for a slide that advances on its own, too', async () => {
    // The placement question is about the *change*, not about who caused it. A learner whose
    // focus was somewhere on a timed slide is equally lost when it ends.
    const ports = testPorts()
    const container = await client(h(LessonPlayer, { lesson: lesson(), ports, autoPlay: true }))
    await runFrames(ports, 4500)
    expect(document.activeElement).toBe(
      container.querySelector('.cs-stage:not([data-cs-transition="leaving"])'),
    )
  })
})
