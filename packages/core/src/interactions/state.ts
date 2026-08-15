import type { Interaction } from '@cuestack/schema'
import type { LessonEvent } from '../adapters/index.js'
import { evaluate, isCorrectResponse, type InteractionOutcome } from './evaluate.js'

/**
 * One learner's answers, for one session.
 *
 * Never persisted and never in the manifest. Cross-session resume is FR-PLY-015, a "Should",
 * and out of scope — which is why nothing here has a storage shape.
 */
export interface InteractionResponse {
  readonly elementId: string
  readonly selected: string | readonly string[]
  /** 1-based. */
  readonly attempt: number
  readonly correct: boolean
  /** Lesson time when submitted. Diagnostic and event payload; nothing reads it to decide. */
  readonly atMs: number
}

export interface InteractionState {
  readonly responses: ReadonlyMap<string, readonly InteractionResponse[]>
  /**
   * Derived, never stored. Two copies of "is this complete" disagree the first time the
   * policy is consulted twice.
   */
  outcomeOf(elementId: string, definition: Interaction): InteractionOutcome
  /** What the advance controller consumes (BR-005). */
  readonly completedIds: ReadonlySet<string>
  /**
   * The question definitions seen at submit time.
   *
   * Deriving `completedIds` needs a policy, a policy lives on the definition, and the state
   * is session data rather than a copy of the lesson. Remembering just the definitions that
   * were actually answered is enough, and keeps the state from having to be handed the
   * manifest to answer a question about itself.
   */
  readonly definitions: ReadonlyMap<string, Interaction>
}

interface Internal {
  readonly responses: Map<string, InteractionResponse[]>
  readonly definitions: Map<string, Interaction>
}

function build(internal: Internal): InteractionState {
  const completedIds = new Set<string>()
  for (const [elementId, responses] of internal.responses) {
    const definition = internal.definitions.get(elementId)
    if (definition && evaluate(definition, responses).complete) completedIds.add(elementId)
  }

  return {
    responses: internal.responses,
    definitions: internal.definitions,
    completedIds,
    outcomeOf(elementId, definition) {
      return evaluate(definition, internal.responses.get(elementId) ?? [])
    },
  }
}

export function emptyInteractionState(): InteractionState {
  return build({ responses: new Map(), definitions: new Map() })
}

export interface SubmitResult {
  readonly state: InteractionState
  readonly response: InteractionResponse
  /**
   * Returned, not recorded. The kernel does not own the analytics adapter, and a function
   * that both computed and emitted could not be called twice in a test without a spy.
   */
  readonly event: LessonEvent
}

/**
 * Record an answer, returning a new state.
 *
 * Immutable because interaction state is an *input* to advancement, and an input that
 * mutates under its reader is the class of bug that opens a gate one frame early.
 *
 * Keyed by element, not by slide visit: a learner who answers, navigates back, and returns
 * finds their answer intact, and navigation consumes no attempt. Wave 1's
 * `slideId#visitCount` key exists to make *advancement* fire once per visit, which is a
 * different question from whether this learner has answered this question.
 */
export function submit(
  state: InteractionState,
  elementId: string,
  definition: Interaction,
  selected: string | readonly string[],
  atMs: number,
  lesson?: { readonly id: string; readonly schemaVersion: string },
): SubmitResult {
  const previous = state.responses.get(elementId) ?? []
  const correct = isCorrectResponse(definition, selected)
  const response: InteractionResponse = {
    elementId,
    selected,
    attempt: previous.length + 1,
    correct,
    atMs,
  }

  const responses = new Map<string, InteractionResponse[]>()
  for (const [key, value] of state.responses) responses.set(key, [...value])
  responses.set(elementId, [...previous, response])

  const definitions = new Map(state.definitions)
  definitions.set(elementId, definition)

  const next = build({ responses, definitions })

  return {
    state: next,
    response,
    event: {
      kind: 'interaction_submitted',
      lessonId: lesson?.id ?? '',
      schemaVersion: lesson?.schemaVersion ?? '',
      interactionId: elementId,
      attempt: response.attempt,
      outcome: correct ? 'correct' : 'incorrect',
    },
  }
}
