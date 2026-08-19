import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import type { Connectivity, Ports, Scheduler, StorageAdapter, VersionToken } from '@cuestack/core'
import type { VersionEntry } from '@cuestack/core'
import { IDLE_MS, MAX_ATTEMPTS, backoffFor, isCheckpoint } from './schedule.js'
import { keeperFor, keyFor, type DraftKeeper } from './keeper.js'
import { onPageHidden } from './flush.js'

/**
 * Exactly one of four words, and never a blank.
 *
 * `pending` and `saving` both read **Saving**; `idle` and `saved` both read **Saved**. The
 * differences matter to the code and not to a teacher, and inventing a fifth word would break
 * the vocabulary Constitution III fixes at four — one shared component, one set of words,
 * reused by publishing (FR-016).
 *
 * Saved when nothing is outstanding is not a placeholder: a lesson just loaded from storage
 * matches what storage holds, which is the same claim as one just written to it.
 */
export type SaveStateKind = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'failed'

/**
 * A newer version exists, and this editor's work is built on an older one.
 *
 * Held apart from `SaveState` because the two are answered differently: the status collapses
 * to **Save Failed**, which is one of the four words Constitution III fixes, while the choice
 * itself lives in a notice that does not block. A teacher meets this with an hour of work in
 * front of them, and a dialogue standing between them and it is the surest way to lose it
 * (research R-16).
 */
export interface Conflict {
  readonly lessonId: string
  /** What storage holds now, so a resolution can re-base on it. */
  readonly currentToken: VersionToken
}

export interface SaveState {
  readonly kind: SaveStateKind
  /** Why a save failed, in words that name the problem and what to do (NFR-USA-004). */
  readonly message?: string
  /** True once the automatic attempts are spent, so the editor stops implying it is trying. */
  readonly attemptsSpent?: boolean
}

export interface DraftPersistenceOptions {
  readonly storage: StorageAdapter
  readonly lessonId: string
  /** The version the lesson opened at, from the host's own load. */
  readonly openedAt: VersionToken
  /** The current draft. Its *identity* changing is the eligible-change signal. */
  readonly draft: LessonManifest
  /**
   * Deferred execution, injected.
   *
   * Not optional and not defaulted here: `browserScheduler()` lives in `@cuestack/react`
   * because `no-clock-in-studio` forbids constructing one in this package at all, so the host
   * (or a test) supplies it. Constitution II gets what it asks for as a side effect.
   */
  readonly scheduler: Scheduler
  /**
   * Who is editing. Its absence selects the in-memory keeper, so nothing durable is written
   * at all — the privacy guarantee delivered by construction rather than by a check (FR-029a).
   */
  readonly identity?: string
  readonly keeper?: DraftKeeper
  /** Turns "the connection came back" from a two-minute wait into an immediate resend. */
  readonly connectivity?: Connectivity
  /**
   * The hidden signal, through the port the studio already uses for this kind of job —
   * `usePlayback` takes its clock the same way.
   */
  readonly ports?: Pick<Ports, 'visibility'>
}

export interface DraftPersistence {
  readonly state: SaveState
  /** The version storage last acknowledged. */
  readonly token: VersionToken
  /** Save now rather than waiting out the interval (FR-020). */
  saveNow(): void
  /** Try again once the automatic attempts are spent (FR-022). */
  retry(): void
  /** Present until the teacher answers it. Autosave is stopped while it stands (FR-032). */
  readonly conflict: Conflict | null
  /**
   * Take the stored version, discarding this editor's work — but only after keeping it
   * somewhere reachable first, so the choice is recoverable (FR-033).
   */
  takeStored(): Promise<LessonManifest | null>
  /** Keep this editor's work, saved forward as a new draft rather than over theirs. */
  keepMine(): void
  /** Ask for a checkpoint, optionally by name (FR-035b). */
  checkpoint(label?: string): void
  /** The lesson's checkpoints, newest first. Empty until `loadVersions` has run. */
  readonly versions: readonly VersionEntry[]
  /** True when the history could not be reached — not the same as having none (FR-043). */
  readonly versionsUnavailable: boolean
  loadVersions(): Promise<void>
  /**
   * Restore a checkpoint: checkpoint what is being left, then hand back its content.
   *
   * Returns the manifest for the caller to apply through `replace-draft`, or null with a
   * reason. It does **not** apply it itself — the draft belongs to the session, and a
   * persistence hook reaching into it would be the second write path R-12 refuses.
   */
  restoreVersion(token: VersionToken): Promise<{ ok: true; manifest: LessonManifest } | { ok: false; message: string }>
  /**
   * True when the browser refused to keep the work — no room, or storage denied to the page.
   *
   * Surfaced rather than swallowed: losing the work while the editor says it is being kept is
   * worse than not keeping at all (FR-024c).
   */
  readonly keepFailed: boolean
}

const UNAVAILABLE =
  'Could not reach the place this lesson is saved. Your work is safe here and will be saved ' +
  'when the connection returns.'
const UNAUTHORIZED =
  'You do not have permission to save this lesson. Ask whoever shared it with you for editing ' +
  'access, then try again.'
const CONFLICT =
  'Someone else has saved this lesson since you opened it. Your work is safe here and has not ' +
  'been sent. Choose whether to take their version or keep yours as a new draft.'

/**
 * Saving, without being asked, and saying only what is true.
 *
 * **The eligible-change signal is the draft's identity**, and that is what makes FR-018 and
 * FR-019 structural rather than checked. `applyEdit` returns a new manifest only when
 * something changed, `useEditorSession` sets it only on success, and navigation never touches
 * it — so "an action that changes no lesson data must not trigger a save" is true because
 * there is nothing to observe, not because anything asks.
 *
 * The first render is skipped for the same reason it must be: opening a lesson is not an edit,
 * and a save on open would also mint a checkpoint nobody asked for (FR-035a).
 */
export function useDraftPersistence(options: DraftPersistenceOptions): DraftPersistence {
  const { storage, lessonId, openedAt, draft, scheduler, identity, connectivity } = options
  const keeper = useMemo(() => options.keeper ?? keeperFor(identity), [options.keeper, identity])
  const keepKey = keyFor(identity ?? '', lessonId)
  const [keepFailed, setKeepFailed] = useState(false)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const conflictRef = useRef<Conflict | null>(null)
  const [versions, setVersions] = useState<readonly VersionEntry[]>([])
  const [versionsUnavailable, setVersionsUnavailable] = useState(false)
  /** Checkpoint bookkeeping: whether any exists, and editing time since the last one. */
  const anyCheckpoint = useRef(false)
  const editingSince = useRef(0)
  const lastChangeAt = useRef<number | null>(null)
  const requestedLabel = useRef<string | null>(null)
  const requested = useRef(false)
  const beforeRestore = useRef(false)

  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  const [token, setToken] = useState<VersionToken>(openedAt)
  const tokenRef = useRef<VersionToken>(openedAt)

  /** The newest draft, and whether it is the one storage has. */
  const draftRef = useRef<LessonManifest>(draft)
  const dirty = useRef(false)
  const inFlight = useRef(false)
  const attempt = useRef(0)
  const cancelTimer = useRef<(() => void) | null>(null)
  /** Skips the mount effect: opening a lesson is not an edit. */
  const seenFirst = useRef(false)

  /**
   * Keep the newest unsaved state, on the save schedule rather than on every change.
   *
   * `localStorage` is synchronous and this writes a whole manifest, and `inspector/Field.tsx`
   * commits on every `onChange` — so writing per change would put a 300-element lesson's
   * serialization between a key press and the character appearing. Constitution IV calls that
   * budget an acceptance criterion rather than an aspiration, and offline is exactly when a
   * teacher least wants the editor to feel worse (FR-024a).
   */
  const keep = useCallback((): void => {
    if (!dirty.current) return
    const result = keeper.write(
      keepKey,
      JSON.stringify({ lessonId, manifest: draftRef.current, token: tokenRef.current }),
    )
    setKeepFailed(!result.ok)
  }, [keeper, keepKey, lessonId])

  const clearTimer = useCallback((): void => {
    cancelTimer.current?.()
    cancelTimer.current = null
  }, [])

  /**
   * The next attempt, reachable from a timer without a circular dependency.
   *
   * `attemptSave` schedules a retry and `schedule` runs `attemptSave`, which as two
   * `useCallback`s is a cycle that only works while both happen to stay stable — the kind of
   * thing that breaks quietly the day someone adds a dependency. A ref makes the indirection
   * explicit instead.
   */
  const runSave = useRef<() => void>(() => undefined)
  const schedule = useCallback(
    (delayMs: number): void => {
      clearTimer()
      cancelTimer.current = scheduler.after(delayMs, () => {
        cancelTimer.current = null
        runSave.current()
      })
    },
    [scheduler, clearTimer],
  )

  /**
   * One attempt, and what its outcome means.
   *
   * Every branch here is a `SaveResult` case rather than an exception, which is what EN-6's
   * "every method returns a result" was for: an editor that autosaves meets storage failure as
   * an expected condition, not an exceptional one.
   */
  const attemptSave = useCallback(async (): Promise<void> => {
    if (inFlight.current) return
    const manifest = draftRef.current
    inFlight.current = true
    setState({ kind: 'saving' })

    /**
     * Whether this save is a checkpoint, decided by the pure policy.
     *
     * The interval counts **continued editing** rather than elapsed time, which is why
     * `editingSince` only accumulates while changes are arriving: a lesson left open
     * overnight must record nothing (FR-035a).
     */
    const asCheckpoint = isCheckpoint({
      anyRecorded: anyCheckpoint.current,
      editingMsSinceCheckpoint: editingSince.current,
      requested: requested.current,
      beforeRestore: beforeRestore.current,
    })
    const label = requestedLabel.current
    const options =
      asCheckpoint
        ? { checkpoint: label !== null ? { label } : {} }
        : undefined

    const result = await storage.saveDraft(lessonId, manifest, tokenRef.current, options)
    inFlight.current = false

    if (result.ok) {
      tokenRef.current = result.token
      setToken(result.token)
      attempt.current = 0
      if (asCheckpoint) {
        anyCheckpoint.current = true
        editingSince.current = 0
        requested.current = false
        requestedLabel.current = null
      }
      // Only clean if nothing arrived while the save was in flight. Editing during a save is
      // never blocked (FR-023), so the newer state has to be noticed rather than assumed away.
      if (draftRef.current === manifest) {
        dirty.current = false
        // Cleared on acknowledgement, so a later refresh cannot offer work that is already
        // saved — and so "kept work exists" stays a truthful signal (FR-028).
        keeper.clear(keepKey)
        setKeepFailed(false)
        setState({ kind: 'saved' })
      } else {
        setState({ kind: 'pending' })
        schedule(IDLE_MS)
      }
      return
    }

    // Anything short of an acknowledgement means the work is only here, so keep it. A
    // conflict included: the teacher's work is not discarded before they have chosen (FR-034).
    keep()

    if (result.reason === 'conflict') {
      /**
       * Stop autosaving into it.
       *
       * Retrying the same losing save costs a request every interval and cannot succeed —
       * the token is stale by definition. What changes the outcome is the teacher choosing,
       * so the loop waits for that rather than for the network.
       */
      clearTimer()
      const found = { lessonId, currentToken: result.currentToken }
      conflictRef.current = found
      setConflict(found)
      setState({ kind: 'failed', message: CONFLICT, attemptsSpent: true })
      return
    }

    if (result.reason === 'unauthorized') {
      // Not retried: attempting again cannot change the answer, and five refusals is five
      // ways of telling a teacher the same thing.
      setState({ kind: 'failed', message: UNAUTHORIZED, attemptsSpent: true })
      return
    }

    // Unreachable. Back off, and stop claiming to be trying once the attempts are spent.
    attempt.current += 1
    const delay = backoffFor(attempt.current)
    if (delay === null) {
      setState({ kind: 'failed', message: UNAVAILABLE, attemptsSpent: true })
      return
    }
    setState({ kind: 'offline', message: UNAVAILABLE })
    schedule(delay)
  }, [storage, lessonId, schedule])

  useEffect(() => {
    runSave.current = () => void attemptSave()
  }, [attemptSave])

  /**
   * A change arrived: restart the interval rather than queueing a second save (FR-015).
   *
   * Restarting is what makes a teacher typing steadily produce one save after they stop, not
   * one per keystroke.
   */
  useEffect(() => {
    draftRef.current = draft
    if (!seenFirst.current) {
      seenFirst.current = true
      return
    }
    dirty.current = true
    attempt.current = 0
    // Editing time, not elapsed time: the gap between two changes counts only when there were
    // two changes. An editor left open contributes nothing (FR-035a).
    const now = scheduler.now()
    if (lastChangeAt.current !== null) {
      editingSince.current += Math.min(now - lastChangeAt.current, IDLE_MS)
    }
    lastChangeAt.current = now
    setState({ kind: 'pending' })
    schedule(IDLE_MS)
  }, [draft, schedule, scheduler])

  useEffect(() => () => clearTimer(), [clearTimer])

  /**
   * Flush before the page goes away, closing FR-024a's interval-sized window.
   *
   * Guarded by `dirty` inside `keep`, which is what keeps this cheap: `visibilitychange` fires
   * on every tab switch, and with nothing outstanding there is nothing to write.
   */
  useEffect(() => onPageHidden(options.ports?.visibility, keep), [options.ports, keep])

  /**
   * Resume the moment the browser says the network is back.
   *
   * The save outcome remains the authority on whether saving *works* — `navigator.onLine` is
   * true behind a captive portal and against a dead backend. This only turns a discovery that
   * would have taken up to two minutes into an immediate one (FR-025, research R-09).
   */
  useEffect(() => {
    if (!connectivity) return
    return connectivity.subscribe((online) => {
      if (!online || !dirty.current) return
      attempt.current = 0
      clearTimer()
      runSave.current()
    })
  }, [connectivity, clearTimer])

  const saveNow = useCallback((): void => {
    // While a conflict is unanswered this attempts nothing and puts the choice back in front
    // of the teacher. Sending a save that is known to be refused teaches them the control does
    // nothing, which costs more than the one refused request saves (FR-020).
    if (conflictRef.current) {
      setConflict({ ...conflictRef.current })
      return
    }
    if (!dirty.current) return
    clearTimer()
    attempt.current = 0
    void attemptSave()
  }, [clearTimer, attemptSave])

  const retry = useCallback((): void => {
    if (conflictRef.current) {
      setConflict({ ...conflictRef.current })
      return
    }
    if (!dirty.current) return
    attempt.current = 0
    clearTimer()
    void attemptSave()
  }, [clearTimer, attemptSave])

  /**
   * Take the stored version.
   *
   * The teacher's work is kept locally *first*, so choosing this is itself recoverable — the
   * one thing FR-033 will not allow is either side vanishing because of a click.
   */
  const takeStored = useCallback(async (): Promise<LessonManifest | null> => {
    keep()
    const loaded = await storage.loadDraft(lessonId)
    if (!loaded.ok) return null
    tokenRef.current = loaded.token
    setToken(loaded.token)
    conflictRef.current = null
    setConflict(null)
    dirty.current = false
    setState({ kind: 'saved' })
    return loaded.manifest
  }, [keep, storage, lessonId])

  /**
   * Keep this editor's work, re-based onto what storage holds now.
   *
   * Saved forward as a new draft rather than over theirs — the newer version is never
   * replaced, it is superseded by a save the teacher asked for explicitly (FR-033).
   */
  const keepMine = useCallback((): void => {
    const found = conflictRef.current
    if (!found) return
    tokenRef.current = found.currentToken
    setToken(found.currentToken)
    conflictRef.current = null
    setConflict(null)
    attempt.current = 0
    setState({ kind: 'pending' })
    schedule(IDLE_MS)
  }, [schedule])

  const checkpoint = useCallback(
    (label?: string): void => {
      requested.current = true
      requestedLabel.current = label ?? null
      if (dirty.current) saveNow()
    },
    [saveNow],
  )

  const loadVersions = useCallback(async (): Promise<void> => {
    const entries = await storage.listVersions(lessonId)
    // An empty list and an unreachable history look identical from here, so the adapter's own
    // failure has to be asked about separately — an empty list is a lie a teacher acts on.
    const reachable = await storage.loadDraft(lessonId)
    setVersionsUnavailable(!reachable.ok)
    setVersions([...entries].reverse())
  }, [storage, lessonId])

  const restoreVersion = useCallback(
    async (
      target: VersionToken,
    ): Promise<{ ok: true; manifest: LessonManifest } | { ok: false; message: string }> => {
      /**
       * The state being left goes into the history first (FR-042).
       *
       * And if that checkpoint cannot be written, the restore does not proceed (FR-042a):
       * continuing would discard unsaved work at the moment its safety net failed, which is
       * the opposite of what the checkpoint is for.
       */
      if (dirty.current) {
        beforeRestore.current = true
        const saved = await storage.saveDraft(lessonId, draftRef.current, tokenRef.current, {
          checkpoint: {},
        })
        beforeRestore.current = false
        if (!saved.ok) {
          return {
            ok: false,
            message:
              'Your unsaved work could not be saved first, so nothing has been restored. ' +
              'Check your connection and try again.',
          }
        }
        tokenRef.current = saved.token
        setToken(saved.token)
        anyCheckpoint.current = true
        dirty.current = false
      }

      const loaded = await storage.loadVersion(lessonId, target)
      if (!loaded.ok) {
        return { ok: false, message: 'That version could not be opened. Nothing has been changed.' }
      }
      // The CURRENT token, which is what makes the next save a save rather than a conflict.
      tokenRef.current = loaded.token
      setToken(loaded.token)
      return { ok: true, manifest: loaded.manifest }
    },
    [storage, lessonId],
  )

  return useMemo(
    () => ({
      state,
      token,
      saveNow,
      retry,
      keepFailed,
      conflict,
      takeStored,
      keepMine,
      checkpoint,
      versions,
      versionsUnavailable,
      loadVersions,
      restoreVersion,
    }),
    [
      state, token, saveNow, retry, keepFailed, conflict, takeStored, keepMine, checkpoint,
      versions, versionsUnavailable, loadVersions, restoreVersion,
    ],
  )
}

export { MAX_ATTEMPTS }
