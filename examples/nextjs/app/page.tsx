import { LessonPlayer } from '@cuestack/react'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }
import type { LessonManifest } from '@cuestack/schema'
import { ClientProbe } from './client-probe'

/**
 * The first slide, server-rendered.
 *
 * This is a React Server Component, so `LessonPlayer` here resolves through the
 * `react-server` condition. It renders the slide's state at time zero into the HTML
 * document — reload with JavaScript disabled and the stage is still there.
 *
 * Note the reference lesson's first slide is deliberately empty at time zero: its
 * title fades in at 500ms. The stage renders at the authored proportions so nothing
 * shifts when the content arrives, which is the property that matters, but it does
 * mean this page shows an empty frame until playback begins. Recorded in
 * `packages/react/test/ssr/content.test.ts`.
 */
export default function Page() {
  const lesson = reference as unknown as LessonManifest

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.6 }}>
      <h1>Cuestack — {lesson.lesson.title}</h1>

      <div style={{ maxWidth: '48rem', border: '1px solid #ddd' }}>
        <LessonPlayer lesson={lesson} />
      </div>

      <p>
        Rendered on the server: {lesson.slides.length} slides, aspect ratio{' '}
        {lesson.lesson.aspectRatio}. Disable JavaScript and reload — the stage survives.
      </p>

      <ClientProbe />
    </main>
  )
}
