import { act, createElement as h } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LessonPlayer } from '@cuestack/react'
import { fakePlayerPorts } from '../harness/preview.js'
import { element, lessonOf, slide } from '../harness/corpus.js'

afterEach(cleanup)

/**
 * FR-014 and FR-003b — preview is the same renderer, and availability describes the lesson.
 *
 * Preview and playback share one renderer by construction (Constitution V), so a working button
 * works here. What needs asserting is the thing that could plausibly diverge: the editor can
 * release advance gates so a teacher need not answer every question, and that release must move
 * the *lesson* rather than change what a control reports. A teacher previewing should see what a
 * learner sees.
 */
const gated = () =>
  lessonOf([
    slide(
      [
        element({ id: 'text', effects: [] }),
        element({
          id: 'go',
          type: 'button',
          effects: [],
          payload: { label: 'Continue', action: 'next_slide' },
        }),
        element({
          id: 'q',
          type: 'question',
          effects: [],
          payload: {
            interactionType: 'multiple_choice',
            prompt: 'Which one?',
            options: [
              { id: 'a', label: 'First' },
              { id: 'b', label: 'Second' },
            ],
            correctResponse: 'a',
            required: true,
          },
        }),
      ],
      { advance: { mode: 'after_interaction', interactionElementId: 'q' } },
    ),
    slide([element({ id: 'next', effects: [] })], {}),
  ])

const control = (c: HTMLElement): HTMLButtonElement =>
  c.querySelector('[data-cs-element-id="go"] button') as HTMLButtonElement

describe('a navigation control in preview', () => {
  it('reports itself unavailable on a gated slide, as it does for a learner', async () => {
    const { container } = render(
      h(LessonPlayer, { lesson: gated(), ports: fakePlayerPorts(), autoPlay: true }),
    )
    await act(async () => undefined)
    expect(control(container).getAttribute('aria-disabled')).toBe('true')
  })

  it('still reports itself unavailable when the editor releases advance gates', async () => {
    /**
     * The override exists so a teacher can move through a lesson without answering every question.
     * It short-circuits every advance rule in the controller — and it must not change what a
     * control *says*, or preview stops showing a teacher what a learner gets.
     */
    const { container } = render(
      h(LessonPlayer, {
        lesson: gated(),
        ports: fakePlayerPorts(),
        autoPlay: true,
        overrideAdvance: true,
      }),
    )
    await act(async () => undefined)
    expect(
      control(container).getAttribute('aria-disabled'),
      'the override moves the lesson, not the control',
    ).toBe('true')
  })
})
