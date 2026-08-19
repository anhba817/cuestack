/**
 * What a keystroke means for history, decided without a DOM.
 *
 * A separate table from `canvas/shortcuts.ts`, and the separation is load-bearing rather than
 * tidy. `intentFor` is called by `Overlay`'s own keydown listener, so adding undo there *and*
 * binding at the editor root would give one keystroke two reversals whenever the canvas had
 * focus. That is a bug it would take a while to see (research R-10).
 *
 * Undo has to work with focus in the inspector or the timeline, and the studio exports parts a
 * host composes rather than an editor root of its own, so the binding is something the host
 * attaches. `useHistoryShortcuts` is the smallest thing that can be.
 */

export type HistoryIntent = 'undo' | 'redo'

export interface HistoryChord {
  readonly key: string
  readonly shiftKey?: boolean
  /** Ctrl on Windows and Linux, Command on macOS. The caller normalises. */
  readonly modifier?: boolean
}

/**
 * Both conventions, because both are conventional.
 *
 * Shift+Cmd+Z is the redo every Mac application uses; Ctrl+Y is the one Windows applications
 * use. A teacher who guesses either is right, which is the whole standard for a shortcut.
 */
export function historyIntentFor(chord: HistoryChord): HistoryIntent | null {
  if (!chord.modifier) return null
  const key = chord.key.toLowerCase()
  if (key === 'z') return chord.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'
  return null
}
