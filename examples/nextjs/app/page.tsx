import { LessonPlayerStatic, builtinRenderers } from '@cuestack/react'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }
import type { LessonManifest } from '@cuestack/schema'
import { ClientProbe } from './client-probe'
import { LessonView } from './lesson-view'

/**
 * The reference lesson, server-rendered and then playing.
 *
 * Two players on purpose, showing the two halves of the wave's claim:
 *
 *  - **Slide 2, static.** Rendered by this Server Component through the `react-server`
 *    condition, at time zero, and never hydrated. Reload with JavaScript disabled and it is
 *    still there. Slide 2 rather than slide 1 because the first slide is *deliberately*
 *    empty at time zero — its title fades in at 500 ms — so it would demonstrate a correctly
 *    shaped empty box.
 *  - **Slide 1, playing.** Server-rendered as a client component and hydrated into playback.
 *
 * The `react-server` assertion below is the reason this app exists. A wrongly ordered exports
 * map does not throw: it silently resolves the client bundle into a server context, and the
 * symptom appears waves later as a hydration bug nobody can trace. This is the only real RSC
 * boundary in the repository and therefore the only place it is observable.
 */
export default function Page() {
  const lesson = reference as unknown as LessonManifest

  // The server entry withholds the frame loop and the transport, because an effect never
  // runs during server rendering. Its absence here is the condition having resolved.
  const surface = { LessonPlayerStatic, builtinRenderers } as Record<string, unknown>
  const serverEntryResolved = surface['useFrameLoop'] === undefined && builtinRenderers.length === 7

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.6 }}>
      <h1>Cuestack — {lesson.lesson.title}</h1>

      <h2>Server-rendered, never hydrated</h2>
      <p>
        Slide 2 at time zero, from a React Server Component. Disable JavaScript and reload —
        this one does not change.
      </p>
      <div style={{ maxWidth: '48rem', border: '1px solid #ddd' }}>
        <LessonPlayerStatic lesson={lesson} slideIndex={1} />
      </div>

      <h2>Hydrated and playing</h2>
      <p>
        Slide 1, server-rendered and then played. It is empty for the first 500 ms by design:
        the title fades in, and the stage holds its shape so nothing shifts when it arrives.
      </p>
      <div style={{ maxWidth: '48rem', border: '1px solid #ddd' }}>
        <LessonView lesson={lesson} />
      </div>

      <p>
        {lesson.slides.length} slides, aspect ratio {lesson.lesson.aspectRatio}. Server entry
        resolved: <code>{String(serverEntryResolved)}</code>.
      </p>
      <p>
        The lesson&rsquo;s media assets are opaque ids with nothing serving them, so video,
        audio, and image elements show their reserved-space fallback. That is the real
        behaviour when a host has not said where its assets live.
      </p>

      <ClientProbe />
    </main>
  )
}
