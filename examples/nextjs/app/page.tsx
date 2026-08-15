import { LessonPlayerStatic, builtinRenderers } from '@cuestack/react'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }
import type { LessonManifest } from '@cuestack/schema'
import { validate } from '@cuestack/schema/validate'
import { ClientProbe } from './client-probe'
import { LessonView } from './lesson-view'
import { TourView } from './tour-view'
import { tourLesson } from './tour'

/**
 * A lesson worth finishing, plus the reference lesson's two server-rendering demonstrations.
 *
 * **The tour, first.** Three slides that can actually be completed: one that plays itself
 * out, a required question that holds the lesson until it is answered, progress throughout,
 * and a completion state at the end. It carries no assets, so every state it reaches is a
 * state of the player rather than of a missing file.
 *
 * The reference lesson cannot do that job, and the reasons are all honest ones: its second
 * slide waits for a video this repository does not serve, and its last advances `on_click`,
 * which no player supports yet. What it demonstrates instead — below — is the RSC boundary:
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

  /*
   * The tour lesson is hand-authored TypeScript, so nothing else would tell us it is still a
   * lesson. Checked here, in a Server Component, where the validator costs a visitor nothing
   * — and where a format change makes this page say so instead of rendering something subtly
   * wrong.
   */
  const tourValid = validate(tourLesson).ok

  // The server entry withholds the frame loop and the transport, because an effect never
  // runs during server rendering. Its absence here is the condition having resolved.
  const surface = { LessonPlayerStatic, builtinRenderers } as Record<string, unknown>
  const serverEntryResolved = surface['useFrameLoop'] === undefined && builtinRenderers.length === 7

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.6 }}>
      <h1>Cuestack — {lesson.lesson.title}</h1>

      <h2>A lesson worth finishing</h2>
      <p>
        Answer the question on slide 2 — the lesson waits for it. Progress counts slides you
        have reached, and an ending appears once the last slide runs out. Turn on your
        system&rsquo;s reduced-motion setting and reload: the title on slide 1 fades in
        instead of sliding, at the same moment and to the same place.
      </p>
      <div style={{ maxWidth: '48rem', border: '1px solid #ddd' }}>
        <TourView lesson={tourLesson} />
      </div>
      <p>
        Valid against the schema: <code>{String(tourValid)}</code>.
      </p>

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
        behaviour when a host has not said where its assets live — and the slide that waits
        for the video says so and offers a way past, rather than stopping in silence.
      </p>

      <ClientProbe />
    </main>
  )
}
