import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Negative controls: every gate is fed something it must reject.
 *
 * A gate that has never been observed failing is not known to be a gate. This
 * suite is the difference between "CI is green" and "CI would go red if the
 * rule were broken" — and it also asserts the failure text names the rule,
 * which FR-016 requires and which a generic "job failed" does not satisfy.
 */

const root = join(import.meta.dirname, '..', '..')

function runExpectingFailure(command: string, args: string[], cwd = root): string {
  try {
    execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
    return '' // exited 0 — the gate did not fire
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string }
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

/**
 * The boundary is enforced by two tools, deliberately.
 *
 * Under pnpm's isolated node_modules, `react` is unresolvable from
 * packages/core, so dependency-cruiser records no edge at all and a graph rule
 * cannot see the violation. ESLint's no-restricted-imports works on syntax and
 * sees it regardless. dependency-cruiser keeps the rules it is uniquely good
 * at — cycles and cross-package direction, which DO resolve via workspace
 * links. Each test below exercises the tool that actually owns its case.
 */
describe('gate: core/UI boundary (eslint, syntactic)', () => {
  it('rejects a UI framework import from core, naming the rule', () => {
    const probe = join(root, 'packages/core/src/__gate_probe__.ts')
    try {
      writeFileSync(probe, "import { useState } from 'react'\nexport const probe = useState\n")
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/core/src'])
      expect(output).not.toBe('')
      expect(output).toContain('no-ui-in-core')
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('rejects an adapter import from core, naming the rule', () => {
    const probe = join(root, 'packages/core/src/__gate_probe__.ts')
    try {
      writeFileSync(probe, "import '@cuestack/react'\nexport const probe = 1\n")
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/core/src'])
      expect(output).toContain('no-adapters-in-core')
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

describe('gate: package direction (dependency-cruiser, graph)', () => {
  it('rejects an adapter import from schema, naming the rule', () => {
    const probe = join(root, 'packages/schema/src/__gate_probe__.ts')
    try {
      writeFileSync(probe, "import '@cuestack/react'\nexport const probe = 1\n")
      const output = runExpectingFailure('pnpm', [
        'exec',
        'depcruise',
        'packages',
        '--config',
        '.dependency-cruiser.cjs',
      ])
      expect(output).toContain('no-core-in-schema')
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

describe('gate: determinism lint', () => {
  it('rejects a clock read inside the schema package', () => {
    const probe = join(root, 'packages/schema/src/__gate_probe__.ts')
    try {
      writeFileSync(probe, 'export const stamp = Date.now()\n')
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/schema/src'])
      expect(output).toMatch(/no-restricted-properties|deterministic/i)
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

describe('gate: typecheck', () => {
  it('rejects a type error', () => {
    const probe = join(root, 'packages/schema/src/__gate_probe__.ts')
    try {
      writeFileSync(probe, 'export const wrong: number = "not a number"\n')
      const output = runExpectingFailure('pnpm', ['exec', 'tsc', '--noEmit'], join(root, 'packages/schema'))
      expect(output).toContain('__gate_probe__')
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

describe('gate: data-model agreement', () => {
  it('reports drift when the doc and the schema disagree', () => {
    // Run against a deliberately-drifted copy, so the real spec is never touched.
    const sandbox = mkdtempSync(join(tmpdir(), 'cuestack-gate-'))
    try {
      const drifted = join(sandbox, 'data-model.md')
      const original = readFileSync(
        join(root, 'specs/001-framework-foundation/data-model.md'),
        'utf8',
      )
      // Flip `title` from required to optional. The schema still requires it.
      writeFileSync(
        drifted,
        original.replace('| `title` | string | **yes**', '| `title` | string | no'),
      )
      const output = runExpectingFailure('node', ['tools/scripts/check-data-model.mjs', drifted])
      expect(output).not.toBe('')
      expect(output).toContain('title')
      expect(output).toContain('disagree')
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })

  it('passes against the real repository', () => {
    const output = execFileSync('node', ['tools/scripts/check-data-model.mjs'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(output).toContain('ok')
  })
})

describe('gate: placeholders', () => {
  it('all four placeholder gates exit 0 and name the wave that arms them', () => {
    const output = execFileSync('node', ['tools/scripts/gates/run-all.mjs'], {
      cwd: root,
      encoding: 'utf8',
    })
    for (const gate of ['theme-values', 'parity', 'a11y', 'perf']) {
      expect(output).toContain(`gate:${gate}`)
    }
    expect(output).toMatch(/Wave 2/)
    expect(output).toMatch(/Wave 3/)
    expect(output).toMatch(/Wave 4/)
  })
})
