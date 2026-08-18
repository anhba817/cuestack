import { useCallback, useRef, useState } from 'react'
import type { EditorSession } from '../session/useEditorSession.js'
import { startPointFor, type PreviewStart, type StartPoint } from './startPoint.js'
import type { ViewportPreset } from './constants.js'

export interface PreviewSession {
  /**
   * Where this preview began, captured **once**, at open.
   *
   * That single word does three jobs. A value that cannot change cannot drift, so restart
   * has somewhere fixed to return to (FR-012). The editor is never read again, so closing
   * restores nothing because nothing moved (FR-006). And everything after the first seek
   * belongs to the player, obeying each slide's own advance rule (FR-011).
   */
  readonly startPoint: StartPoint
  /** False at every open. Never serialized, never remembered (FR-018). */
  readonly override: boolean
  setOverride(on: boolean): void
  readonly preset: ViewportPreset
  setPreset(preset: ViewportPreset): void
  /**
   * Bumped by restart, and used as the player's key.
   *
   * Restart is a fresh run rather than a seek (FR-032). A seek would replay a lesson whose
   * gates are all already satisfied: the learner's answers live in the player's own
   * interaction state, which exposes no reset, and the advance controller never re-decides a
   * slide whose `instanceId` has not changed — which `transport.restart()` does not change.
   * Remounting discards the interaction state, the controller, and the transport together,
   * and the start-point seek runs again through `onReady`. Half the reason a teacher restarts
   * is "does that question actually stop it?", and a sticky run answers no.
   */
  readonly generation: number
  restart(): void
}

/**
 * Everything a preview knows, and all of it dies when the preview closes.
 *
 * None of it is lesson data: SC-005 measures exactly that line, and the reason this is a
 * hook rather than fields on `EditorSession` is that the editor must not be able to hold
 * any of it after the preview is gone.
 */
export function usePreviewSession(
  session: EditorSession,
  from: PreviewStart,
): PreviewSession {
  // Captured on first render and never recomputed. A `useState` initialiser rather than a
  // `useMemo`, because a memo may be discarded and recomputed at React's discretion — and
  // this value's whole purpose is that it cannot move.
  const [startPoint] = useState<StartPoint>(() => startPointFor(session, from))
  const [override, setOverride] = useState(false)
  const [preset, setPreset] = useState<ViewportPreset>('desktop')
  const [generation, setGeneration] = useState(0)
  const generationRef = useRef(0)

  const restart = useCallback((): void => {
    generationRef.current += 1
    setGeneration(generationRef.current)
  }, [])

  return { startPoint, override, setOverride, preset, setPreset, generation, restart }
}
