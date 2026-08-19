import type { LessonManifest } from '@cuestack/schema'

/** How many steps the editor keeps for the open lesson (FR-005). */
export const MAX_DEPTH = 50

/**
 * One completed authoring action, and what is needed to undo it *visibly*.
 *
 * `before` is a **reference**, not a copy. `applyEdit` already deep-clones the manifest and
 * returns a fresh one, and nothing in the studio writes to `session.draft`, so the previous
 * draft is an immutable object we are holding anyway. Recording a step is therefore a push of
 * a reference and nothing else, which matters because that path sits inside NFR-PERF-002's
 * 100 ms input-to-feedback budget (research R-02).
 */
export interface HistoryStep {
  readonly before: LessonManifest
  readonly runKey: string
  /** The slide the change was made on. Undo navigates here when the teacher is elsewhere. */
  readonly slideId: string
  /** The fallback selection, used when a reversal restores nothing. */
  readonly selectionBefore: readonly string[]
}

export interface HistoryStack {
  readonly past: readonly HistoryStep[]
  readonly future: readonly HistoryStep[]
  /** False after a selection change, a slide change, a text commit, or `endEditRun`. */
  readonly runOpen: boolean
}

export const EMPTY: HistoryStack = { past: [], future: [], runOpen: false }

/**
 * Record a change, or let it join the run above it.
 *
 * **Collapsing is the absence of a push, not a merge of two steps.** The existing top step's
 * `before` is already the state the whole run started from, so the rule needs no arithmetic
 * and cannot drift. That is the entire implementation of FR-004a.
 *
 * `future` is cleared either way: a new change after a reversal discards the reversed ones,
 * and a collapsed change is still a change (FR-003).
 */
export function record(stack: HistoryStack, step: HistoryStep): HistoryStack {
  const top = stack.past[stack.past.length - 1]
  if (stack.runOpen && top && top.runKey === step.runKey) {
    return { past: stack.past, future: [], runOpen: true }
  }
  const past = [...stack.past, step]
  // Past the depth the oldest is dropped, silently: undo simply becomes unavailable at the
  // bottom, which is the state the control already renders for "nothing to undo".
  return { past: past.slice(-MAX_DEPTH), future: [], runOpen: true }
}

/** Close the current run so the next change starts a new step. */
export function closeRun(stack: HistoryStack): HistoryStack {
  return stack.runOpen ? { ...stack, runOpen: false } : stack
}

export interface Reversal {
  readonly stack: HistoryStack
  /** The step to restore. Its `before` becomes the draft. */
  readonly step: HistoryStep
}

/**
 * Take back the most recent change.
 *
 * `current` describes where the editor is now, and becomes the entry pushed onto `future` so
 * redo has somewhere to return to. Both stacks therefore hold the same kind of thing: a state
 * to go back to.
 *
 * Returns null when there is nothing to reverse, rather than throwing: undo at the bottom of
 * the stack is an ordinary thing for a teacher to do.
 */
export function undo(stack: HistoryStack, current: Omit<HistoryStep, 'runKey'>): Reversal | null {
  const step = stack.past[stack.past.length - 1]
  if (!step) return null
  return {
    step,
    stack: {
      past: stack.past.slice(0, -1),
      future: [...stack.future, { ...current, runKey: step.runKey }],
      // A reversal always closes the run: the next change starts a step of its own rather
      // than joining whatever was open before the teacher changed their mind.
      runOpen: false,
    },
  }
}

/** Put a reversed change back. Mirror of `undo`, including closing the run. */
export function redo(stack: HistoryStack, current: Omit<HistoryStep, 'runKey'>): Reversal | null {
  const step = stack.future[stack.future.length - 1]
  if (!step) return null
  return {
    step,
    stack: {
      past: [...stack.past, { ...current, runKey: step.runKey }].slice(-MAX_DEPTH),
      future: stack.future.slice(0, -1),
      runOpen: false,
    },
  }
}
