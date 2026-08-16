'use client'

import { useState } from 'react'
import {
  EditorCanvas,
  Inspector,
  builtinElementEditors,
  createElementEditorRegistry,
  useEditorSession,
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
 */
export function EditorView({ lesson }: { lesson: LessonManifest }) {
  const [saved, setSaved] = useState(0)
  const session = useEditorSession({
    manifest: lesson,
    slideId: lesson.slides[0]!.id,
    onChange: () => setSaved((n) => n + 1),
  })

  const slide = session.draft.slides.find((s) => s.id === session.slideId) ?? session.draft.slides[0]!

  return (
    <div>
      <p>
        {saved === 0
          ? 'Nothing changed yet. Edits live in this page and are not saved anywhere.'
          : `${saved} edit${saved === 1 ? '' : 's'} applied — held in memory only.`}
      </p>
      <EditorCanvas session={session} />
      <Inspector session={session} slide={slide} editors={editors} />
    </div>
  )
}
