import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * The inert question.
 *
 * It renders, is reachable, is announced, and answering it does nothing until Wave 3.
 * `aria-disabled` rather than `disabled`, because a control that looks operable and is
 * not is worse for a learner using a screen reader than one that says so — and
 * `disabled` would remove it from the tab order, so nobody would ever hear why.
 */

const question = (payload: Record<string, unknown> = {}) =>
  element({
    id: 'q',
    type: 'question',
    effects: [],
    payload: {
      interactionType: 'multiple_choice',
      prompt: 'Which of these must be reported?',
      options: [
        { id: 'a', label: 'A near-miss' },
        { id: 'b', label: 'Nothing' },
        { id: 'c', label: 'Only injuries' },
      ],
      correctResponse: 'a',
      required: false,
      ...payload,
    },
  })

const markup = (payload?: Record<string, unknown>): string =>
  server(h(LessonPlayer, { lesson: lessonOf([slide([question(payload)])]) }))

describe('the question renderer', () => {
  it('renders the prompt', () => {
    expect(markup()).toContain('Which of these must be reported?')
  })

  it('renders every option', () => {
    const html = markup()
    for (const label of ['A near-miss', 'Nothing', 'Only injuries']) {
      expect(html).toContain(label)
    }
  })

  it('groups the options as a radio group, labelled by the prompt', () => {
    // A loose pile of radios makes a screen reader announce each option with no idea
    // what question it belongs to.
    const html = markup()
    expect(html).toMatch(/role="radiogroup"/)
    expect(html).toMatch(/aria-labelledby="[^"]+"/)
  })

  it('renders options as radios, one name per question', () => {
    const html = markup()
    expect(html.match(/type="radio"/g)?.length).toBe(3)
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(names).size).toBe(1)
  })

  it('marks itself disabled without leaving the tab order', () => {
    const html = markup()
    expect(html).toMatch(/aria-disabled="true"/)
    // `disabled` would make it unreachable, so the explanation below could never be
    // heard by the learner it is for.
    expect(html).not.toMatch(/<input[^>]*\sdisabled/)
    /**
     * Scoped to the inputs rather than to the whole markup.
     *
     * A bare `/tabindex="-1"/` over the container also matched the stage, which carries it as a
     * focus target so a slide change has somewhere to put a keyboard user (feature 012). That is
     * the opposite of the defect this line guards: a container focus can be *sent* to, versus a
     * control a learner can no longer tab to.
     */
    expect(html).not.toMatch(/<input[^>]*tabindex="-1"/)
  })

  it('says why it does nothing', () => {
    // Silence here reads as a broken lesson. This is a limitation of the player, and the
    // learner is the person least able to work that out unaided.
    expect(markup()).toMatch(/not yet|cannot be answered|coming/i)
  })

  it('never reveals the correct answer to the page', () => {
    // `correctResponse` is in the manifest the client already has — Wave 5's publishing
    // decides what a learner's copy contains. What must not happen is the renderer
    // putting it in the markup, where it is one inspection away.
    const html = markup()
    expect(html).not.toMatch(/correctResponse/)
    expect(html).not.toMatch(/data-correct/)
    expect(html).not.toMatch(/aria-checked="true"/)
  })

  it('renders true/false as two options like any other', () => {
    const html = markup({
      interactionType: 'true_false',
      prompt: 'Near-misses must be reported.',
      options: [
        { id: 'yes', label: 'True' },
        { id: 'no', label: 'False' },
      ],
      correctResponse: 'yes',
    })
    expect(html.match(/type="radio"/g)?.length).toBe(2)
    expect(html).toContain('True')
    expect(html).toContain('False')
  })

  it('marks a required question as required', () => {
    // BR-005: whether a question gates progression is explicit in the manifest. A learner
    // should know before answering that this one blocks.
    expect(markup({ required: true })).toMatch(/aria-required="true"/)
  })
})
