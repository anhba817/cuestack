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

/** Assert hydration was clean — both halves, because either alone is insufficient. */
export function expectCleanHydration(result: { before: string; after: string; warnings: string[] }): void {
  const mismatches = result.warnings.filter((w) =>
    /hydrat|did not match|mismatch|server render/i.test(w),
  )
  expect(mismatches, `hydration warnings:\n${mismatches.join('\n')}`).toEqual([])
  expect(result.after).toBe(result.before)
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
