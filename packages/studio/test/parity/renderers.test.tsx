import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  SlideView,
  builtinRenderers,
  createRendererRegistry,
  staticRenderers,
} from '@cuestack/react'
import { resolve } from '@cuestack/core'
import { lessonWith, oneOfEachType } from '../harness/corpus.js'
import type { element } from '../harness/corpus.js'
import { questionElement } from '../harness/preview.js'

/**
 * The two renderer sets agree about what a lesson says.
 *
 * **This is the comparison FR-028 needs, and finding the right one took several attempts.**
 * Comparing the preview with playback is tautological — the preview *is* the player, so it
 * reduces to `resolve(slide, t) === resolve(slide, t)`, which passes forever including after
 * parity breaks. Comparing the canvas with the player is a real check and feature 005 already
 * wrote it, in `overlay.test.tsx` and `geometry.test.tsx`.
 *
 * What remained untested is the one place two renderer sets genuinely exist. `staticRenderers`
 * and `builtinRenderers` differ in exactly one member — `staticQuestionRenderer` against
 * `questionRenderer` — and the editor draws with the static set while the preview and the
 * learner get the interactive one. So a question could say one thing to an author and another
 * to a learner, and nothing would notice.
 *
 * **What is compared is the *content*, not the affordances.** The interactive renderer must
 * carry a submit control and a live region; the static one must not, and that difference is
 * the point of having two. What must never differ is the prompt, the options, their order,
 * and their labels — the lesson's own words.
 */

const registries = {
  static: createRendererRegistry(staticRenderers),
  interactive: createRendererRegistry(builtinRenderers),
}

/**
 * The lesson's own words, in document order, with the affordances stripped.
 *
 * `.cs-question-status` is stripped rather than compared, and that is the one judgement call
 * in this file. Both renderers use it, and neither uses it for the lesson's words: the
 * interactive one carries the verdict after an answer, the static one says "this question
 * cannot be answered yet" — which is the *absence* of interactivity being stated plainly
 * rather than presenting controls that do nothing. Comparing it would assert that a
 * pre-hydration note and a learner's verdict are the same sentence, which they must not be.
 *
 * What is left is the prompt and the option labels, in order. Those are authored, and those
 * are what a divergence would corrupt.
 */
function words(root: HTMLElement): string[] {
  const question = root.querySelector('[data-cs-element-type="question"]') as HTMLElement | null
  if (!question) throw new Error('No question rendered, so this comparison is vacuous.')
  const copy = question.cloneNode(true) as HTMLElement
  for (const affordance of copy.querySelectorAll(
    'button, input, [role="status"], .cs-question-status',
  )) {
    affordance.remove()
  }
  return (copy.textContent ?? '')
    .split(/\s{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function renderWith(kind: keyof typeof registries, slideElements: ReturnType<typeof element>[]) {
  const lesson = lessonWith(slideElements)
  const state = resolve(lesson.slides[0]!, 0)
  return render(<SlideView state={state} renderers={registries[kind]} />)
}

describe('the question element says the same thing to both renderer sets', () => {
  const question = questionElement({ id: 'fx-q' })

  it('renders the same prompt, options, and order', () => {
    const statically = words(renderWith('static', [question]).container)
    const interactively = words(renderWith('interactive', [question]).container)
    expect(statically).toEqual(interactively)
  })

  it('and the comparison is not vacuous — the sets do differ', () => {
    // Without this, the equality above would pass on two renderers that both produced
    // nothing, or on a `words()` that stripped everything. The affordance difference is the
    // reason two sets exist: the interactive one carries a submit control, the static one
    // must not, and a teacher composing a slide is authoring a question rather than
    // answering one.
    const statically = renderWith('static', [question]).container
    const interactively = renderWith('interactive', [question]).container
    expect(statically.querySelector('.cs-question-submit')).toBeNull()
    expect(interactively.querySelector('.cs-question-submit')).not.toBeNull()
  })

  it('accepts the same resolved contribution for every other type', () => {
    // Effects are CSS custom properties written from one `resolve`, on both sides, so there
    // is no renderer-set difference for them to disagree across. What is asserted instead is
    // that both sets accept the same resolved state and render the same six element types
    // from it — the question being the only member that differs at all.
    const everything = oneOfEachType()
    const statically = renderWith('static', everything).container
    const interactively = renderWith('interactive', everything).container

    const typesOf = (root: HTMLElement) =>
      [...root.querySelectorAll('[data-cs-element-type]')].map((n) =>
        n.getAttribute('data-cs-element-type'),
      )
    expect(typesOf(statically)).toEqual(typesOf(interactively))
  })
})

describe('every registered type is covered by this comparison', () => {
  it('names the same seven types in both sets', () => {
    // The check that keeps this file honest as the framework grows. A registered eighth type
    // that only one set knew about would be a divergence no assertion above could see,
    // because both sides would simply not render it.
    expect(registries.static.types().slice().sort()).toEqual(
      registries.interactive.types().slice().sort(),
    )
    expect(registries.static.types()).toHaveLength(7)
  })
})
