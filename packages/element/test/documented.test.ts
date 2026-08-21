import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const README = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8')
const SOURCE = readFileSync(join(import.meta.dirname, '..', 'src', 'LessonElement.ts'), 'utf8')

/**
 * Every public member of the element appears in the README.
 *
 * **This runs the opposite direction from every other check here, and that gap cost the headline
 * example.** The suites in this package ask "does the code do what the documents promise" — that is
 * how the missing transitions, the missing methods, and the missing events were all found. Nothing
 * asked the reverse: *does the documentation still describe what the code does.*
 *
 * So when `autoplay` became required — a correct change, honouring the contract — the README kept
 * telling a reader to place the tag, assign a manifest, and expect a lesson. Run verbatim it
 * rendered the first frame and held forever, under a sentence promising "that is the whole
 * integration". Nothing failed. It is the most user-visible defect this package has had, and the
 * only one that would have reached a reader before it reached a test.
 *
 * Names are read out of the source rather than listed here, so adding a member is what fails this —
 * a hand-written list would need the same discipline that already lapsed once.
 *
 * **The repo-wide half lives in `tools/scripts/__tests__/readme-api.test.ts`.** This file stayed
 * scoped to one package after finding a defect here, which is the same mistake that let the
 * broken-first-example defect survive in `@cuestack/react` a pass after it was fixed in this one.
 * What stays here is what is specific to a custom element — `observedAttributes`, dispatched
 * events, and the opening example — and what generalises is over there.
 */

/** `play(): void`, `pause(): void` — public methods, excluding `#private` ones and accessors. */
const methods = (): string[] =>
  [...SOURCE.matchAll(/^ {2}(?!#|static |get |set |\/)([a-z][A-Za-z0-9]*)\s*\(/gm)]
    .map((m) => m[1]!)
    .filter((name) => !name.endsWith('Callback') && name !== 'constructor')

/** `set manifest(...)` / `get manifest(...)` — the property surface a host assigns. */
const properties = (): string[] => [
  ...new Set([...SOURCE.matchAll(/^ {2}(?:get|set) ([a-z][A-Za-z0-9]*)/gm)].map((m) => m[1]!)),
]

/** Whatever `observedAttributes` actually returns. */
const attributes = (): string[] => {
  const block = SOURCE.match(/observedAttributes\(\): string\[\] \{\s*return \[([^\]]*)\]/)
  return block ? [...block[1]!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!) : []
}

const events = (): string[] => [...new Set([...SOURCE.matchAll(/'(cuestack:[a-z]+)'/g)].map((m) => m[1]!))]

describe('the README describes what the element actually does', () => {
  it('finds a surface to check, so the suite cannot pass by finding nothing', () => {
    expect(methods().length, 'methods').toBeGreaterThan(0)
    expect(properties().length, 'properties').toBeGreaterThan(0)
    expect(attributes().length, 'attributes').toBeGreaterThan(0)
    expect(events().length, 'events').toBeGreaterThan(0)
  })

  it('documents every public method', () => {
    const missing = methods().filter((name) => !README.includes(`${name}(`))
    expect(missing, 'public methods absent from the README').toEqual([])
  })

  it('documents every property a host can set', () => {
    const missing = properties().filter((name) => !README.includes(`\`${name}\``))
    expect(missing, 'properties absent from the README').toEqual([])
  })

  it('documents every observed attribute', () => {
    /**
     * `observedAttributes` is the list the *platform* is told this element reacts to. An entry there
     * with no README row is a supported attribute nobody can discover — and one with no
     * `attributeChangedCallback` behind it was a real defect in this package, found by reading the
     * contract clause by clause.
     */
    const missing = attributes().filter((name) => !README.includes(`\`${name}\``))
    expect(missing, 'observed attributes absent from the README').toEqual([])
  })

  it('documents every value the package exports', () => {
    /**
     * Members are not the whole surface. `COVERED`, `NOT_COVERED` and `covers()` are exported for a
     * host to decide *before* embedding whether a lesson is playable here — and appeared nowhere in
     * the README, which made a deliberate API undiscoverable. The member checks above could not see
     * it, because they read `LessonElement.ts` and these live in `covered.ts`.
     */
    const index = readFileSync(join(import.meta.dirname, '..', 'src', 'index.ts'), 'utf8')
    const exported = new Set<string>()
    for (const match of index.matchAll(/export \{([^}]*)\}/g)) {
      for (const part of match[1]!.split(',')) {
        const entry = part.trim()
        // `type CoveredType` is skipped, not stripped. A type alias is the compile-time shadow of a
        // value a host already reads about — `CoveredType` is what `COVERED` narrows to — and there
        // is nothing for a README row to say about it that its value's row does not. Stripping the
        // prefix instead, as a first draft did, demands documentation for something invisible at
        // runtime.
        if (!entry || entry.startsWith('type ')) continue
        const name = entry.split(' as ').pop()!.trim()
        if (/^[A-Za-z]/.test(name)) exported.add(name)
      }
    }
    expect(exported.size, 'the package must export something to check').toBeGreaterThan(0)

    const missing = [...exported].filter(
      (name) => !README.includes(`\`${name}\``) && !README.includes(`${name}(`),
    )
    expect(missing, 'exports absent from the README').toEqual([])
  })

  it('documents every event it dispatches', () => {
    const missing = events().filter((name) => !README.includes(name))
    expect(missing, 'events absent from the README').toEqual([])
  })

  it('shows an example that would actually play', () => {
    /**
     * The specific failure, asserted directly rather than trusted to the tables above: a reader who
     * copies the first code block gets a lesson that runs. `autoplay` in the markup, or a visible
     * `play()` call — either is a working integration, and neither being present is not.
     */
    const firstBlock = README.match(/```html\n([\s\S]*?)```/)
    expect(firstBlock, 'the README must open with an integration example').toBeTruthy()
    const example = firstBlock![1]!
    expect(
      /\bautoplay\b/.test(example) || /\.play\(\)/.test(example),
      'the opening example must autoplay or call play(), or it renders one frame and holds',
    ).toBe(true)
  })
})
