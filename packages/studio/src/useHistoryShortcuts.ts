import { useEffect } from 'react'
import { historyIntentFor } from './history/shortcuts.js'
import type { EditorSession } from './session/useEditorSession.js'

/**
 * Undo and redo from the keyboard, wherever focus happens to be.
 *
 * The host attaches this to whatever element wraps its editor. It has to be the host's
 * because the studio exports parts a host composes and has no editor root of its own — the
 * same fact feature 007 met when `inert` turned out to be unimplementable — and undo must work
 * with focus in the inspector or the timeline, not only on the canvas.
 *
 * **A target rather than `document`.** A global listener would steal keystrokes from a host's
 * own surfaces, and the studio does not own the document (research R-10).
 *
 * **`canvas/shortcuts.ts` is deliberately not extended.** `Overlay` already listens for
 * keydown, so a shared table plus this binding would give one keystroke two reversals whenever
 * the canvas had focus — a bug that would take a while to see.
 */
export function useHistoryShortcuts(session: EditorSession, target: HTMLElement | null): void {
  useEffect(() => {
    if (!target) return
    const onKeyDown = (event: KeyboardEvent): void => {
      // A text surface keeps the platform's own undo, which is what every editor does — and
      // the alternative is worse than it sounds: the session has one step for a committed text
      // edit, so an editor-level undo mid-typing would discard the whole paragraph rather than
      // the last word.
      if (isTextEntry(event.target)) return

      const intent = historyIntentFor({
        key: event.key,
        shiftKey: event.shiftKey,
        // Command on macOS, Ctrl elsewhere. Reading both is what makes one binding correct on
        // every platform without asking the host which it is on.
        modifier: event.metaKey || event.ctrlKey,
      })
      if (!intent) return
      event.preventDefault()
      if (intent === 'undo') session.undo()
      else session.redo()
    }

    target.addEventListener('keydown', onKeyDown)
    return () => target.removeEventListener('keydown', onKeyDown)
  }, [session, target])
}

function isTextEntry(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false
  if (node.isContentEditable) return true
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
