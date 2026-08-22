import type { LessonManifest } from '@cuestack/schema'
import heavy from '../heavy-lesson.json' with { type: 'json' }
import { PerfView } from './perf-view'

/**
 * The React harness for the browser playback check.
 *
 * **The lesson is imported, not fetched.** `tools/scripts/fixtures/` is in neither this app's
 * dependency graph nor its tree, and the app has read fixtures by static JSON import since it was
 * written — `app/page.tsx` line 2 does exactly this. A generated file plus a fetch would have meant
 * a `public/` directory, a gitignore rule, and a client component to do the fetching, all to reach
 * the same place.
 *
 * **`examples/*` is a pnpm workspace member**, so `pnpm build` compiles this route — not only
 * Gate 12. A mistake here breaks every build in the repository, which is why the fixture is a
 * static import with nothing left to be absent.
 *
 * The lesson is the same 50-slide, 300-element fixture every other budget uses, and
 * `browser-check.test.ts` asserts the committed JSON still equals `heavyLesson()`. Measuring a
 * different lesson than `pnpm gates` does would make the two figures incomparable, which is the
 * whole reason this one exists.
 */
export default function PerfPage() {
  return <PerfView lesson={heavy as unknown as LessonManifest} />
}
