import { useCallback, useMemo, useRef, useState } from 'react'
import type { AnalyticsAdapter } from '@cuestack/core'
import type { Element, LessonManifest } from '@cuestack/schema'
import { applyEdit } from '../draft/reducer.js'
import type { Edit, EditResult } from '../draft/edit.js'
import { randomIds, type IdSource } from '../draft/ids.js'
import { clampSelection } from './selection.js'
import type { ElementEditorRegistry } from '../registry/editors.js'

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
  const [selection, setSelection] = useState<readonly string[]>([])
  // Per slide, so returning to a slide returns to where the teacher left it (FR-012).
  const [times, setTimes] = useState<Record<string, number>>({})
  const [textEditing, setTextEditing] = useState<string | null>(null)
  const [clipboard, setClipboard] = useState<readonly Element[]>([])
  const [lastRefusal, setLastRefusal] = useState<Extract<EditResult, { ok: false }> | null>(null)

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
    [draft, mode, idSource, slideId, options.editors, options.analytics, onChange],
  )

  /** Commit whatever the open text surface holds, before anything else changes. */
  const commitPendingText = useCallback((): void => {
    const id = textEditing
    const text = pendingText.current
    pendingText.current = null
    setTextEditing(null)
    if (id !== null && text !== null) apply({ kind: 'set-text', id, text })
  }, [textEditing, apply])

  const select = useCallback(
    (ids: readonly string[]): void => {
      // The in-flight edge case: commit first, so pending text lands on the element it was
      // typed into and never on the one being selected.
      if (textEditing !== null) commitPendingText()
      // Against the newest draft, not the render's: an element added moments ago in the same
      // handler is legitimately selectable.
      setSelection(clampSelection(ids, draftRef.current, slideId))
    },
    [textEditing, commitPendingText, slideId],
  )

  const goToSlide = useCallback(
    (next: string): void => {
      if (textEditing !== null) commitPendingText()
      setSlideId(next)
      setSelection([])
    },
    [textEditing, commitPendingText],
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
      apply, select, goToSlide, setAuthoringTime, beginTextEdit, setPendingText,
      commitPendingText, copy,
    ],
  )
}
