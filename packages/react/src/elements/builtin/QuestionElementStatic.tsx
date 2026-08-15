import type { ReactNode } from 'react'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'

interface Option {
  readonly id: string
  readonly label: string
}

interface QuestionPayload {
  readonly prompt?: string
  readonly options?: readonly Option[]
  readonly required?: boolean
}

/**
 * A question, server-rendered and not yet answerable.
 *
 * **An interactive question cannot be a React Server Component**, and the constraint is
 * absolute rather than stylistic: answering needs a pending selection (state) and a submit
 * (an event handler), and RSC permits neither. So there are two implementations behind one
 * registry slot, exactly as `LessonPlayerStatic` and `LessonPlayerClient` sit behind one
 * exported name — and for the same reason.
 *
 * This is what a learner sees before hydration, and all they see with JavaScript disabled.
 * It renders the prompt and the options so the *content* is in the document and readable by
 * a search engine or a screen reader, and says plainly that it cannot be answered yet rather
 * than presenting controls that do nothing.
 *
 * `aria-disabled`, never `disabled`: a closed control must stay reachable, or the learner
 * who most needs to hear why cannot get to it.
 */
function StaticQuestionComponent({ element }: ElementRendererProps): ReactNode {
  const payload = element.payload as QuestionPayload | undefined
  const options = payload?.options ?? []
  const promptId = `${element.id}-prompt`
  const noteId = `${element.id}-status`
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
      <p className="cs-question-status" id={noteId}>
        This question cannot be answered yet.
      </p>
    </div>
  )
}

export const staticQuestionRenderer: ElementRenderer = {
  type: 'question',
  Component: StaticQuestionComponent,
  label: 'Question',
}
