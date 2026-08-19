import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

describe('gate: no-switch-on-element-type', () => {
  it('rejects dispatching on a type discriminant inside resolution logic', () => {
    const probe = join(root, 'packages/core/src/resolve/__gate_probe__.ts')
    try {
      writeFileSync(
        probe,
        [
          'export function dispatch(element: { type: string }): number {',
          '  switch (element.type) {',
          "    case 'text': return 1",
          '    default: return 0',
          '  }',
          '}',
        ].join('\n'),
      )
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/core/src'])
      expect(output).not.toBe('')
      expect(output).toContain('no-switch-on-element-type')
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('permits it inside a registry, which is where dispatch belongs', () => {
    const probe = join(root, 'packages/core/src/elements/registry.ts')
    const original = readFileSync(probe, 'utf8')
    try {
      writeFileSync(
        probe,
        original +
          '\nexport function probeDispatch(e: { type: string }): number {\n' +
          '  switch (e.type) {\n    default: return 0\n  }\n}\n',
      )
      execFileSync('pnpm', ['exec', 'eslint', 'packages/core/src/elements/registry.ts'], {
        cwd: root,
        stdio: 'pipe',
      })
    } finally {
      writeFileSync(probe, original)
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

describe('gate: no clock in the editor', () => {
  /**
   * Feature 006 T003. The specification named two clocks as the failure mode to design
   * against, so the bound is a rule that fails a gate rather than a decision in a document.
   *
   * The second test is the one that matters. Feature 005's workspace-wide innerHTML ban
   * silently disarmed two narrower rules, because flat config *replaces* a rule's
   * configuration rather than merging it — and only a self-test found it. The clock rule is
   * a second block matching the same studio files, so it is the same hazard again: it uses
   * rule names the measurement block does not, and this asserts that choice held.
   */
  const probe = join(root, 'packages/studio/src/__gate_probe__.ts')

  it('rejects a clock read in the studio package, naming the rule', () => {
    try {
      writeFileSync(probe, 'export const stamp = Date.now()\n')
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/studio/src'])
      expect(output).not.toBe('')
      expect(output).toContain('no-clock-in-studio')
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('did not disarm the DOM-measurement ban it sits beside', () => {
    try {
      writeFileSync(probe, 'export const w = (n: Element) => n.getBoundingClientRect().width\n')
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/studio/src'])
      expect(output).not.toBe('')
      expect(output).toContain('dom-measurement-confined')
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

describe('gate: theme literals', () => {
  /**
   * The gate armed in T006, fed what it exists to reject.
   *
   * A hard-coded `#333` survives review and then survives every theme — it is the defect
   * that only appears when someone rebrands, by which point it is in twelve renderers.
   * Both the lint rule and the standalone gate are exercised, because they are separate
   * mechanisms and either could rot without the other noticing.
   */
  const probe = join(root, 'packages/react/src/elements/builtin/__gate_probe__.tsx')
  const withColour = [
    "import type { ReactNode } from 'react'",
    'export function Probe(): ReactNode {',
    "  return <div style={{ color: '#333' }} />",
    '}',
  ].join('\n')

  it('rejects a colour literal in a renderer, naming the rule', () => {
    try {
      writeFileSync(probe, withColour)
      const output = runExpectingFailure('pnpm', ['exec', 'eslint', 'packages/react/src'])
      expect(output).not.toBe('')
      expect(output).toContain('no-theme-literals')
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('is caught by the standalone gate even with lint disabled inline', () => {
    // The reason both exist. The gate delegates to ESLint so there is one definition of a
    // theme literal — and delegating meant inheriting ESLint's escape hatch, so an
    // `eslint-disable` above the colour silenced the gate too. This assertion is what found
    // that; the gate now runs with `--no-inline-config`.
    try {
      writeFileSync(probe, withColour.replace('return <div', '/* eslint-disable */\n  return <div'))
      const output = runExpectingFailure('node', ['tools/scripts/gates/theme-values.mjs'])
      expect(output).not.toBe('')
      expect(output).toMatch(/#333|theme/i)
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

describe('gate: accessibility', () => {
  /**
   * The gate armed in T007, fed a real WCAG violation.
   *
   * An image with no alternative text is the canonical case: invisible to anyone who can
   * see the screen, and the entire content to anyone who cannot. The probe adds a corpus
   * slide carrying one, so the axe suite the gate runs has something to find.
   *
   * This matters more than the usual negative control. `gates/a11y.mjs` exits 0 when it
   * finds no test files — correct behaviour for two features, and indistinguishable from a
   * pass. Nothing until now has established that the runner reports a violation rather
   * than merely running.
   */
  const probe = join(root, 'packages/react/test/a11y/__gate_probe__.test.ts')

  it('rejects an image with no accessible name', () => {
    try {
      writeFileSync(
        probe,
        [
          "import { createElement as h } from 'react'",
          "import { describe, expect, it } from 'vitest'",
          "import axe from 'axe-core'",
          "import { element, lessonOf, slide } from '../harness/corpus.js'",
          "import { client } from '../harness/render.js'",
          "import { LessonPlayer } from '../../src/index.js'",
          "import { testPorts } from '../harness/ports.js'",
          '',
          "describe('gate probe: an image with no alternative text', () => {",
          "  it('is reported by axe', async () => {",
          '    const lesson = lessonOf([',
          '      slide([',
          '        element({',
          "          id: 'probe_img',",
          "          type: 'image',",
          '          effects: [],',
          // No `accessibility`, and a resolver that makes it a real <img> with no name.
          "          payload: { asset: { assetId: 'https://example.test/a.png', mimeType: 'image/png' } },",
          '        }),',
          '      ]),',
          '    ])',
          '    const container = await client(',
          '      h(LessonPlayer, {',
          '        lesson,',
          '        ports: testPorts(),',
          '        resolveAsset: () => undefined,',
          '      }),',
          '    )',
          "    // Force the violation the gate must catch: strip the fallback's name.",
          "    container.querySelector('[role=\"img\"]')?.removeAttribute('aria-label')",
          '    const result = await axe.run(container, {',
          "      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },",
          "      rules: { 'color-contrast': { enabled: false } },",
          '    })',
          "    expect(result.violations.map((v) => v.id).join(',')).toBe('')",
          '  })',
          '})',
          '',
        ].join('\n'),
      )
      const output = runExpectingFailure('node', ['tools/scripts/gates/a11y.mjs'])
      expect(output).not.toBe('')
      expect(output).toContain('WCAG')
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('reports a pass differently from having nothing to check', () => {
    // The failure mode this guards: a gate that skips silently and reads as green. The two
    // outcomes must be distinguishable in the output, since one of them proves nothing.
    const out = execFileSync('node', ['tools/scripts/gates/a11y.mjs'], { cwd: root, encoding: 'utf8' })
    expect(out).toContain('ok')
    expect(out).not.toContain('nothing to check')
  })
})

describe('gate: playback performance', () => {
  /**
   * The one gate this wave arms, fed a frame that costs more than a frame.
   *
   * Written because feature 003 found the theme gate silenceable by an inline comment three
   * tasks after arming it — a gate nobody has watched fail is not known to be a gate. The
   * probe measures the same thing the real budget measures and does the same arithmetic; the
   * only difference is that its per-frame work deliberately takes 20 ms, which is more than
   * one 60 fps frame. If the gate stays green against that, the budget is decoration.
   *
   * A busy loop rather than a timer: the budget is about *work*, and an awaited delay would
   * measure the event loop instead. It is also the only way to be slow synchronously, which
   * is what a frame is.
   */
  const probe = join(root, 'packages/react/test/perf/__gate_probe__.test.ts')

  it('rejects a frame that costs more than one frame', () => {
    try {
      writeFileSync(
        probe,
        [
          "import { describe, expect, it } from 'vitest'",
          "import { resolve } from '@cuestack/core'",
          "import { heavy } from '../harness/heavy.js'",
          '',
          'const FRAME_BUDGET_MS = 16.7',
          '',
          'function median(samples: readonly number[]): number {',
          '  const sorted = [...samples].sort((a, b) => a - b)',
          '  return sorted[Math.floor(sorted.length / 2)]!',
          '}',
          '',
          "describe('gate probe: a frame that costs more than a frame', () => {",
          "  it('exceeds the frame budget', () => {",
          '    const slide = heavy().slides[0]!',
          '    const tick = (timeMs: number): number => {',
          '      const start = performance.now()',
          '      resolve(slide, timeMs)',
          '      while (performance.now() - start < 20) {',
          '        /* a frame that does 20ms of work, which is more than a frame */',
          '      }',
          '      return performance.now() - start',
          '    }',
          '    const samples = Array.from({ length: 5 }, (_, i) => tick(1000 + i * 41))',
          '    expect(median(samples)).toBeLessThan(FRAME_BUDGET_MS)',
          '  })',
          '})',
          '',
        ].join('\n'),
      )
      const output = runExpectingFailure('node', ['tools/scripts/gates/perf.mjs'])
      expect(output).not.toBe('')
      expect(output).toContain('Playback exceeded its frame or seek budget')
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('says what it does not measure, so a pass is not read as a full answer', () => {
    // The gate covers the player's own work and cannot cover paint — happy-dom has no
    // compositor. A green line that did not say so would be read as a frame-rate claim.
    const out = execFileSync('node', ['tools/scripts/gates/perf.mjs'], { cwd: root, encoding: 'utf8' })
    expect(out).toContain('NOT paint')
    expect(out).toMatch(/browser-based check is still required/)
  })
})

describe('gate: the editor’s timeline budgets', () => {
  /**
   * Feature 006 T098. The perf gate runs the whole `test/perf` directory of the studio
   * package, so the timeline's budgets are armed by being there — and this is what proves
   * "armed by being there" is true rather than assumed.
   *
   * A probe that costs more than the budget must turn the gate red. Without this, adding a
   * suite to that directory and having it silently excluded would look exactly like a pass.
   */
  const probe = join(root, 'packages/studio/test/perf/__gate_probe__.test.ts')

  it('rejects a timeline interaction that exceeds its budget', () => {
    try {
      writeFileSync(
        probe,
        [
          "import { describe, expect, it } from 'vitest'",
          '',
          "describe('gate probe: a seek that costs more than the budget', () => {",
          "  it('exceeds the interaction budget', () => {",
          '    const started = performance.now()',
          '    while (performance.now() - started < 200) {',
          '      // Busy-wait: 200 ms against a 90 ms budget.',
          '    }',
          '    expect(performance.now() - started).toBeLessThan(90)',
          '  })',
          '})',
          '',
        ].join('\n'),
      )
      const output = runExpectingFailure('node', ['tools/scripts/gates/perf.mjs'])
      expect(output).not.toBe('')
      expect(output).toMatch(/editor exceeded|interaction|seek|startup/i)
    } finally {
      rmSync(probe, { force: true })
    }
  })

  it('reports the dense slide it measured against, so a pass names its own fixture', () => {
    // R-09: the timeline is per-slide, and an even spread would let SC-012 pass while
    // measuring six tracks. A gate that did not say which slide it used could not be checked.
    const output = execFileSync('node', ['tools/scripts/gates/perf.mjs'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    expect(output).toMatch(/densest slide \(\d+ elements\)/)
  })
})

describe('gate: the four gates that began as placeholders', () => {
  /**
   * Three of the four are now armed — perf in feature 002, theme-values and a11y in
   * feature 003. This test tracks that transition deliberately: it asserted all four
   * were placeholders naming a future wave, and updating it as each one arms is how
   * the arming becomes visible rather than silent.
   */
  const output = () =>
    execFileSync('node', ['tools/scripts/gates/run-all.mjs'], { cwd: root, encoding: 'utf8' })

  it('all four run and exit 0', () => {
    const out = output()
    for (const gate of ['theme-values', 'parity', 'a11y', 'perf']) {
      expect(out).toContain(`gate:${gate}`)
    }
  })

  it('parity is armed, and names the suites it ran', () => {
    // Was a placeholder for three waves, with an honest reason each time — first no editor,
    // then no preview. Feature 007 supplied the second half. Asserting the suite names rather
    // than just "ok" is how a gate that quietly stopped running three of the four would be
    // caught: the output would look the same shape.
    const out = output()
    expect(out).toMatch(/gate:parity — ok/)
    for (const suite of ['overlay', 'geometry', 'state', 'renderers']) {
      expect(out).toContain(suite)
    }
  })

  it('perf is armed against both its budgets', () => {
    // Resolution since feature 002; playback since this wave. Asserting both is how the
    // second arming stays visible rather than being absorbed into a line that already passed.
    const out = output()
    expect(out).toMatch(/gate:perf — resolution budget met/)
    expect(out).toMatch(/gate:perf — playback budgets met/)
  })

  it('theme-values and a11y are armed, not placeholders', () => {
    const out = output()
    // They report "nothing to check" only while their subject matter is absent; the
    // word "placeholder" must be gone, because they now fail on real violations.
    expect(out).toMatch(/gate:theme-values —/)
    expect(out).toMatch(/gate:a11y —/)
    expect(out).not.toMatch(/gate:theme-values — placeholder/)
    expect(out).not.toMatch(/gate:a11y — placeholder/)
  })
})

describe('gate: parity', () => {
  /**
   * The gate armed in feature 007, fed what it exists to reject.
   *
   * **The divergence has to be about the lesson's *content*, not its affordances.** The two
   * renderer sets are *supposed* to differ — the interactive question carries a submit
   * control and a live region, the static one deliberately does not — so a probe that removed
   * the submit button would prove only that the gate notices a difference the framework
   * designed on purpose. What must never differ is the prompt and the options: the lesson's
   * own words. This probe changes one of them.
   *
   * Without this test, `gate:parity` would have gone from "prints a reason and exits 0" to
   * "runs four suites and exits 0", and nobody would know which of those it was doing.
   */
  const renderer = join(root, 'packages/react/src/elements/builtin/QuestionElementStatic.tsx')

  /** `--force`, because the input changed but Turbo's inputs hash may not have settled. */
  const rebuildReact = (): void => {
    execFileSync('pnpm', ['exec', 'turbo', 'run', 'build', '--filter', '@cuestack/react', '--force'], {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
    })
  }

  it('rejects a static renderer that changes what the question says', () => {
    const original = readFileSync(renderer, 'utf8')
    try {
      // The prompt, rendered from the payload, replaced by a constant. A learner would read
      // the authored question; an author would read this.
      const drifted = original.replace("{payload?.prompt ?? ''}", "{'A question'}")
      expect(drifted, 'the probe did not apply — the renderer has changed shape').not.toBe(original)
      writeFileSync(renderer, drifted)
      // The suites import `@cuestack/react` through its package entry, which resolves to
      // `dist` — so a probe that edited `src` and did not rebuild would prove nothing and
      // report a passing gate. A first draft did exactly that and looked like a working test.
      rebuildReact()

      const output = runExpectingFailure('node', ['tools/scripts/gates/parity.mjs'])
      expect(output).not.toBe('')
      expect(output).toContain('disagree')
    } finally {
      writeFileSync(renderer, original)
      rebuildReact()
    }
  })

  it('passes against the real repository, naming what it ran', () => {
    const output = execFileSync('node', ['tools/scripts/gates/parity.mjs'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(output).toContain('gate:parity — ok')
    // Named individually, because a gate that ran one suite and reported success would look
    // identical to one that ran four.
    for (const suite of ['overlay', 'geometry', 'state', 'renderers']) {
      expect(output).toContain(suite)
    }
  })
})

/**
 * The confirmations feature 008 removed, kept removed.
 *
 * SC-004 asks that no confirmation remain for an action a single reversal can take back. That
 * is a repository-wide property rather than a behaviour of any one component, so it is armed
 * here as a check rather than left as a habit — the three prompts feature 008 deleted each had
 * a comment saying they were temporary, and a fourth could arrive the same way.
 *
 * `readFileSync` over `execFileSync('grep')` on purpose: this has to fail with a message that
 * names what it found, and a grep's exit code says only that something matched.
 */
describe('gate: no confirmation stands in for undo', () => {
  const FORBIDDEN = [
    'DeleteConfirmation',
    'CustomConfirmation',
    'cs-effect-confirm',
    'cs-sequence-confirm',
    'data-cs-confirm',
  ]

  /**
   * Every source and test file in the editor, from the working tree.
   *
   * A filesystem walk rather than `git ls-files`: the index still lists a file that has been
   * deleted but not yet staged, and what this check is about is what is actually there.
   */
  function studioFiles(dir: string, found: string[] = []): string[] {
    for (const item of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${item.name}`
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.next') continue
        studioFiles(path, found)
      } else if (/\.(ts|tsx|css)$/.test(item.name)) {
        found.push(path)
      }
    }
    return found
  }

  const editorFiles = (): string[] => [
    ...studioFiles('packages/studio/src'),
    ...studioFiles('packages/studio/test'),
  ]

  it('finds no confirmation surface anywhere in the editor (SC-004)', () => {
    const offenders: string[] = []
    for (const file of editorFiles()) {
      const contents = readFileSync(join(root, file), 'utf8')
      for (const marker of FORBIDDEN) {
        // Prose is allowed: the code comments explaining *why* these were removed are the
        // record of the decision, and deleting them would lose it. Only a live reference is
        // a defect, so the marker must appear as an identifier or a class rather than in
        // running text.
        const live = new RegExp(`(<${marker}|from ['"].*${marker}|className=.*${marker}|\\.${marker}\\s*\\{|${marker}=)`)
        if (live.test(contents)) offenders.push(`${file}: ${marker}`)
      }
    }
    expect(offenders, `a confirmation surface is back: ${offenders.join(', ')}`).toEqual([])
  })

  it('and the components themselves are gone from disk', () => {
    const present = editorFiles()
    expect(present.some((f) => f.endsWith('DeleteConfirmation.tsx'))).toBe(false)
    expect(present.some((f) => f.endsWith('CustomConfirmation.tsx'))).toBe(false)
  })
})
