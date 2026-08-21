#!/usr/bin/env node
/**
 * Every fenced code block in the guide is extracted from a real file, not typed by hand.
 *
 * This exists because prose has already failed here. `ElementEditor`'s header explained that "the
 * seven built-in types have no `ElementPlugin`" and that "core's plugin registry is empty by
 * default" — feature 009 made both false, two features shipped, and nobody noticed. A code comment's
 * audience can tell when it is wrong; a guide's audience is by definition the people who cannot.
 *
 * A block declares its source as `<!-- from: path#region -->` immediately above the fence. The file
 * marks the region with `// #region name` and `// #endregion name`. A mismatch, a missing file, or a
 * missing region all fail — the third mattering most, because a snippet pointing at a deleted region
 * would otherwise pass by finding nothing.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Trailing whitespace and a trailing newline are not drift worth failing a build over. */
const normalise = (text) => text.replace(/[ \t]+$/gm, '').replace(/\n+$/, '')

export function regionOf(source, region) {
  const start = source.indexOf(`#region ${region}`)
  const end = source.indexOf(`#endregion ${region}`)
  if (start < 0 || end < 0 || end < start) return null

  const body = source.slice(source.indexOf('\n', start) + 1, source.lastIndexOf('\n', end))
  const lines = body.split('\n')
  // Regions are usually indented inside something; strip the common indent so a block reads as code
  // rather than as code that has been shoved right.
  const indents = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length)
  const shift = indents.length ? Math.min(...indents) : 0
  return normalise(lines.map((l) => l.slice(shift)).join('\n'))
}

export function checkDocument(markdown, readFile) {
  const problems = []
  const pattern = /<!--\s*from:\s*(\S+?)#(\S+?)\s*-->\s*\n```[a-z]*\n([\s\S]*?)```/g

  let match
  let found = 0
  while ((match = pattern.exec(markdown)) !== null) {
    found += 1
    const [, path, region, quoted] = match
    const source = readFile(path)
    if (source === null) {
      problems.push(`${path}#${region}: the file does not exist`)
      continue
    }
    const actual = regionOf(source, region)
    if (actual === null) {
      problems.push(`${path}#${region}: the region does not exist in that file`)
      continue
    }
    if (actual !== normalise(quoted)) {
      problems.push(`${path}#${region}: the guide and the source have drifted apart`)
    }
  }
  return { found, problems }
}

/* v8 ignore start -- the CLI wrapper; `checkDocument` is what the suite exercises */
if (import.meta.url === `file://${process.argv[1]}`) {
  const docsDir = join(root, 'docs')
  const docs = existsSync(docsDir)
    ? readdirSync(docsDir).filter((f) => f.endsWith('.md'))
    : []

  let total = 0
  const problems = []
  for (const name of docs) {
    const { found, problems: found_ } = checkDocument(
      readFileSync(join(docsDir, name), 'utf8'),
      (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null),
    )
    total += found
    problems.push(...found_.map((p) => `docs/${name}: ${p}`))
  }

  if (problems.length > 0) {
    console.error('check-doc-snippets: the documentation and the code have drifted.\n')
    for (const p of problems) console.error(`  - ${p}`)
    console.error(
      '\nEvery fenced block naming a source must match it. This check exists because a guide is\n' +
        'read by people who cannot tell it is wrong.',
    )
    process.exit(1)
  }
  console.log(`check-doc-snippets: ok — ${total} quoted block(s) match their source.`)
}
/* v8 ignore stop */
