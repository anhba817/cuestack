import { useCallback, useMemo, useRef, useState } from 'react'
import {
  emptyInteractionState,
  submit as submitAnswer,
  type InteractionState,
  type LessonEvent,
} from '@cuestack/core'
import type { Interaction, LessonManifest } from '@cuestack/schema'

/**
 * The learner's answers, for this session.
 *
 * Held here rather than in the kernel because it is *session* state and the kernel is a pure
 * fold — but the rules that read it live in `@cuestack/core`, so this holds the state and
 * decides nothing. What counts as complete is `evaluate`'s answer, not this hook's.
 *
 * Nothing persists. Cross-session resume is FR-PLY-015, a "Should", and out of scope.
 */
export interface Interactions {
  readonly state: InteractionState
  /** What the advance controller consumes (BR-005). */
  readonly completedIds: ReadonlySet<string>
  submit(
    elementId: string,
    definition: Interaction,
    selected: string | readonly string[],
    atMs: number,
  ): void
}

export function useInteractions(
  lesson: LessonManifest,
  onEvent?: (event: LessonEvent) => void,
): Interactions {
  const [state, setState] = useState<InteractionState>(emptyInteractionState)

  /**
   * The advance controller reads completions from the frame loop, which does not re-render
   * — so it cannot read React state and see the latest. A ref carries the current value
   * across that boundary; the state exists so renderers re-render when an answer lands.
   *
   * Two holders of one fact, which is normally the thing to avoid. It is safe here because
   * only one of them is ever written: `submit` sets both from the same value, and nothing
   * else assigns either.
   */
  const latest = useRef(state)

  const meta = useMemo(
    () => ({ id: lesson.lesson.id, schemaVersion: lesson.schemaVersion }),
    [lesson],
  )

  const submit = useCallback(
    (
      elementId: string,
      definition: Interaction,
      selected: string | readonly string[],
      atMs: number,
    ) => {
      const result = submitAnswer(latest.current, elementId, definition, selected, atMs, meta)
      latest.current = result.state
      setState(result.state)
      // Returned by the kernel rather than recorded by it, so the player owns when and
      // whether it reaches an adapter.
      onEvent?.(result.event)
    },
    [meta, onEvent],
  )

  return { state, completedIds: state.completedIds, submit }
}
