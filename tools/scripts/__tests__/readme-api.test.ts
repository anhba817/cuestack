import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
const read = (relative: string): string => readFileSync(join(ROOT, relative), 'utf8')

/**
 * Where a README documents an API surface, that table must be complete.
 *
 * **Deliberately not "every export appears in its README".** That was measured and it is a bad rule:
 * it makes `CLAMP_CEILING_MS` and `BACKOFF_MS` into documentation debt and would report ninety
 * "undocumented exports" in the editor alone. A README is not an API reference, and a check that
 * cries wolf about a hundred internal constants is one somebody turns off.
 *
 * What is worth holding is narrower: when a document *presents itself* as the reference for a
 * surface — a Props table, an API table — a reader takes it as complete, and a member missing from
 * it is invisible rather than merely undocumented. That is what happened to `@cuestack/element`,
 * whose API table listed four of ten members while `play`, `pause`, `seekToSlide`, `autoplay` and
 * three of four events were absent.
 *
 * So each surface is **declared** below rather than guessed. A package with no entry is not
 * checked, which is honest: it means nobody has claimed its README is a reference. Adding a claim
 * means adding a row, and that is a smaller ask than the alternative.
 *
 * This file is the repo-wide half of `packages/element/test/documented.test.ts`, which stayed
 * scoped to one package after finding a defect there — the same mistake that let the broken-first-
 * example defect survive in `@cuestack/react` a pass after it was fixed in the element.
 */

interface Surface {
  readonly name: string
  readonly readme: string
  /** The heading whose table is the reference — searched, not the whole document. */
  readonly section: string
  /** Names the README must mention, extracted from the source rather than listed here. */
  members(): readonly string[]
}

/**
 * The table rows under one heading.
 *
 * **Scoped, because the whole document is not the claim.** A first draft searched the entire README
 * and passed its own negative control: deleting the `overrideAdvance` row changed nothing, because
 * the name also appears in prose two sections down. A mention is not an entry — this is a check that
 * a *table a reader treats as complete* is complete, and only rows count.
 */
const tableUnder = (readme: string, heading: string): string => {
  const start = readme.indexOf(heading)
  if (start < 0) throw new Error(`${heading} not found`)
  const rest = readme.slice(start + heading.length)
  const end = rest.indexOf('\n## ')
  return (end === -1 ? rest : rest.slice(0, end))
    .split('\n')
    .filter((line) => line.trimStart().startsWith('|'))
    .join('\n')
}

/** Every field of an exported interface, e.g. `LessonPlayerClientProps`. */
const interfaceMembers = (source: string, name: string): string[] => {
  const block = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(source)
  if (!block) throw new Error(`${name} not found — the extractor is stale, not the README`)
  return [...block[1]!.matchAll(/readonly (\w+)\??:/g)].map((m) => m[1]!)
}

const SURFACES: Surface[] = [
  {
    name: '@cuestack/react — LessonPlayer props',
    readme: 'packages/react/README.md',
    section: '## Props',
    members: () =>
      interfaceMembers(read('packages/react/src/player/LessonPlayerClient.tsx'), 'LessonPlayerClientProps'),
  },
  /**
   * **`@cuestack/adapter-http` is deliberately absent, and the reason is the rule.**
   *
   * Its README documents four of the twelve entries in `OPERATIONS`, which looks exactly like the
   * defect this file exists for — and is not one. The section says in bold that it is *"an example,
   * not a specification"*, and points at `contracts/http-operations.md` for the full list. A
   * document that disclaims completeness is not a reference, and holding it to one would produce
   * precisely the cry-wolf failure described above: eight names "missing" from a table nobody
   * claimed was whole.
   *
   * It was added here first, failed, and was removed after reading what the README actually says.
   * Recorded because the next person to extend this list will meet the same temptation.
   */
]

describe('a README that presents itself as an API reference is complete', () => {
  it('declares surfaces to check, so this cannot pass by checking nothing', () => {
    expect(SURFACES.length).toBeGreaterThan(0)
    for (const surface of SURFACES) {
      expect(existsSync(join(ROOT, surface.readme)), surface.readme).toBe(true)
    }
  })

  for (const surface of SURFACES) {
    it(surface.name, () => {
      const members = surface.members()
      expect(members.length, `${surface.name}: nothing extracted — check the extractor`).toBeGreaterThan(0)

      const table = tableUnder(read(surface.readme), surface.section)
      const missing = members.filter((name) => !table.includes(`\`${name}\``))
      expect(
        missing,
        `${surface.readme} presents an API table and omits these. A member missing from a table a ` +
          'reader treats as complete is invisible, not merely undocumented.',
      ).toEqual([])
    })
  }
})
