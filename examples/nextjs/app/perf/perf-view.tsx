'use client'

import { LessonPlayer } from '@cuestack/react'
import type { LessonManifest } from '@cuestack/schema'
import { useEffect } from 'react'

/**
 * The heavy fixture, playing, so a real compositor has something to keep up with.
 *
 * No `PlaybackControls` and no progress: every pixel here is the player's own work, because the
 * number this page exists to produce is about playback and not about chrome around it.
 *
 * The ready marker is a marker rather than a sleep. A harness that never starts is a failure to
 * report (FR-005), and a driver that guesses at a duration measures its own guess.
 */
export function PerfView({ lesson }: { lesson: LessonManifest }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-harness-ready', 'react')
  }, [])

  return <LessonPlayer lesson={lesson} autoPlay />
}
