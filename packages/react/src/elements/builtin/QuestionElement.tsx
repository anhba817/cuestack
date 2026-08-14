import type { ReactNode } from 'react'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'

interface Option {
  readonly id: string
  readonly label: string
}

interface QuestionPayload {
  readonly interactionType?: string
  readonly prompt?: string
  readonly options?: readonly Option[]
  readonly required?: boolean
}

/**
 * A question, inert until Wave 3.
 *
 * It renders, it is reachable, it is announced, and answering it does nothing. That last
 * part is stated in the markup rather than left to be discovered: a control that looks
 * operable and is not wastes a learner's time, and a learner using a screen reader has no
 * other way to find out.
 *
 * `aria-disabled` rather than `disabled` on the inputs. `disabled` removes them from the tab
 * order, so the explanation below could never be reached by the person it is for.
 *
 * A `radiogroup` labelled by the prompt, rather than loose radios: without the grouping a
 * screen reader announces each option with no indication of which question it belongs to,
 * and a slide with two questions becomes unusable.
 *
 * The correct answer is never emitted. It is in the manifest the client already holds —
 * what a learner's copy contains is Wave 5's publishing decision — but putting it in the
 * markup would place it one inspection away, which is a different and avoidable thing.
 */
function QuestionComponent({ element }: ElementRendererProps): ReactNode {
  const payload = element.payload as QuestionPayload | undefined
  const options = payload?.options ?? []
  const promptId = `${element.id}-prompt`
  const noteId = `${element.id}-note`
  // One name per question, so two questions on a slide do not share a selection.
  const group = `${element.id}-answer`

  return (
    <div className="cs-element-question">
      <p className="cs-question-prompt" id={promptId}>
        {payload?.prompt ?? ''}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={promptId}
        aria-describedby={noteId}
        aria-disabled="true"
        {...(payload?.required === true ? { 'aria-required': true } : {})}
      >
        {options.map((option) => (
          <label className="cs-question-option" key={option.id}>
            <input type="radio" name={group} value={option.id} readOnly aria-disabled="true" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <p className="cs-question-note" id={noteId}>
        This question cannot be answered yet.
      </p>
    </div>
  )
}

export const questionRenderer: ElementRenderer = {
  type: 'question',
  Component: QuestionComponent,
  label: 'Question',
}
