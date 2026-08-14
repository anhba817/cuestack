import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
export const fixturesDir = join(here, '..', 'fixtures')

export function loadFixture(rel: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, rel), 'utf8'))
}

export function reference(): Record<string, any> {
  return loadFixture('valid/reference.json') as Record<string, any>
}

export function invalidFixtureNames(): string[] {
  return readdirSync(join(fixturesDir, 'invalid'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
}

/** `timing-end-before-start` -> `TIMING_END_BEFORE_START` */
export function codeFromFixtureName(name: string): string {
  return name.replace(/-/g, '_').toUpperCase()
}

/** Deep clone so a mutation in one test cannot leak into another. */
export function withReference(mutate: (m: any) => void): unknown {
  const m = reference()
  mutate(m)
  return m
}
