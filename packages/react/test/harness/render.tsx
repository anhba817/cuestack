import { renderToString } from 'react-dom/server'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { expect } from 'vitest'
import type { ReactElement } from 'react'

/**
 * Server render, with no DOM in play.
 *
 * `renderToString` does not touch the document, so this exercises the same path a
 * server does — which is the point of FR-001 and the only way to catch a component
 * that quietly needs a browser.
 */
export function server(element: ReactElement): string {
  return renderToString(element)
}

/**
 * Hydrate server markup and return what the DOM looks like afterwards.
 *
 * React reports a hydration mismatch through `console.error` rather than by
 * throwing, so a test that merely rendered would pass with warnings streaming by.
 * The console is patched to fail instead (research R-07).
 */
export async function hydrate(element: ReactElement, markup: string): Promise<{
  before: string
  after: string
  warnings: string[]
}> {
  const container = document.createElement('div')
  container.innerHTML = markup
  document.body.appendChild(container)
  const before = container.innerHTML

  const warnings: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }

  try {
    await act(async () => {
      hydrateRoot(container, element)
    })
  } finally {
    console.error = original
  }

  return { before, after: container.innerHTML, warnings }
}

/**
 * Canonical form of a markup string, for comparing server output against the DOM.
 *
 * Only the `style` attribute is touched, and only its formatting: React serialises
 * `--cs-x:120;--cs-y:80` while a browser's CSSOM reserialises the same declarations as
 * `--cs-x: 120; --cs-y: 80;`. Once the player gained a second render — the transport arriving
 * from its mount effect — every hydration comparison failed on that whitespace alone.
 *
 * React's empty text separators are also dropped. `renderToString` emits `<!-- -->` between
 * adjacent text nodes so the client knows where one ends; a re-render replaces the text and
 * the separators go. They are empty comments carrying no content — `a<!-- -->b` and `ab` are
 * the same text — so removing them cannot conceal a difference in what a learner reads.
 *
 * Attribute order within a tag is normalised too. HTML attaches no meaning to it, and the
 * DOM's own serialisation reorders `<input type readonly>` freely — but attribute *sets* are
 * compared, so a changed value, a missing attribute, or an extra one all still fail.
 *
 * Declarations are split, trimmed, and sorted, so a different value, a missing property, an
 * extra one, or any difference outside the style attribute all still fail. `normalisation.test.ts`
 * asserts that, because a normaliser that quietly hid real differences would turn the whole
 * hydration suite green and meaningless.
 */
export function canonical(markup: string): string {
  const styles = markup.replace(/<!--\s*-->/g, '').replace(/style="([^"]*)"/g, (_match, body: string) => {
    const declarations = body
      .split(';')
      .map((d) => d.trim().replace(/\s*:\s*/, ':'))
      .filter((d) => d !== '')
      .sort()
    return `style="${declarations.join(';')}"`
  })

  return styles.replace(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)+)\s*(\/?)>/g, (_m, tag, attrs, slash) => {
    const parsed = [...String(attrs).matchAll(/([\w:-]+)(="[^"]*")?/g)]
      .map((a) => `${a[1]}${a[2] ?? ''}`)
      // An empty value and no value are the same attribute: React writes `readonly=""`
      // where the DOM may write `readonly`.
      .map((a) => a.replace(/=""$/, ''))
      .sort()
    return `<${tag} ${parsed.join(' ')}${slash}>`
  })
}

/** Assert hydration was clean — both halves, because either alone is insufficient. */
export function expectCleanHydration(result: { before: string; after: string; warnings: string[] }): void {
  const mismatches = result.warnings.filter((w) =>
    /hydrat|did not match|mismatch|server render/i.test(w),
  )
  expect(mismatches, `hydration warnings:\n${mismatches.join('\n')}`).toEqual([])
  expect(canonical(result.after)).toBe(canonical(result.before))
}

/** Render into a detached container for client-only assertions. */
export async function client(element: ReactElement): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  await act(async () => {
    hydrateRoot(container, element)
  })
  return container
}
