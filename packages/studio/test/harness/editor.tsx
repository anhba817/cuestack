import { render } from '@testing-library/react'
import type { LessonManifest } from '@cuestack/schema'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession, type EditorMode, type EditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from './ids.js'

/**
 * Render the editor the way a host does: the hook lives *inside* the tree.
 *
 * `renderHook` plus `render(<EditorCanvas session={result.current} />)` looks equivalent and is
 * not. It passes one snapshot of the session as a prop, so a later state change updates
 * `result.current` and leaves the rendered canvas holding the old object — every subsequent
 * keystroke is then handled against a stale selection and a stale draft.
 *
 * That produced a confusing failure: nudging "did nothing" because the overlay's handler read
 * an empty selection that the test had already changed. Rendering the hook inside the
 * component is both the fix and what a real host actually writes.
 *
 * The session is exposed through a mutable holder rather than a prop callback so assertions
 * can read the latest value without another render.
 */
export interface EditorHandle {
  readonly session: EditorSession
}

export function renderEditor(
  manifest: LessonManifest,
  options: { mode?: EditorMode } = {},
): { handle: EditorHandle; container: HTMLElement; unmount: () => void } {
  const holder = { session: undefined as unknown as EditorSession }
  const idSource = countingIds()

  function Harness(): React.ReactNode {
    const session = useEditorSession({
      manifest,
      slideId: manifest.slides[0]!.id,
      idSource,
      ...(options.mode ? { mode: options.mode } : {}),
    })
    holder.session = session
    return <EditorCanvas session={session} />
  }

  const { container, unmount } = render(<Harness />)
  return { handle: holder as EditorHandle, container, unmount }
}
