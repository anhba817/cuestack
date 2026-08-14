import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * FR-009 · SC-004.
 *
 * Nothing in the package measures anything. The server-path scan in
 * `ssr/no-browser-globals.test.ts` covers the modules a server render reaches; this
 * one covers *all* of `src`, because a measurement on the client path is a different
 * defect with the same cause.
 *
 * That defect is layout shift. A `ResizeObserver` recomputing geometry after first
 * paint gives a correct final layout arrived at by moving things, and SC-004 requires
 * that nothing move. The rule is not "don't measure on the server" — it is that there
 * is nothing to measure, because the stylesheet does the scaling.
 */
const MEASUREMENT = [
  'getBoundingClientRect',
  'getClientRects',
  'offsetWidth',
  'offsetHeight',
  'offsetLeft',
  'offsetTop',
  'clientWidth',
  'clientHeight',
  'scrollWidth',
  'scrollHeight',
  'ResizeObserver',
  'getComputedStyle',
  'innerWidth',
  'innerHeight',
  'devicePixelRatio',
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

const strip = (body: string): string =>
  body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('nothing in the package measures the page', () => {
  const root = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src')
  const files = sourceFiles(root)

  it('found the sources to scan', () => {
    // Feature 001 shipped a boundary check that was green because it was inspecting
    // nothing. A scan asserting an empty result must first prove it has input.
    expect(files.length).toBeGreaterThan(10)
    expect(files.some((f) => f.includes('player'))).toBe(true)
    expect(files.some((f) => f.includes('frame'))).toBe(true)
  })

  it.each(MEASUREMENT)('never reads %s', (name) => {
    const pattern = new RegExp(`\\b${name}\\b`)
    const offenders = files.filter((file) => pattern.test(strip(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => f.replace(root, 'src'))).toEqual([])
  })

  it('has no scale factor computed in TypeScript', () => {
    // The rejected design, named so it stays rejected: a `transform: scale(k)` needs a
    // viewport the server does not have (stage.css header comment).
    const offenders = files.filter((file) => /scale\s*\(\s*(?:k|factor|ratio)\b/.test(strip(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => f.replace(root, 'src'))).toEqual([])
  })
})
