#!/usr/bin/env node
/**
 * FR-049 / SC-015: a learner's player payload contains no editor code.
 *
 * The dependency-cruiser rule `no-studio-in-player` proves nothing under
 * `packages/{react,core,schema}/src` *imports* `@cuestack/studio`. This proves the
 * stronger, consumer-facing claim, and it proves it by **absence**: pack the player and
 * its dependencies, install them into an empty directory with `@cuestack/studio` nowhere
 * on disk, and render a lesson. A player that renders when the editor does not exist
 * cannot be shipping it.
 *
 * The same argument and the same technique as `check-core-isolation.mjs`, which proves
 * `@cuestack/core` needs no UI framework by installing it where none exists. Bundle-size
 * assertions were the alternative and are weaker: they measure a bundler's output for one
 * configuration, whereas this measures what the package actually needs.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sandbox = mkdtempSync(join(tmpdir(), 'cuestack-studio-isolation-'))

try {
  // The player's full workspace closure, and deliberately not studio. If the player needs
  // studio for anything, resolution fails here — which is the whole point.
  console.log('packing @cuestack/react and its workspace dependencies …')
  for (const pkg of ['schema', 'core', 'react']) {
    execFileSync('pnpm', ['pack', '--pack-destination', sandbox], {
      cwd: join(root, 'packages', pkg),
      stdio: 'pipe',
    })
  }

  const tarballs = readdirSync(sandbox).filter((f) => f.endsWith('.tgz'))
  if (tarballs.length !== 3) {
    throw new Error(`expected three tarballs, got ${tarballs.length}: ${tarballs.join(', ')}`)
  }
  if (tarballs.some((t) => t.includes('studio'))) {
    throw new Error('a studio tarball reached the sandbox; this check must run without one')
  }

  writeFileSync(
    join(sandbox, 'package.json'),
    JSON.stringify({ name: 'studio-isolation-probe', private: true, type: 'module' }, null, 2),
  )

  console.log('installing the player into a bare directory with no editor present …')
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      ...tarballs.map((t) => `./${t}`),
      'react@19',
      'react-dom@19',
    ],
    { cwd: sandbox, stdio: 'pipe' },
  )

  const installed = readdirSync(join(sandbox, 'node_modules'))
  const editor = installed.filter((n) => n === 'studio')
  if (editor.length > 0) {
    throw new Error('@cuestack/studio was installed; the player must not depend on it')
  }
  const scoped = readdirSync(join(sandbox, 'node_modules', '@cuestack'))
  if (scoped.includes('studio')) {
    throw new Error('@cuestack/studio was installed; the player must not depend on it')
  }

  // Render, rather than merely import. An exports-map mistake resolves and then produces
  // nothing; feature 003 shipped a static player that could not render a slide with an
  // element on it and built cleanly for two waves.
  writeFileSync(
    join(sandbox, 'probe.mjs'),
    [
      "import { renderToStaticMarkup } from 'react-dom/server'",
      "import { createElement } from 'react'",
      "import { LessonPlayerStatic } from '@cuestack/react'",
      '',
      'const lesson = {',
      "  schemaVersion: '1.0',",
      "  lesson: { id: 'l', title: 'Isolation probe', aspectRatio: '16:9', language: 'en' },",
      '  slides: [',
      '    {',
      "      id: 's1',",
      '      durationMs: 1000,',
      "      advance: { mode: 'after_duration' },",
      '      elements: [',
      '        {',
      "          id: 'e1', type: 'text', x: 100, y: 100, width: 400, height: 100,",
      "          zIndex: 0, startMs: 0, endMs: 1000, payload: { text: 'rendered without the editor' },",
      '        },',
      '      ],',
      '    },',
      '  ],',
      '}',
      '',
      'const html = renderToStaticMarkup(createElement(LessonPlayerStatic, { lesson }))',
      "if (!html.includes('rendered without the editor')) {",
      "  console.error('the player rendered no element content'); process.exit(1)",
      '}',
      "console.log('rendered a slide with @cuestack/studio absent from disk')",
    ].join('\n'),
  )

  const output = execFileSync('node', ['probe.mjs'], {
    cwd: sandbox,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  process.stdout.write(`  ${output.trim()}\n`)
  console.log('check-studio-isolation: ok — the player needs no editor code to render a lesson')
} catch (error) {
  console.error('check-studio-isolation: FAILED')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`)
  process.exit(1)
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}
