import type { $ZodIssue } from 'zod/v4/core'
import type { CustomIssueParams, IssueCode, IssueLocation, ValidationIssue } from './issues.js'

type Path = Array<string | number>

/** Enum-valued fields whose failure is an ordinary bad option, not an unknown type. */
const ENUM_FIELDS = new Set([
  'type',
  'aspectRatio',
  'phase',
  'mode',
  'kind',
  'interactionType',
  'completionPolicy',
  'shape',
  'action',
  'align',
  'fit',
])

const GEOMETRY_FIELDS = new Set(['x', 'y', 'width', 'height'])

function lastSegment(path: Path): string | undefined {
  const last = path[path.length - 1]
  return typeof last === 'string' ? last : undefined
}

/**
 * Read the offending value straight out of the input.
 *
 * Zod's messages describe what was *expected*, not what arrived — so "expected
 * one of appear|fade|..." never names the type the author actually wrote. The
 * spec requires an unknown type to be reported *naming it*, and a missing field
 * to be distinguishable from a wrong one, and both answers live in the input.
 */
function valueAtPath(input: unknown, path: Path): unknown {
  let current: unknown = input
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[segment]
  }
  return current
}

function describeValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object') return 'an object'
  return String(value)
}

function isUnder(path: Path, key: string): boolean {
  return path.includes(key)
}

/**
 * Resolve the human-navigable location from a raw path, reading ids back out of
 * the *input* document. FR-003 requires the caller to act on the location
 * without parsing the message, so ids come from the data rather than the text.
 */
export function resolveLocation(path: Path, input: unknown): IssueLocation {
  const location: IssueLocation = {}
  const field = lastSegment(path)
  if (field !== undefined && field !== 'slides' && field !== 'elements') location.field = field

  const slidesAt = path.indexOf('slides')
  if (slidesAt === -1) return location

  const slideIndex = path[slidesAt + 1]
  if (typeof slideIndex !== 'number') return location
  location.slideIndex = slideIndex

  const root = input as { slides?: Array<Record<string, unknown>> } | null | undefined
  const slide = root?.slides?.[slideIndex]
  if (slide && typeof slide['id'] === 'string') location.slideId = slide['id']

  const elementsAt = path.indexOf('elements', slidesAt)
  if (elementsAt === -1) return location

  const elementIndex = path[elementsAt + 1]
  if (typeof elementIndex !== 'number') return location
  location.elementIndex = elementIndex

  const elements = slide?.['elements'] as Array<Record<string, unknown>> | undefined
  const element = elements?.[elementIndex]
  if (element && typeof element['id'] === 'string') location.elementId = element['id']

  return location
}

interface Mapped {
  code: IssueCode
  rule?: string
}

/**
 * Zod's vocabulary is about shapes; ours is about the lesson format. This is the
 * one place the two meet, so a Zod upgrade changing an issue code cannot ripple
 * into the public contract.
 */
function classify(issue: $ZodIssue, path: Path, input: unknown): Mapped {
  const actual = valueAtPath(input, path)
  const field = lastSegment(path)
  const inEffects = isUnder(path, 'effects')
  const inElements = isUnder(path, 'elements')

  // A custom check carried its own code through params.
  if (issue.code === 'custom') {
    const params = (issue as { params?: CustomIssueParams }).params
    if (params?.code) return { code: params.code, ...(params.rule ? { rule: params.rule } : {}) }
    /* v8 ignore next -- every custom check here carries params; the fallback
       exists so a future check that forgets them degrades rather than crashes */
    return { code: 'TYPE_MISMATCH' }
  }

  if (issue.code === 'unrecognized_keys') return { code: 'UNKNOWN_FIELD' }

  // A discriminated union that matched no member. For elements and effects the
  // spec requires this to be reported as an unknown *type*, naming it — not as
  // a generic parse failure.
  if (issue.code === 'invalid_union') {
    if (field === 'type' && inEffects) return { code: 'UNKNOWN_EFFECT_TYPE' }
    if (field === 'type' && inElements) return { code: 'UNKNOWN_ELEMENT_TYPE' }
    // Other discriminators (background `kind`, advance `mode`) are closed sets
    // the author chose from, so a miss is a bad option rather than an
    // unrecognised extension point.
    if (field && ENUM_FIELDS.has(field)) return { code: 'ENUM_VALUE_INVALID' }
    return { code: 'TYPE_MISMATCH' }
  }

  if (issue.code === 'invalid_value') {
    if (field === 'type' && inEffects) return { code: 'UNKNOWN_EFFECT_TYPE' }
    if (field === 'type' && inElements) return { code: 'UNKNOWN_ELEMENT_TYPE' }
    if (field === 'schemaVersion') {
      return { code: actual === undefined ? 'SCHEMA_VERSION_ABSENT' : 'SCHEMA_VERSION_UNSUPPORTED' }
    }
    if (field && ENUM_FIELDS.has(field)) return { code: 'ENUM_VALUE_INVALID' }
    /* v8 ignore next -- every literal/enum field in the format is listed above;
       the fallback catches one added later without a mapping */
    return { code: 'TYPE_MISMATCH' }
  }

  if (issue.code === 'invalid_type') {
    if (actual === undefined) {
      if (field === 'schemaVersion') return { code: 'SCHEMA_VERSION_ABSENT' }
      return { code: 'REQUIRED_FIELD_MISSING' }
    }
    // FR-004: geometry must be a bare logical number. A string like "120px"
    // makes the manifest's meaning depend on the device that rendered it, so it
    // gets its own code rather than a generic type complaint.
    if (field && GEOMETRY_FIELDS.has(field) && isUnder(path, 'elements')) {
      return { code: 'GEOMETRY_NOT_NUMERIC', rule: 'FR-004' }
    }
    // A millisecond field that is a number but not an integer.
    const expected = (issue as { expected?: string }).expected
    if (expected === 'int' && field?.endsWith('Ms')) {
      return { code: 'TIMING_NOT_INTEGER', rule: 'BR-001' }
    }
    return { code: 'TYPE_MISMATCH' }
  }

  if (issue.code === 'too_small') {
    const origin = (issue as { origin?: string }).origin
    if (origin === 'array' && field === 'slides') return { code: 'LESSON_HAS_NO_SLIDES' }
    if (field === 'durationMs' && inEffects) {
      return { code: 'EFFECT_DURATION_NOT_POSITIVE', rule: 'BR-004' }
    }
    if (field?.endsWith('Ms')) return { code: 'TIMING_NEGATIVE', rule: 'BR-002' }
    return { code: 'TYPE_MISMATCH' }
  }

  return { code: 'TYPE_MISMATCH' }
}

/**
 * One Zod issue may become several of ours: `unrecognized_keys` reports the
 * containing object with the offending keys in a list, but a caller wants one
 * issue per bad key, pointed at the key.
 */
export function mapIssue(issue: $ZodIssue, input: unknown): ValidationIssue[] {
  const basePath = [...(issue.path ?? [])] as Path

  if (issue.code === 'unrecognized_keys') {
    const keys = (issue as { keys?: string[] }).keys ?? []
    return keys.map((key) => {
      const path = [...basePath, key]
      return {
        code: 'UNKNOWN_FIELD' as const,
        path,
        location: { ...resolveLocation(path, input), field: key },
        message: `Unknown field "${key}". The lesson format rejects fields it does not define.`,
      }
    })
  }

  const { code, rule } = classify(issue, basePath, input)
  let message = issue.message
  if (code === 'UNKNOWN_ELEMENT_TYPE' || code === 'UNKNOWN_EFFECT_TYPE') {
    const noun = code === 'UNKNOWN_ELEMENT_TYPE' ? 'element' : 'effect'
    message = `Unknown ${noun} type ${describeValue(valueAtPath(input, basePath))}. ${issue.message}`
  } else if (code === 'GEOMETRY_NOT_NUMERIC') {
    message = `Geometry must be a logical number, received ${describeValue(
      valueAtPath(input, basePath),
    )}. Viewport-relative units would make the lesson depend on the device that rendered it.`
  }

  return [
    {
      code,
      ...(rule ? { rule } : {}),
      path: basePath,
      location: resolveLocation(basePath, input),
      message,
    },
  ]
}
