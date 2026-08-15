'use client'

import { LessonPlayer, PlaybackControls } from '@cuestack/react'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The tour lesson, playing, with progress on.
 *
 * `progress="slides"` is a host decision rather than a manifest field — the specification
 * says "where enabled by the teacher or organization", and this file is the organisation.
 *
 * No `resolveAsset`, because the tour has no assets. That is not a shortcut: it means every
 * state a visitor reaches here is a state of the *player*, not of a missing file, which is
 * what makes this the demonstration and the reference lesson below the honest counterexample.
 */
export function TourView({ lesson }: { lesson: LessonManifest }) {
  return (
    <LessonPlayer lesson={lesson} autoPlay progress="slides">
      <PlaybackControls />
    </LessonPlayer>
  )
}
