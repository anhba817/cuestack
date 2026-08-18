import type { EditorSession } from '../session/useEditorSession.js'

/** The three ways a teacher opens a preview (FR-008, FR-009, FR-010). */
export type PreviewStart = 'beginning' | 'slide' | 'position'

export interface StartPoint {
  readonly slideIndex: number
  readonly atMs: number
}

/**
 * Where a preview begins, in the player's terms.
 *
 * **The only translation between editor state and playback state**, which is why it is a
 * function and not three branches spread through a component. The editor thinks in a slide
 * *id* and an authoring time; the player takes a slide *index* and a moment to seek to.
 * Everything after this is the player's.
 *
 * Pure and DOM-free, so it can be asserted without mounting anything — the three cases are
 * exactly the kind of thing that is easy to get subtly wrong and expensive to debug through
 * a rendered tree.
 */
export function startPointFor(session: EditorSession, from: PreviewStart): StartPoint {
  if (from === 'beginning') return { slideIndex: 0, atMs: 0 }

  const index = session.draft.slides.findIndex((s) => s.id === session.slideId)
  const slideIndex = index >= 0 ? index : 0
  if (from === 'slide') return { slideIndex, atMs: 0 }

  /**
   * The authoring time, clamped into the slide.
   *
   * The playhead can sit at a slide's exact duration — feature 006 allows it, and the ruler
   * ends there — while element windows are half-open, so seeking to `durationMs` renders an
   * empty stage and looks like a broken preview. One millisecond back is the last moment the
   * slide actually has.
   */
  const slide = session.draft.slides[slideIndex]
  const last = slide ? Math.max(0, slide.durationMs - 1) : 0
  return { slideIndex, atMs: Math.min(Math.max(0, Math.round(session.authoringTime)), last) }
}
