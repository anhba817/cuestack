import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
const SPECS = join(ROOT, 'specs')

/**
 * Every functional requirement in a spec appears in its plan's coverage table.
 *
 * **This exists because its absence cost a MUST.** Feature 011's FR-010 requires the adapter to
 * cover "slide playback, timing, effects, transitions, and the element types that need nothing from
 * the host". The word *transition* appeared nowhere in that feature's `plan.md` or `tasks.md`. It
 * survived the spec, survived `contracts/element-adapter.md` — which lists it under Covered — and
 * was lost between the contract and the task list. Eight `/speckit-analyze` passes did not find it,
 * because each asked what was *wrong with what was written*, and a requirement absent from
 * everything downstream leaves nothing wrong-looking to find.
 *
 * A coverage table fixes that only while it stays honest, and a hand-maintained table of claims
 * about the code is precisely what this feature spent its time correcting elsewhere. So the table is
 * checked rather than trusted: adding an FR to a spec fails this until the plan says where it is
 * satisfied.
 *
 * **Opt-in per feature, deliberately.** Only plans that declare a `## Requirement coverage` section
 * are checked. Retrofitting the table onto nine shipped features is a change to nine documents
 * nobody is reading today, and a test that failed until somebody did it would be turned off rather
 * than satisfied.
 */
const FR = /\*\*(FR-\d+[a-z]?)\*\*/g

interface Feature {
  readonly name: string
  readonly spec: string
  readonly plan: string
}

const features = (): Feature[] =>
  readdirSync(SPECS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      spec: join(SPECS, entry.name, 'spec.md'),
      plan: join(SPECS, entry.name, 'plan.md'),
    }))
    .filter((f) => existsSync(f.spec) && existsSync(f.plan))

const withTable = (): Feature[] =>
  features().filter((f) => readFileSync(f.plan, 'utf8').includes('## Requirement coverage'))

describe('a plan that claims requirement coverage covers every requirement', () => {
  it('finds at least one plan to check, so the suite cannot pass by finding nothing', () => {
    // The failure mode this whole file is about, applied to itself.
    expect(withTable().length).toBeGreaterThan(0)
  })

  for (const feature of withTable()) {
    it(feature.name, () => {
      const spec = readFileSync(feature.spec, 'utf8')
      const plan = readFileSync(feature.plan, 'utf8')

      const start = plan.indexOf('## Requirement coverage')
      const rest = plan.slice(start + 1)
      const next = rest.indexOf('\n## ')
      const section = next === -1 ? rest : rest.slice(0, next)

      /**
       * **Table rows only, not the whole section.** The prose beneath feature 011's table says
       * "FR-010's row is the one to read", and a section-wide search found that sentence and
       * counted the requirement as covered — so deleting the actual row still passed. A commentary
       * about a requirement is not a claim that it is satisfied, and only a row is.
       */
      const table = section
        .split('\n')
        .filter((line) => line.trimStart().startsWith('|'))
        .join('\n')

      const required = [...new Set([...spec.matchAll(FR)].map((m) => m[1]!))]
      expect(required.length, 'the spec declares no requirements to cover').toBeGreaterThan(0)

      /**
       * Matched on a boundary, not as a substring. `table.includes('FR-010')` is satisfied by a row
       * that only mentions `FR-010a` — which is exactly what the coverage table contains, so the
       * first version of this test passed its own negative control with the FR-010 row deleted.
       * That is the second loose pattern in this feature to pass a control it should have failed;
       * both were found only because the control was actually run.
       */
      const mentioned = new Set(
        [...table.matchAll(/FR-\d+[a-z]?/g)].map((m) => m[0]),
      )
      const missing = required.filter((id) => !mentioned.has(id))
      expect(
        missing,
        `${feature.name}: these requirements are in the spec and absent from the plan's coverage ` +
          'table. Either the plan is missing them, or the table is.',
      ).toEqual([])
    })
  }
})
