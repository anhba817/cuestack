import { useState, type ReactNode } from 'react'
import type { InteractionOutcome } from '@cuestack/core'
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
  readonly correctFeedback?: string
  readonly incorrectFeedback?: string
}

/**
 * A question a learner can answer.
 *
 * The renderer decides what a radio group looks like and how the outcome is announced. It
 * does not decide whether the answer was right, how many attempts remain, or whether the
 * question counts as complete — all of that comes from the kernel through `interaction`,
 * because a second adapter has to reach the same conclusion from the same answer.
 *
 * **`aria-disabled`, never `disabled`.** A closed control must stay in the tab order, or the
 * learner who most needs to hear *why* it is closed is the one who cannot reach it. Wave 2
 * applied the same rule to the inert question, for the same reason.
 *
 * **The correct answer is never in the markup** before the response is final (FR-009). It is
 * in the manifest the client already holds — what a learner's copy contains is Wave 5's
 * decision — but putting it in the DOM is one inspection away from any learner who looks.
 */
function QuestionComponent({ element, interaction }: ElementRendererProps): ReactNode {
  const payload = element.payload as QuestionPayload | undefined
  const options = payload?.options ?? []
  const promptId = `${element.id}-prompt`
  const statusId = `${element.id}-status`
  const group = `${element.id}-answer`

  const [selected, setSelected] = useState<string | null>(null)

  // No `interaction` means no host wired one up — the Wave 2 behaviour, kept as the floor
  // rather than crashing a lesson that renders questions through a bare registry.
  const outcome = interaction?.outcome
  const closed = outcome?.complete === true || outcome?.exhausted === true || interaction === undefined
  const canSubmit = interaction !== undefined && !closed && selected !== null

  const status = describe(outcome, payload)

  return (
    <div className="cs-element-question">
      <p className="cs-question-prompt" id={promptId}>
        {payload?.prompt ?? ''}
      </p>

      <div
        role="radiogroup"
        aria-labelledby={promptId}
        aria-describedby={statusId}
        {...(payload?.required === true ? { 'aria-required': true } : {})}
        {...(closed ? { 'aria-disabled': true } : {})}
      >
        {options.map((option) => (
          <label className="cs-question-option" key={option.id}>
            <input
              type="radio"
              name={group}
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
              {...(closed ? { 'aria-disabled': true } : {})}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <button
        className="cs-question-submit"
        type="button"
        onClick={() => {
          if (!canSubmit) return
          interaction.submit(selected)
          setSelected(null)
        }}
        aria-disabled={!canSubmit}
      >
        Submit answer
      </button>

      {/*
        One live region carrying both facts a learner needs at once: whether they were right,
        and whether they may try again. Split across two regions, a screen reader may deliver
        only one of them.
      */}
      <p className="cs-question-status" id={statusId} role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

/**
 * What the learner is told, from the kernel's outcome.
 *
 * Both facts in one string, because they are read from one live region: whether the answer
 * was right, and whether another attempt is available. The authored feedback follows the
 * verdict rather than replacing it — an author who wrote "Think about the reporting
 * threshold" has not said whether the learner was correct.
 */
function describe(
  outcome: InteractionOutcome | undefined,
  payload: QuestionPayload | undefined,
): string {
  if (!outcome) return 'This question cannot be answered yet.'
  if (outcome.attemptsUsed === 0) return ''

  const verdict = outcome.correct ? 'Correct.' : 'Not quite.'
  const authored = outcome.correct ? payload?.correctFeedback : payload?.incorrectFeedback

  const parts = [verdict]
  if (authored) parts.push(authored)

  if (!outcome.correct) {
    if (outcome.attemptsRemaining === 0) parts.push('No attempts remaining.')
    else if (outcome.attemptsRemaining !== null) {
      const n = outcome.attemptsRemaining
      parts.push(`${n} ${n === 1 ? 'attempt' : 'attempts'} remaining.`)
    }
  }

  return parts.join(' ')
}

export const questionRenderer: ElementRenderer = {
  type: 'question',
  Component: QuestionComponent,
  label: 'Question',
}
