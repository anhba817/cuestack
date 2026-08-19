import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import type { StorageAdapter, VersionToken } from '@cuestack/core'
import { migrate } from '@cuestack/schema/migrate'
import { keeperFor, keyFor, type DraftKeeper, type KeptWork } from './keeper.js'

/**
 * What opens: the stored lesson, or work an interruption left behind.
 *
 * **A hook of its own, running before the editor exists**, because FR-027a says the choice is
 * answered before the lesson opens — and the editor cannot render a lesson until it knows
 * which copy it is rendering. Showing either one first would be the silent application FR-027
 * forbids.
 *
 * That is also why recovery blocks and a conflict does not. Recovery happens before there is a
 * lesson on screen, so asking costs nothing; a conflict happens with an hour of the teacher's
 * work already in front of them, and a dialogue between them and it is the surest way to lose
 * it (research R-16).
 */
export type RecoveryStatus = 'loading' | 'offer' | 'ready' | 'failed'

export interface DraftRecovery {
  readonly status: RecoveryStatus
  /** Present at `ready`: what the editor should open. */
  readonly manifest: LessonManifest | null
  readonly token: VersionToken
  /**
   * True when the stored lesson moved on since the work was kept — somebody else saved.
   *
   * The teacher is then choosing between two versions rather than recovering from an
   * interruption, and the offer says so. Restoring produces a conflict on the first save,
   * which is the path US4 already builds; no third path is invented (FR-027b, research R-15).
   */
  readonly movedOn: boolean
  readonly message: string | null
  /** Open with the kept work, unsaved. */
  restoreKept(): void
  /** Throw it away and open what storage holds. */
  discardKept(): void
}

export interface DraftRecoveryOptions {
  readonly storage: StorageAdapter
  readonly lessonId: string
  /**
   * Who is editing. Its **absence selects the in-memory keeper**, so nothing durable is
   * written and nothing can be offered to the next person at a shared machine (FR-029a).
   */
  readonly identity?: string
  readonly keeper?: DraftKeeper
}

export function useDraftRecovery(options: DraftRecoveryOptions): DraftRecovery {
  const { storage, lessonId, identity } = options
  const keeper = useMemo(
    () => options.keeper ?? keeperFor(identity),
    [options.keeper, identity],
  )
  const key = keyFor(identity ?? '', lessonId)

  const [status, setStatus] = useState<RecoveryStatus>('loading')
  const [manifest, setManifest] = useState<LessonManifest | null>(null)
  const [token, setToken] = useState<VersionToken>('')
  const [kept, setKept] = useState<KeptWork | null>(null)
  const [movedOn, setMovedOn] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    void (async () => {
      const loaded = await storage.loadDraft(lessonId)
      if (!loaded.ok) {
        setStatus('failed')
        setMessage(reasonFor(loaded.reason, lessonId))
        return
      }

      /**
       * Bring it forward before anything sees it (FR-050).
       *
       * `migrate` has been in `@cuestack/schema` since Wave 1 with no consumer, because
       * nothing had ever loaded a lesson it did not itself construct. Skipping it would mean
       * a version written under an earlier format is refused by the validator — and the
       * refusal would read as data corruption to a teacher whose lesson is intact.
       */
      const brought = migrate(loaded.manifest)
      if (!brought.ok) {
        setStatus('failed')
        setMessage(
          `“${lessonId}” is stored in a format this editor cannot bring forward. ` +
            'Nothing has been changed. Ask whoever administers this lesson for help.',
        )
        return
      }
      const current = brought.manifest as LessonManifest

      // Existence is the whole test: kept work is cleared the moment storage acknowledges it,
      // so work still present is by definition work storage has not got (research R-15).
      const raw = keeper.read(key)
      const parsed = raw ? safeParse(raw) : null
      if (!parsed) {
        setManifest(current)
        setToken(loaded.token)
        setStatus('ready')
        return
      }

      setKept(parsed)
      setMovedOn(parsed.token !== loaded.token)
      setManifest(current)
      setToken(loaded.token)
      setStatus('offer')
    })()
  }, [storage, lessonId, keeper, key])

  const restoreKept = useCallback((): void => {
    if (!kept) return
    setManifest(kept.manifest)
    setStatus('ready')
  }, [kept])

  const discardKept = useCallback((): void => {
    keeper.clear(key)
    setKept(null)
    setStatus('ready')
  }, [keeper, key])

  return useMemo(
    () => ({ status, manifest, token, movedOn, message, restoreKept, discardKept }),
    [status, manifest, token, movedOn, message, restoreKept, discardKept],
  )
}

function safeParse(raw: string): KeptWork | null {
  try {
    const value = JSON.parse(raw) as KeptWork
    return value.manifest && value.token ? value : null
  } catch {
    // Corrupt kept work is discarded rather than crashing the editor: the teacher's stored
    // lesson is intact, which is the better of the two things to protect.
    return null
  }
}

function reasonFor(reason: 'not_found' | 'unauthorized' | 'unavailable', lessonId: string): string {
  if (reason === 'not_found') return `No lesson “${lessonId}” could be found.`
  if (reason === 'unauthorized') return `You do not have permission to open “${lessonId}”.`
  return `Could not reach the place “${lessonId}” is stored. Check your connection and try again.`
}
