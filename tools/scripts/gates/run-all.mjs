#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const gates = readdirSync(here).filter((f) => f.endsWith('.mjs') && f !== 'run-all.mjs')

let failed = false
for (const gate of gates.sort()) {
  try {
    const out = execFileSync('node', [join(here, gate)], { encoding: 'utf8' })
    process.stdout.write(out)
  } catch (error) {
    console.error(`gate ${gate} FAILED`)
    console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
