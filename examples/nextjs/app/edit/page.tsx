import { validate } from '@cuestack/schema/validate'
import { tourLesson } from '../tour'
import { EditorView } from './editor-view'

/**
 * The authoring route.
 *
 * A Server Component that validates the lesson and hands it to a client editor — the same
 * shape a host would use, and the reason this route exists in the example rather than only in
 * tests: it is the one place the RSC boundary is real. `@cuestack/studio` has no
 * `react-server` condition, so importing it from a Server Component would fail the build,
 * which is a guarantee no unit test can make.
 */
export default function EditPage() {
  const result = validate(tourLesson)
  if (!result.ok) {
    return (
      <main>
        <h1>The tour lesson is invalid</h1>
        <p>{result.issues[0]?.message}</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Authoring</h1>
      <p>
        The same lesson the player renders next door, open in the editor. Add an element, drag
        it, type into it, and describe it in the panel. Below the canvas, the timeline: a track
        per element, a playhead that moves the canvas, and play on the same clock the player
        uses. Nothing is saved.
      </p>
      <EditorView lesson={tourLesson} />
    </main>
  )
}
