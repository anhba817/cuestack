import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * FR-003 / SC-009: the kernel must run with no DOM.
 *
 * A source-level check rather than a runtime one, because a reference guarded
 * behind `typeof window !== 'undefined'` would pass at runtime in Node while
 * still making the package depend on a browser it claims not to need.
 */
const FORBIDDEN = ['window', 'document', 'performance', 'requestAnimationFrame', 'localStorage']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return full.endsWith('.ts') ? [full] : []
  })
}

describe('the kernel is headless', () => {
  const root = new URL('../src', import.meta.url).pathname
  const files = sourceFiles(root)

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(FORBIDDEN)('never references %s', (name) => {
    const pattern = new RegExp(`(^|[^.\\w"'\`])${name}\\b`)
    const offenders = files.filter((file) => {
      const body = readFileSync(file, 'utf8')
        // strip comments: a doc comment may legitimately discuss the DOM
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
      return pattern.test(body)
    })
    expect(offenders.map((f) => f.replace(root, 'src'))).toEqual([])
  })
})
