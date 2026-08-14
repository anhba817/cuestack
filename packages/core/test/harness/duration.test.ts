import { describe, expect, it } from 'vitest'

/**
 * SC-006: the timing suite runs in under 5 seconds, which only holds while nothing
 * waits in real time.
 *
 * Asserted here as a property of the harness rather than measured externally: the
 * synthetic clock is what makes it true, so the meaningful check is that no test
 * has quietly started using a real timer.
 */
describe('the timing suite does not wait', () => {
  it('the synthetic clock advances only when told to', async () => {
    const { createSyntheticClock } = await import('./clock.js')
    const clock = createSyntheticClock()
    const before = clock()
    await new Promise((r) => setTimeout(r, 20)) // real time passes
    expect(clock()).toBe(before) // lesson time does not
  })

  it('no test file references a real delay', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = new URL('..', import.meta.url).pathname
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const f = join(dir, n)
        return statSync(f).isDirectory() ? walk(f) : f.endsWith('.test.ts') ? [f] : []
      })
    const offenders = walk(root).filter((file) => {
      if (file.endsWith('duration.test.ts')) return false // this file's own probe
      const body = readFileSync(file, 'utf8')
      return /setTimeout|setInterval|vi\.advanceTimersByTime|await new Promise/.test(body)
    })
    expect(offenders.map((f) => f.replace(root, ''))).toEqual([])
  })
})
