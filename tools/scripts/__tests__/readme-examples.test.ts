import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

/**
 * A README whose first example renders a player must also show what starts it.
 *
 * **This is a class-level check for a defect found twice, in two packages, a pass apart.**
 * `@cuestack/element`'s opening example placed the tag and assigned a manifest under the sentence
 * "that is the whole integration"; run verbatim it rendered one frame and held. The identical shape
 * sat in `@cuestack/react`'s first example — `<LessonPlayer lesson={lesson} />` beneath "that is the
 * whole minimum" — in the package every host is told to use for real lessons.
 *
 * Neither was an API error. Both packages document the behaviour correctly elsewhere: the element's
 * `autoplay` attribute, and the player's `autoPlay` prop with a good reason for defaulting to false
 * (audible media needs a gesture). What was wrong was the *first thing a reader copies*, and no
 * check in this repository looked at that.
 *
 * The fix for one instance was a documentation edit. The fix for the class is this file, because a
 * third adapter will have a first example too.
 */

/** Ways a lesson can be started, per package. Any one of them present is enough. */
const STARTERS = [
  /\bautoplay\b/i, // the element's attribute and the player's prop
  /\bPlaybackControls\b/, // the player's own controls, which a learner presses
  /\.play\(\)/, // a host calling the transport, or the element's method
  /\busePlayer\(\)/, // the hook that hands a host the transport
]

interface Doc {
  readonly name: string
  readonly text: string
}

const docs = (): Doc[] => {
  const found: Doc[] = []
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const path = join(ROOT, 'packages', pkg, 'README.md')
    if (existsSync(path)) found.push({ name: `packages/${pkg}/README.md`, text: readFileSync(path, 'utf8') })
  }
  for (const extra of ['README.md', 'docs/packages.md']) {
    const path = join(ROOT, extra)
    if (existsSync(path)) found.push({ name: extra, text: readFileSync(path, 'utf8') })
  }
  return found
}

/** Code blocks that put a player on a page, rather than illustrating an unrelated API. */
const PLAYER = /<LessonPlayer|<cuestack-lesson/

const blocksWithAPlayer = (text: string): string[] =>
  [...text.matchAll(/```(?:tsx?|jsx?|html|javascript|typescript)\n([\s\S]*?)```/g)]
    .map((m) => m[1]!)
    .filter((block) => PLAYER.test(block))

describe('a README that shows a player also shows what starts it', () => {
  it('finds documents to check, so this cannot pass by finding nothing', () => {
    const withPlayers = docs().filter((d) => blocksWithAPlayer(d.text).length > 0)
    expect(withPlayers.map((d) => d.name).sort()).toEqual(
      ['packages/element/README.md', 'packages/react/README.md'].sort(),
    )
  })

  for (const doc of docs()) {
    const blocks = blocksWithAPlayer(doc.text)
    if (blocks.length === 0) continue

    it(`${doc.name} — the first player example`, () => {
      /**
       * **The first block only, deliberately.** Later examples are fragments about one prop each,
       * and requiring the start step in every one would push documents toward repeating boilerplate
       * that obscures what each fragment is for. A reader copies the first one.
       */
      const first = blocks[0]!
      const started = STARTERS.some((pattern) => pattern.test(first))
      expect(
        started,
        `${doc.name}'s first player example renders a lesson that never starts. Show ` +
          'PlaybackControls, autoplay, play(), or usePlayer() — or a reader copies a frozen frame.',
      ).toBe(true)
    })

    it(`${doc.name} — says the later examples are fragments`, () => {
      // If the later blocks omit the start step, the document must say why, or a reader reasonably
      // reads the shortest one as the recommended integration.
      const laterOmit = blocks.slice(1).some((b) => !STARTERS.some((p) => p.test(b)))
      if (!laterOmit) return
      expect(
        /fragment|not integrations|omit the controls|for brevity/i.test(doc.text),
        `${doc.name} has later player examples with no start step and never says they are fragments`,
      ).toBe(true)
    })
  }
})
