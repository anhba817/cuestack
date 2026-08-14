import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement as h } from 'react'
import { LessonPlayer } from '../../src/server.js'
import { element, lessonOf, referenceLesson, slide } from '../harness/corpus.js'

/**
 * FR-001 / FR-004. The server entry must render with no browser present.
 *
 * The globals are deleted rather than merely unused, because a component guarded by
 * `typeof window !== 'undefined'` would pass an unguarded test while still depending
 * on a browser it claims not to need.
 */
const visibleAtZero = lessonOf([
  slide([element({ id: 'title', startMs: 0, endMs: 8000, effects: [], payload: { text: 'Workplace Safety' } })]),
])

describe('rendering with no DOM', () => {
  function withoutBrowserGlobals<T>(fn: () => T): T {
    const g = globalThis as Record<string, unknown>
    const saved = {
      window: g['window'],
      document: g['document'],
      navigator: g['navigator'],
      matchMedia: g['matchMedia'],
      requestAnimationFrame: g['requestAnimationFrame'],
    }
    for (const key of Object.keys(saved)) delete g[key]
    try {
      return fn()
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value !== undefined) g[key] = value
      }
    }
  }

  it('renders a lesson with window and document deleted', () => {
    const html = withoutBrowserGlobals(() =>
      renderToString(h(LessonPlayer, { lesson: visibleAtZero })),
    )
    expect(html).toContain('Workplace Safety')
  })

  it('produces identical markup with and without the globals present', () => {
    const withGlobals = renderToString(h(LessonPlayer, { lesson: referenceLesson }))
    const without = withoutBrowserGlobals(() =>
      renderToString(h(LessonPlayer, { lesson: referenceLesson })),
    )
    expect(without).toBe(withGlobals)
  })
})
