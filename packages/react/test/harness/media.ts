// A relative path into core's test harness, not a package import: `@cuestack/core` resolves
// to `dist`, which contains no test code, and adding a `./test-harness` export to make this
// tidy would publish it. Test-only, so the boundary rules that govern `src` do not apply —
// what they forbid is production code reaching sideways, and this is a fake.
import {
  fakeMedia,
  degenerate,
  type FakeMedia,
  type MediaCommand,
} from '../../../core/test/harness/media.js'
import { testPorts, type TestPorts } from './ports.js'

/**
 * A player wired to a media element that a test drives directly.
 *
 * happy-dom gives you an `<video>` object with no decoder behind it: `play()` resolves
 * nothing, `currentTime` moves only when assigned, and `timeupdate` never fires on its own.
 * A test built on that would be testing happy-dom. Constitution II settles it — no test may
 * depend on real media playback — so the player is handed a port instead of an element, and
 * the port is the fake from `@cuestack/core`'s harness.
 *
 * The wrapper exists because a player test needs *both* halves: a hand-advanced clock for
 * lesson time and a scripted element for media time. Two clocks is the whole subject of US2,
 * and a test that could only control one of them could not reach the interesting cases.
 */

export interface MediaTestPorts extends TestPorts {
  readonly media: FakeMedia
}

export function mediaPorts(): MediaTestPorts {
  const media = fakeMedia()
  return { ...testPorts(), media }
}

export { degenerate }
export type { FakeMedia, MediaCommand }
