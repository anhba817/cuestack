'use client'

import { useState } from 'react'
import {
  EditorCanvas,
  Inspector,
  Timeline,
  builtinElementEditors,
  createElementEditorRegistry,
  useEditorSession,
  usePlayback,
} from '@cuestack/studio'
import type { LessonManifest } from '@cuestack/schema'

const editors = createElementEditorRegistry(builtinElementEditors)

/**
 * The editor, mounted the way a host mounts it.
 *
 * `'use client'`, and there is no server variant — authoring is not server-rendered. The
 * player's page next door is the opposite: it renders its first slide on the server. Having
 * both in one example app is what makes the difference visible rather than asserted.
 *
 * The draft lives in this component's state and goes nowhere else. `@cuestack/studio` ships no
 * persistence on purpose, so a host is the one that decides where a lesson is saved — here,
 * nowhere, which is honest for a demonstration and is exactly what `onChange` is for.
 *
 * **Three things have to be threaded for playback to work**, and a route that mounts the
 * timeline without them gets a playhead moving over a still canvas. The writer, because
 * element nodes register through a ref on mount; the frame's resolved state, because the
 * canvas otherwise re-derives from an authoring time that is stale while playing; and the
 * moment, so ghosts are labelled against what is on screen rather than against the session.
 */
export function EditorView({ lesson }: { lesson: LessonManifest }) {
  const [saved, setSaved] = useState(0)
  const session = useEditorSession({
    manifest: lesson,
    slideId: lesson.slides[0]!.id,
    onChange: () => setSaved((n) => n + 1),
  })

  const playback = usePlayback(session)
  const slide = session.draft.slides.find((s) => s.id === session.slideId) ?? session.draft.slides[0]!

  return (
    <div>
      <p>
        {saved === 0
          ? 'Nothing changed yet. Edits live in this page and are not saved anywhere.'
          : `${saved} edit${saved === 1 ? '' : 's'} applied — held in memory only.`}
      </p>
      <EditorCanvas
        session={session}
        writer={playback.writer}
        {...(playback.frameState ? { state: playback.frameState } : {})}
        atMs={playback.atMs}
      />
      <Timeline session={session} playback={playback} />
      <Inspector session={session} slide={slide} editors={editors} />
    </div>
  )
}
