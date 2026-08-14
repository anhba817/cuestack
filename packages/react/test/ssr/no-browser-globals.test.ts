import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * SC-013 / FR-004 / FR-009.
 *
 * The check most worth having in this feature. Measuring a container in order to
 * scale it is the *obvious* way to solve scaling, and doing so silently destroys the
 * server-rendered first frame — the server would emit a layout for a viewport it
 * cannot know, and the browser would correct it on first paint.
 *
 * Scanned at the source level so a reference guarded behind a runtime check still
 * fails: the point is that the module does not depend on a browser, not that it
 * avoids crashing in one's absence.
 */
const SERVER_PATH_FORBIDDEN = [
  'window',
  'document',
  'matchMedia',
  'getBoundingClientRect',
  'offsetWidth',
  'offsetHeight',
  'ResizeObserver',
  'requestAnimationFrame',
  'localStorage',
]

/** Modules the server render path reaches. `frame/` is client-only by design and is
 *  reached from the client entry alone. */
const SERVER_MODULES = ['player/Stage.tsx', 'player/SlideView.tsx', 'player/ElementFrame.tsx',
  'theme/tokens.ts', 'frame/properties.ts', 'frame/applyVisual.ts', 'elements', 'server.ts']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

function strip(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('the server render path touches no browser API', () => {
  // fileURLToPath, not new URL(...).pathname: happy-dom shims URL differently from
  // the node environment, and the pathname form silently resolves to '/src'.
  const root = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src')
  const files = sourceFiles(root).filter((f) =>
    SERVER_MODULES.some((m) => f.includes(m.replace('/', '/'))),
  )

  it('has server-path files to check', () => {
    expect(files.length).toBeGreaterThan(4)
  })

  it.each(SERVER_PATH_FORBIDDEN)('never references %s', (name) => {
    const pattern = new RegExp(`(^|[^.\\w"'\`])${name}\\b`)
    const offenders = files.filter((file) => pattern.test(strip(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => f.replace(root, 'src'))).toEqual([])
  })

  it('reads no clock', () => {
    const offenders = files.filter((file) =>
      /Date\.now|new Date\(|performance\.now/.test(strip(readFileSync(file, 'utf8'))),
    )
    expect(offenders.map((f) => f.replace(root, 'src'))).toEqual([])
  })
})
