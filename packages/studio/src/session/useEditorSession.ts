import { useCallback, useMemo, useRef, useState } from 'react'
import type { AnalyticsAdapter } from '@cuestack/core'
import type { Element, LessonManifest } from '@cuestack/schema'
import { applyEdit } from '../draft/reducer.js'
import type { Edit, EditResult } from '../draft/edit.js'
import { randomIds, type IdSource } from '../draft/ids.js'
import { clampSelection } from './selection.js'
import type { ElementEditorRegistry } from '../registry/editors.js'
import { describeReversal } from '../canvas/Announcer.js'
import { runKeyOf } from '../history/runKey.js'
import { EMPTY, closeRun, record, redo as redoStack, undo as undoStack, type HistoryStack } from '../history/stack.js'

export type EditorMode = 'edit' | 'read-only'

export interface EditorSessionOptions {
  readonly manifest: LessonManifest
  readonly slideId: string
  readonly mode?: EditorMode
  readonly idSource?: IdSource
  readonly editors?: ElementEditorRegistry
  readonly onChange?: (draft: LessonManifest) => void
  readonly analytics?: AnalyticsAdapter
}

export interface EditorSession {
  readonly draft: LessonManifest
  readonly slideId: string
  readonly selection: readonly string[]
  readonly authoringTime: number
  readonly mode: EditorMode
  readonly textEditing: string | null
  readonly clipboard: readonly Element[]
  readonly lastRefusal: Extract<EditResult, { ok: false }> | null

  apply(edit: Edit): EditResult
  /**
   * Take back the most recent change, or put it back.
   *
   * Members of the session rather than a hook a host wraps around it, and that is the whole
   * design. `Overlay`, `Inspector`, `Timeline`, `SequenceView`, and `EffectControls` all call
   * `apply` directly, so a history the host had to route through would be a history four
   * surfaces could bypass — silently, with undo appearing to work and skipping whichever was
   * wired last. Inside the frame it is a property: there is no change that is not `apply`
   * (research R-01).
   */
  undo(): void
  redo(): void
  readonly canUndo: boolean
  readonly canRedo: boolean
  /**
   * End the current run, so the next change starts a reversal step of its own.
   *
   * The surfaces' obligation: `canvas/Overlay.tsx` calls it when a pointer gesture ends,
   * `timeline/Track.tsx` on pointer-up and blur, `inspector/Field.tsx` on blur. Without it two
   * consecutive drags of one element would be a single undo step, which nobody expects; with
   * it, ten uninterrupted nudges are still one, which everybody does.
   *
   * A surface that forgets degrades gracefully — steps merge that should not have — rather
   * than corrupting anything, which is why this is a call rather than an argument to `apply`.
   */
  endEditRun(): void
  /**
   * What the last reversal did, for a screen reader (FR-010).
   *
   * On the session rather than returned from `undo()` because the announcement has to survive
   * into the next render to be read at all — a string a caller had to route somewhere would
   * be one more thing a surface could forget.
   */
  readonly lastReversal: string
  select(ids: readonly string[]): void
  goToSlide(slideId: string): void
  setAuthoringTime(ms: number): void
  beginTextEdit(id: string): void
  setPendingText(text: string): void
  endTextEdit(): void
  copy(ids: readonly string[]): void
}

/**
 * Everything the teacher is currently doing, and nothing a learner ever receives.
 *
 * The split this hook exists to keep: `draft` is authored data and the single source of
 * truth; every other field is session state that is never serialized and never influences
 * playback (FR-044). SC-007 measures exactly that line — a session of pure navigation must
 * leave the manifest byte-identical.
 *
 * Plain `useState` over a pure reducer, not a state library. The framework plan's default
 * was Zustand with Immer patches, justified by the patches doubling as an undo journal;
 * this feature keeps no history, so the justification is absent and the dependency would be
 * carried for a benefit nothing collects (research R-07).
 */
export function useEditorSession(options: EditorSessionOptions): EditorSession {
  const { manifest, mode = 'edit', onChange } = options

  const [draft, setDraft] = useState<LessonManifest>(manifest)
  /**
   * The newest draft, readable synchronously.
   *
   * React state is not visible to code running in the same handler that set it, and selection
   * is clamped against the draft — so `apply({add-element})` followed by `select([newId])`,
   * which is what the Add menu does, clamped the brand-new id against the draft from *before*
   * the add and dropped it. The element appeared and arrived unselected, contradicting US1's
   * first acceptance scenario.
   *
   * A ref updated alongside the state fixes the whole class rather than that one call site.
   */
  const draftRef = useRef<LessonManifest>(manifest)
  const [slideId, setSlideId] = useState(options.slideId)
  const [selection, setSelectionState] = useState<readonly string[]>([])
  /**
   * The current selection, readable synchronously.
   *
   * Same reason as `draftRef` above: a history step records the selection as it stood *before*
   * the change, and `apply` runs in the handler that may just have changed it.
   */
  const selectionRef = useRef<readonly string[]>([])
  const setSelection = useCallback(
    (next: readonly string[] | ((current: readonly string[]) => readonly string[])): void => {
      const value = typeof next === 'function' ? next(selectionRef.current) : next
      selectionRef.current = value
      setSelectionState(value)
    },
    [],
  )
  // Per slide, so returning to a slide returns to where the teacher left it (FR-012).
  const [times, setTimes] = useState<Record<string, number>>({})
  const [textEditing, setTextEditing] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<readonly Element[]>([])
  const [lastRefusal, setLastRefusal] = useState<Extract<EditResult, { ok: false }> | null>(null)

  /**
   * The reversal history, and a ref beside it for the same reason `draftRef` exists.
   *
   * React state is not visible to code running in the same handler that set it, and a nudge
   * followed immediately by another nudge is exactly that shape — so a stack read from state
   * would decide "does this join the run above?" against the stack from before the previous
   * nudge, and every second one would push instead of collapsing.
   */
  const [history, setHistory] = useState<HistoryStack>(EMPTY)
  const [lastReversal, setLastReversal] = useState('')
  const historyRef = useRef<HistoryStack>(EMPTY)
  const writeHistory = useCallback((next: HistoryStack): void => {
    historyRef.current = next
    setHistory(next)
  }, [])

  // Held in a ref rather than state: it changes on every keystroke while a text surface is
  // open, and re-rendering the canvas per character would put SC-001's budget out of reach
  // for a value nothing renders from.
  const pendingText = useRef<string | null>(null)

  /**
   * Captured once, on the first render.
   *
   * A host writing `idSource={countingIds()}` inline — or any source with state — would
   * otherwise get a fresh one on every render, and a counter would restart at 1 and mint an
   * id the draft already holds. The reducer then refuses the edit as invalid, correctly, and
   * the symptom is "adding a second element silently does nothing". Holding it here makes the
   * API forgiving of a very natural call site, and keeps `apply`'s identity stable.
   */
  const idSourceRef = useRef<IdSource>(options.idSource ?? randomIds)
  const idSource = idSourceRef.current
  const slide = draft.slides.find((s) => s.id === slideId) ?? draft.slides[0]
  const duration = slide?.durationMs ?? 0
  const authoringTime = Math.min(times[slideId] ?? 0, duration)

  const apply = useCallback(
    (edit: Edit): EditResult => {
      const result = applyEdit(
        draft,
        edit,
        { mode, nextId: idSource, slideId, ...(options.analytics ? { analytics: options.analytics } : {}) },
        options.editors,
      )
      if (result.ok) {
        /**
         * The sixth promise of `apply`: a successful change is reversible.
         *
         * Recorded here rather than by each caller, which is what makes it a property of the
         * system instead of a discipline. The step holds a *reference* to the draft as it was
         * — `applyEdit` already cloned, and nothing writes to a returned draft — so this costs
         * a push and no copy, on a path inside the 100 ms input-to-feedback budget.
         *
         * A refusal records nothing, because nothing changed. FR-019's "a refused change MUST
         * NOT trigger a save" falls out of the same fact rather than needing its own check.
         */
        writeHistory(
          record(historyRef.current, {
            before: draftRef.current,
            runKey: runKeyOf(edit),
            slideId,
            selectionBefore: selectionRef.current,
          }),
        )
        draftRef.current = result.draft
        setDraft(result.draft)
        // An element that left the slide leaves the selection in the same change, so no id
        // in the selection is ever absent from the draft (data-model.md §2, invariant 1).
        setSelection((current) => clampSelection(current, result.draft, slideId))
        setLastRefusal(null)
        onChange?.(result.draft)
      } else {
        setLastRefusal(result)
      }
      return result
    },
    [draft, mode, idSource, slideId, options.editors, options.analytics, onChange, writeHistory],
  )

  /** Commit whatever the open text surface holds, before anything else changes. */
  const commitPendingText = useCallback((): void => {
    const id = textEditing
    const text = pendingText.current
    pendingText.current = null
    setTextEditing(null)
    if (id !== null && text !== null) apply({ kind: 'set-text', id, text })
    // A committed text edit is one step and ends whatever run preceded it.
    writeHistory(closeRun(historyRef.current))
  }, [textEditing, apply, writeHistory])

  const select = useCallback(
    (ids: readonly string[]): void => {
      // The in-flight edge case: commit first, so pending text lands on the element it was
      // typed into and never on the one being selected.
      if (textEditing !== null) commitPendingText()
      // Against the newest draft, not the render's: an element added moments ago in the same
      // handler is legitimately selectable.
      setSelection(clampSelection(ids, draftRef.current, slideId))
      // Changing what is selected ends the run: the next nudge is a step of its own, because
      // it is aimed at something else (FR-004a).
      writeHistory(closeRun(historyRef.current))
    },
    [textEditing, commitPendingText, slideId, setSelection, writeHistory],
  )

  const goToSlide = useCallback(
    (next: string): void => {
      if (textEditing !== null) commitPendingText()
      setSlideId(next)
      setSelection([])
      writeHistory(closeRun(historyRef.current))
    },
    [textEditing, commitPendingText, setSelection, writeHistory],
  )

  const setAuthoringTime = useCallback(
    (ms: number): void => {
      const clamped = Math.max(0, Math.min(ms, duration))
      setTimes((current) => ({ ...current, [slideId]: clamped }))
    },
    [duration, slideId],
  )

  const beginTextEdit = useCallback((id: string): void => {
    pendingText.current = null
    setTextEditing(id)
  }, [])

  const setPendingText = useCallback((text: string): void => {
    pendingText.current = text
  }, [])

  /**
   * Copy is a session action, not an `Edit`.
   *
   * It changes no authored data, so routing it through `applyEdit` would put it inside the
   * surface SC-007 requires to be inert. The consequence is deliberate: read-only cannot
   * refuse copying, and must not — reading a lesson and taking a copy of part of it changes
   * nothing, while `paste` is refused like every other edit (FR-051).
   *
   * Detached copies, so editing or deleting the source afterwards does not change what
   * pastes.
   */
  /**
   * Apply a reversal: restore the draft, show what changed, and select what came back.
   *
   * The selection rule is FR-009, and it is computed rather than recorded. `EditResult` carries
   * `idsCreated` and nothing about removals, so knowing what a `delete` took would mean a branch
   * per edit kind — which Constitution I calls a defect. Diffing element ids on the affected
   * slide between the two drafts is general, needs no per-kind knowledge, and costs one pass
   * over one slide.
   */
  const restore = useCallback(
    (
      step: { before: LessonManifest; slideId: string; selectionBefore: readonly string[] },
      direction: 'undo' | 'redo',
    ): void => {
      const current = draftRef.current
      draftRef.current = step.before
      setDraft(step.before)

      // FR-008: a reversal on another slide would otherwise be silent, and a teacher who
      // pressed undo and saw nothing move would reasonably press it again.
      if (step.slideId !== slideId) setSlideId(step.slideId)

      const elementsOf = (m: LessonManifest): string[] =>
        m.slides.find((sl) => sl.id === step.slideId)?.elements.map((e) => e.id) ?? []
      const nowThere = new Set(elementsOf(current))
      const restored = elementsOf(step.before).filter((id) => !nowThere.has(id))

      setSelection(
        clampSelection(restored.length > 0 ? restored : step.selectionBefore, step.before, step.slideId),
      )
      setLastRefusal(null)
      setLastReversal(
        describeReversal(direction, { restored: restored.length, slideChanged: step.slideId !== slideId }),
      )
      onChange?.(step.before)
    },
    [slideId, setSelection, onChange],
  )

  /**
   * Undo and redo, refused in read-only like every other change.
   *
   * The refusal is produced by the same path rather than a second one: a reversal *is* an
   * ordinary change to the draft, so `mode` is checked in one place. Nothing is recorded in
   * read-only either, because nothing there succeeds.
   */
  const refuseReadOnly = useCallback((): boolean => {
    if (mode !== 'read-only') return false
    setLastRefusal({
      ok: false,
      reason: 'read-only',
      message:
        'This lesson is open for reading. Changes are unavailable in read-only mode; ' +
        'copying is still permitted.',
    })
    return true
  }, [mode])

  const undo = useCallback((): void => {
    if (refuseReadOnly()) return
    const result = undoStack(historyRef.current, {
      before: draftRef.current,
      slideId,
      selectionBefore: selectionRef.current,
    })
    if (!result) return
    writeHistory(result.stack)
    restore(result.step, 'undo')
  }, [refuseReadOnly, slideId, writeHistory, restore])

  const redo = useCallback((): void => {
    if (refuseReadOnly()) return
    const result = redoStack(historyRef.current, {
      before: draftRef.current,
      slideId,
      selectionBefore: selectionRef.current,
    })
    if (!result) return
    writeHistory(result.stack)
    restore(result.step, 'redo')
  }, [refuseReadOnly, slideId, writeHistory, restore])

  const endEditRun = useCallback((): void => {
    writeHistory(closeRun(historyRef.current))
  }, [writeHistory])

  const copy = useCallback(
    (ids: readonly string[]): void => {
      const source = draftRef.current.slides.find((s) => s.id === slideId)?.elements ?? []
      const picked = source.filter((e) => ids.includes(e.id))
      setClipboard(JSON.parse(JSON.stringify(picked)) as Element[])
    },
    [slideId],
  )

  return useMemo(
    () => ({
      draft,
      slideId,
      selection,
      authoringTime,
      mode,
      textEditing,
      clipboard,
      lastRefusal,
      apply,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      endEditRun,
      lastReversal,
      select,
      goToSlide,
      setAuthoringTime,
      beginTextEdit,
      setPendingText,
      endTextEdit: commitPendingText,
      copy,
    }),
    [
      draft, slideId, selection, authoringTime, mode, textEditing, clipboard, lastRefusal,
      apply, undo, redo, history, endEditRun, lastReversal, select, goToSlide, setAuthoringTime,
      beginTextEdit, setPendingText, commitPendingText, copy,
    ],
  )
}
