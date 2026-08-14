import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The server path uses no hooks and no refs.
 *
 * **This is the test that was missing.** A React Server Component may not call a hook or
 * carry a `ref`, and `ElementFrame` did both — so the static player could not render a
 * slide with any elements on it. It shipped anyway, hidden twice:
 *
 *  - `renderToString` is ordinary SSR, not RSC. Hooks work there, so every assertion in
 *    `test/ssr/` passed against a component that no Server Component could use.
 *  - The reference lesson's first slide is empty at time zero, its title fading in at
 *    500 ms. The example app therefore rendered zero element wrappers and built cleanly.
 *
 * Two independent reasons the real constraint was invisible, which is why this check reads
 * the source. Building the example is the end-to-end proof and it is one page: it can only
 * catch what that page happens to render.
 */

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src')

/**
 * Every module reachable from `server.ts`, walked rather than listed.
 *
 * The first version of this test carried a hand-written list, and the graph walk that was
 * meant to *check* the list immediately found nine modules missing from it — the seven
 * element renderers and two more. Four hand-maintained lists in this repository have
 * drifted, two of them while being corrected, so the list is gone and only the walk remains.
 */
function serverPathFiles(): string[] {
  const reached = new Set<string>()
  const walk = (file: string): void => {
    if (reached.has(file)) return
    reached.add(file)
    for (const match of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
      const spec = match[1]!.replace(/\.js$/, '')
      for (const candidate of [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`]) {
        const resolved = join(dirname(file), candidate)
        try {
          if (statSync(resolved).isFile()) {
            walk(resolved)
            break
          }
        } catch {
          // Not this extension; try the next.
        }
      }
    }
  }
  walk(join(SRC, 'server.ts'))
  return [...reached]
}

const HOOKS = [
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useRef',
  'useCallback',
  'useMemo',
  'useReducer',
  'useContext',
  'useSyncExternalStore',
  'useTransition',
  'useId',
  'createContext',
]

const strip = (body: string): string =>
  body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('nothing on the server path can fail as a Server Component', () => {
  const files = serverPathFiles()

  it('reaches the modules a server render actually uses', () => {
    // A walk that resolved nothing would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(12)
    const names = files.map((f) => f.replace(`${SRC}/`, ''))
    expect(names).toContain('player/ElementFrame.tsx')
    expect(names).toContain('elements/builtin/QuestionElement.tsx')
    // And must not reach the client player, which is full of hooks by design.
    expect(names).not.toContain('player/LessonPlayerClient.tsx')
  })

  it.each(HOOKS)('never calls %s', (hook) => {
    const pattern = new RegExp(`\\b${hook}\\s*[(<]`)
    const offenders = files.filter((file) => pattern.test(strip(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })

  it('imports no hook, even unused', () => {
    const offenders = files.filter((file) => {
      const source = strip(readFileSync(file, 'utf8'))
      return HOOKS.some((hook) => new RegExp(`\\b${hook}\\b`).test(source))
    })
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })

  it('passes a ref only when a frame writer is present', () => {
    // A ref prop on a Server Component is an error even when its value is undefined, so the
    // prop has to be omitted rather than passed empty. That is why the wrapper spreads it.
    const frame = strip(readFileSync(join(SRC, 'player/ElementFrame.tsx'), 'utf8'))
    expect(frame).not.toMatch(/^\s*ref=/m)
    expect(frame).toMatch(/writer\s*\?\s*\{\s*ref:/)
  })

  it('declares no "use client" on the server path', () => {
    const offenders = files.filter((file) => /['"]use client['"]/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })
})
