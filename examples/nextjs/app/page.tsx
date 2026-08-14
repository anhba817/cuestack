import { validate } from '@cuestack/schema/validate'
import type { LessonManifest } from '@cuestack/schema'
import { ENTRY_KIND } from '@cuestack/react'
import { ClientProbe } from './client-probe'

/**
 * Wave 0's only visible artifact, and it exists for one reason: to prove the
 * `exports` map resolves correctly in both directions of the Next.js boundary.
 *
 * This file is a React Server Component. It imports `@cuestack/react`, and the
 * value it receives must come from the `react-server` condition — the server
 * entry — not the client one. `ClientProbe` sits on the other side of a
 * "use client" boundary and must receive the client entry from the same
 * specifier. Nothing else in Wave 0 can catch a condition-order mistake, and
 * such a mistake does not throw: it silently ships the wrong bundle and
 * surfaces two waves later as an untraceable hydration bug.
 *
 * There is no renderer yet. The first real slide arrives in Wave 2.
 */
export default async function Page() {
  // Imported rather than read from disk: the bundler rewrites module ids, so a
  // path computed from require.resolve() is meaningless once Turbopack is done.
  const reference = (await import('@cuestack/schema/fixtures/valid/reference.json')).default
  const result = validate(reference)

  const lesson: LessonManifest | null = result.ok ? result.lesson : null

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.6 }}>
      <h1>Cuestack — Wave 0</h1>

      <section>
        <h2>Server-side validation</h2>
        {lesson ? (
          <p>
            Validated <strong>{lesson.lesson.title}</strong> on the server:{' '}
            {lesson.slides.length} slides, language {lesson.lesson.language}, aspect ratio{' '}
            {lesson.lesson.aspectRatio}.
          </p>
        ) : (
          <pre>{JSON.stringify(result.ok ? null : result.issues, null, 2)}</pre>
        )}
        <p>
          This paragraph is in the HTML document before any JavaScript runs — which is the
          property Wave 2&apos;s server-rendered first frame depends on.
        </p>
      </section>

      <section>
        <h2>Export condition resolution</h2>
        <p>
          Resolved from a server component: <code>ENTRY_KIND = {ENTRY_KIND}</code>
        </p>
        <ClientProbe />
      </section>
    </main>
  )
}
