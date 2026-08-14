#!/usr/bin/env node
/**
 * Asserts the Zod schemas agree with the field tables in data-model.md.
 *
 * Two artifacts describe required-vs-optional: the schemas (which the code
 * obeys) and data-model.md (which a reviewer reads). The product spec §27 lists
 * "key fields" without marking optionality, so that inference had to be recorded
 * somewhere reviewable — but two records can drift, and a drifted design doc is
 * worse than none. This check is what makes them one source in practice.
 *
 * It lives in tools/ rather than in the package: a published package must never
 * depend on the specs directory, which does not ship.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Overridable so the gate's own negative-control test can point it at a
// deliberately-drifted copy without touching the real spec.
const docPath = process.argv[2] ?? join(root, 'specs/001-framework-foundation/data-model.md')

const distEntry = join(root, 'packages/schema/dist/validate/index.js')
if (!existsSync(distEntry)) {
  console.error('check-data-model: @cuestack/schema is not built. Run `pnpm build` first.')
  process.exit(1)
}
const { describeFormat } = await import(distEntry)

/**
 * Structures data-model.md covers in prose rather than a field table: the
 * discriminated-union variants and the style token bag. Their sub-fields are
 * described where the union is explained, so a per-field table row would
 * duplicate rather than clarify.
 *
 * This list is the honest boundary of what the check can verify. Anything not
 * here must appear in a table.
 */
const DOCUMENTED_IN_PROSE = new Set([
  // Background variants
  'kind', 'color', 'from', 'to', 'angle', 'fit',
  // Advance variants
  'mode', 'mediaElementId', 'interactionElementId',
  // Transition
  'type',
  // ElementStyle token bag
  'fill', 'stroke', 'strokeWidth', 'fontSize', 'fontFamily', 'fontWeight',
  'align', 'opacity', 'radius',
  // Accessibility bags
  'label', 'announce', 'altText',
  // Interaction option
  'url', 'poster',
])

/**
 * Parse the markdown field tables.
 *
 * Two wrinkles the naive version got wrong: a type cell may contain escaped
 * pipes (`"16:9" \| "4:3"`), and one row may name several fields at once
 * (`` `x`, `y`, `width`, `height` ``).
 */
const PIPE_SENTINEL = '\uE000'

function parseDocFields(markdown) {
  const required = new Map()
  /** Every backticked identifier appearing in any table cell. */
  const mentioned = new Set()
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line
      // Escaped pipes inside a cell (`"16:9" \| "4:3"`) must survive the split.
      .replace(/\\\|/g, PIPE_SENTINEL)
      .split('|')
      .map((c) => c.split(PIPE_SENTINEL).join('|').trim())
    if (cells.length < 4) continue
    for (const m of line.matchAll(/`([A-Za-z0-9_]+)`/g)) mentioned.add(m[1])
    if (cells.length < 5) continue

    const nameCell = cells[1]
    const requiredCell = cells[3].replace(/\*/g, '').trim().toLowerCase()
    if (!['yes', 'no', 'conditional'].includes(requiredCell)) continue

    const names = [...nameCell.matchAll(/`([A-Za-z0-9_]+)`/g)].map((m) => m[1])
    if (names.length === 0) continue

    // "conditional" means required for some element types — the schema models
    // it as optional and enforces it referentially, so treat it as optional.
    const isRequired = requiredCell === 'yes'
    for (const name of names) {
      required.set(name, (required.get(name) ?? false) || isRequired)
    }
  }
  return { required, mentioned }
}

const { required: doc, mentioned } = parseDocFields(readFileSync(docPath, 'utf8'))
const schemaFields = describeFormat()

// A name may appear in several entity tables; required in any of them means the
// schema must make it required somewhere.
const schemaRequiredByName = new Map()
for (const field of schemaFields) {
  const prior = schemaRequiredByName.get(field.name)
  schemaRequiredByName.set(field.name, prior === true ? true : !field.optional)
}

const problems = []

for (const [name, docRequired] of doc) {
  if (!schemaRequiredByName.has(name)) {
    problems.push(`data-model.md documents "${name}" but no schema defines it`)
    continue
  }
  const schemaRequired = schemaRequiredByName.get(name)
  if (docRequired && !schemaRequired) {
    problems.push(`"${name}" is required in data-model.md but optional in the schema`)
  }
  if (!docRequired && schemaRequired) {
    problems.push(`"${name}" is optional in data-model.md but required in the schema`)
  }
}

for (const [name] of schemaRequiredByName) {
  if (!mentioned.has(name) && !DOCUMENTED_IN_PROSE.has(name)) {
    problems.push(`schema defines "${name}" but data-model.md never mentions it`)
  }
}

if (problems.length > 0) {
  console.error('check-data-model: the schemas and data-model.md disagree.\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(
    '\nFix whichever is wrong. Both describe the same decision, so they cannot differ.',
  )
  process.exit(1)
}

console.log(
  `check-data-model: ok — ${doc.size} tabled fields agree with the schema ` +
    `(${DOCUMENTED_IN_PROSE.size} further fields documented in prose)`,
)
