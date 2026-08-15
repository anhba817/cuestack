import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * FR-037: one stated rule, applied everywhere.
 *
 * Every other one-place rule in this repository is machine-enforced —
 * `no-switch-on-element-type`, `no-ui-in-core`, `no-theme-literals` — and feature 001 found
 * a boundary rule that was green while enforcing nothing. A rule kept by convention is a
 * rule until the first person in a hurry.
 *
 * What must not spread is the *decision*: comparing a reported media position against a
 * commanded one to work out which clock wins. Reading positions is fine and necessary; a
 * second place that compares them is a second policy, and two policies for "which clock is
 * right" is exactly what the bidirectional port makes possible.
 */

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src')
const RECONCILER = join(SRC, 'media', 'reconcile.ts')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sources(full)
    return /\.ts$/.test(full) ? [full] : []
  })
}

const strip = (body: string): string =>
  body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('the reconciliation rule lives in one module', () => {
  const files = sources(SRC).filter((f) => f !== RECONCILER)

  it('has sources to scan', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('is where the tolerance is applied', () => {
    // The constant may be *read* elsewhere — a renderer may want to display it — but the
    // comparison that decides authority belongs here.
    const body = strip(readFileSync(RECONCILER, 'utf8'))
    expect(body).toMatch(/MEDIA_SYNC_TOLERANCE_MS/)
    expect(body).toMatch(/Math\.abs/)
  })

  it('is the only module comparing a reported position against a commanded one', () => {
    const offenders = files.filter((file) => {
      const body = strip(readFileSync(file, 'utf8'))
      return /Math\.abs\s*\([^)]*(?:reported|commanded)/i.test(body)
    })
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })

  it('is the only module applying the tolerance to a difference', () => {
    const offenders = files.filter((file) => {
      const body = strip(readFileSync(file, 'utf8'))
      return /MEDIA_SYNC_TOLERANCE_MS/.test(body) && /[<>]=?/.test(body)
    })
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })
})
