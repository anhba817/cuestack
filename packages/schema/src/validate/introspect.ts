import { lessonManifestSchema } from './lesson.js'

/**
 * Walks the schema definition itself so SC-009's first clause can be checked
 * automatically: "no field in the format can hold a learner identifier or an
 * author credential, demonstrated by an automated check over the format
 * definition itself."
 *
 * This is deliberately structural rather than a review convention. A schema
 * that legitimately declared `ownerId` would pass every injection test and
 * still violate the invariant — only reading the definition catches it.
 */

export interface FormatField {
  /** Dotted path from the manifest root, e.g. `slides[].elements[].startMs`. */
  path: string
  /** The leaf key name. */
  name: string
  kind: string
  /** True when the field may be absent. Read before unwrapping. */
  optional: boolean
}

interface ZodInternal {
  _zod?: { def?: Record<string, unknown> }
}

function def(schema: unknown): Record<string, unknown> | undefined {
  return (schema as ZodInternal)?._zod?.def
}

function kindOf(schema: unknown): string {
  const type = def(schema)?.['type']
  return typeof type === 'string' ? type : 'unknown'
}

/** Strip wrappers (optional, nullable, default, catch, readonly, pipe). */
function unwrap(schema: unknown): unknown {
  const seen = new Set<unknown>()
  let current = schema
  while (current && !seen.has(current)) {
    seen.add(current)
    const d = def(current)
    const type = d?.['type']
    if (
      type === 'optional' ||
      type === 'nullable' ||
      type === 'default' ||
      type === 'prefault' ||
      type === 'catch' ||
      type === 'readonly' ||
      type === 'nonoptional'
    ) {
      current = d?.['innerType']
      continue
    }
    /* v8 ignore start -- the walker handles Zod constructs the current schema
       does not use (pipe, transform chains). Removing them would make the
       checker silently blind the first time someone reaches for one. */
    if (type === 'pipe') {
      current = d?.['out'] ?? d?.['in']
      continue
    }
    /* v8 ignore stop */
    break
  }
  return current
}

/** Optionality has to be read before unwrap(), which strips the wrapper. */
function isOptional(schema: unknown): boolean {
  const type = def(schema)?.['type']
  return type === 'optional' || type === 'default' || type === 'prefault' || type === 'nullable'
}

const SCALAR_TYPES = new Set(['string', 'number', 'int', 'boolean', 'literal', 'enum', 'bigint'])

/** A scalar, or a union whose every branch is one. Both are leaves. */
function isScalar(schema: unknown, depth = 0): boolean {
  /* v8 ignore next -- recursion guard */
  if (depth > 4) return false
  const type = kindOf(schema)
  if (SCALAR_TYPES.has(type)) return true
  if (type === 'union') {
    const options = (def(schema)?.['options'] as unknown[]) ?? []
    return options.length > 0 && options.every((o) => isScalar(unwrap(o), depth + 1))
  }
  return false
}

function walk(schema: unknown, path: string, out: FormatField[], depth: number): void {
  /* v8 ignore next -- recursion guard; the format is far shallower than 12 */
  if (depth > 12) return
  const inner = unwrap(schema)
  const d = def(inner)
  const type = kindOf(inner)

  if (type === 'object') {
    const shape = d?.['shape'] as Record<string, unknown> | undefined
    /* v8 ignore next -- a zod object always carries a shape */
    if (!shape) return
    for (const [key, child] of Object.entries(shape)) {
      const childPath = path ? `${path}.${key}` : key
      out.push({
        path: childPath,
        name: key,
        kind: kindOf(unwrap(child)),
        optional: isOptional(child),
      })
      walk(child, childPath, out, depth + 1)
    }
    return
  }

  if (type === 'array') {
    walk(d?.['element'], `${path}[]`, out, depth + 1)
    return
  }

  if (type === 'union') {
    const options = (d?.['options'] as unknown[]) ?? []
    for (const option of options) walk(option, path, out, depth + 1)
    return
  }

  if (type === 'record') {
    // A record is fine as long as its values are scalars — the concern is a
    // container that could nest arbitrary structure and hide identity inside
    // it. A union of primitives is still a scalar leaf, so it is constrained.
    /* v8 ignore next -- no unconstrained record exists in the format today;
       this is the detector that keeps it that way, so it must outlive its
       first true finding */
    if (!isScalar(unwrap(d?.['valueType']))) {
      out.push({
        path: `${path}{}`,
        name: path.split('.').pop() ?? path,
        kind: 'unconstrained-record',
        optional: false,
      })
    }
    return
  }
}

/** Deduplicated because union branches share most of their fields. */
export function describeFormat(): FormatField[] {
  const collected: FormatField[] = []
  walk(lessonManifestSchema, '', collected, 0)
  const seen = new Set<string>()
  return collected.filter((field) => {
    const key = `${field.path}:${field.kind}:${field.optional}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
