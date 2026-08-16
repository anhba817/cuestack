import { NUDGE_UNITS, NUDGE_UNITS_COARSE } from '../geometry/constants.js'

/**
 * What a keystroke means on the canvas — decided without a DOM.
 *
 * A pure mapping from key to intent, so the whole shortcut surface can be checked as a table
 * rather than by dispatching synthetic events at a component. `Overlay.tsx` is left with
 * listeners.
 *
 * **Nothing here fires while text is being edited.** FR-016 makes that explicit and it is the
 * kind of rule that is obvious once broken: a teacher typing "add" into a heading would
 * otherwise duplicate the element twice and delete it. The caller passes `textEditing`, and
 * this returns `null` for everything.
 */

export type ShortcutIntent =
  | { readonly kind: 'nudge'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'copy' }
  | { readonly kind: 'paste' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'select-all' }
  | { readonly kind: 'clear-selection' }
  | { readonly kind: 'traverse'; readonly direction: 1 | -1 }
  | { readonly kind: 'edit-text' }
  | { readonly kind: 'reorder'; readonly direction: 'forward' | 'backward' }

export interface KeyChord {
  readonly key: string
  readonly shiftKey?: boolean
  /** Ctrl on Windows and Linux, Command on macOS — the caller normalises. */
  readonly modifier?: boolean
  readonly textEditing?: boolean
}

const NUDGES: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

export function intentFor(chord: KeyChord): ShortcutIntent | null {
  // FR-016. Before every other rule, because every other rule would be wrong here.
  if (chord.textEditing) return null

  const nudge = NUDGES[chord.key]
  if (nudge) {
    // Shift coarsens rather than adding a second binding: it is the convention every drawing
    // tool uses, and a teacher who guesses it is right.
    const step = chord.shiftKey ? NUDGE_UNITS_COARSE : NUDGE_UNITS
    return { kind: 'nudge', dx: nudge.dx * step, dy: nudge.dy * step }
  }

  if (chord.modifier) {
    switch (chord.key.toLowerCase()) {
      case 'c':
        return { kind: 'copy' }
      case 'v':
        return { kind: 'paste' }
      case 'd':
        return { kind: 'duplicate' }
      case 'a':
        return { kind: 'select-all' }
      case ']':
        return { kind: 'reorder', direction: 'forward' }
      case '[':
        return { kind: 'reorder', direction: 'backward' }
      default:
        return null
    }
  }

  switch (chord.key) {
    case 'Delete':
    case 'Backspace':
      return { kind: 'delete' }
    case 'Escape':
      return { kind: 'clear-selection' }
    case 'Enter':
      return { kind: 'edit-text' }
    case 'Tab':
      return { kind: 'traverse', direction: chord.shiftKey ? -1 : 1 }
    default:
      return null
  }
}
