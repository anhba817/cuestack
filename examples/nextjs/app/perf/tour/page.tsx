import { PerfView } from '../perf-view'
import { tourLesson } from '../../tour'

/**
 * The tour lesson, alone, for the baseline reference.
 *
 * The front page plays this lesson too, but beside two further server-rendering demonstrations —
 * so a frame measured there would include work this feature is not asking about. A claim about a
 * teacher's experience should measure the lesson, not the page that happens to host it.
 */
export default function PerfTourPage() {
  return <PerfView lesson={tourLesson} />
}
