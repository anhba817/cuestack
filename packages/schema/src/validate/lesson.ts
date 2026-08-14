import { z } from 'zod'
import { advanceSchema, backgroundSchema, transitionSchema } from './advance.js'
import { elementSchema } from './element.js'
import { identifier, languageTag, msInt, themeToken } from './primitives.js'

export const ASPECT_RATIOS = ['16:9', '4:3', '9:16'] as const

/** The one supported format version. */
export const CURRENT_SCHEMA_VERSION = '1.0'

export const lessonMetaSchema = z.strictObject({
  id: identifier,
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  /**
   * Required with no default. It drives the document language for assistive
   * technology, and a wrong default is worse than a rejection.
   */
  language: languageTag,
  aspectRatio: z.enum(ASPECT_RATIOS),
  themeId: themeToken.optional(),
})

const slideAccessibilitySchema = z.strictObject({
  label: z.string().max(2000).optional(),
  announce: z.string().max(2000).optional(),
})

export const slideSchema = z.strictObject({
  id: identifier,
  name: z.string().max(200).optional(),
  durationMs: msInt,
  background: backgroundSchema.optional(),
  transition: transitionSchema.optional(),
  advance: advanceSchema,
  /** May be empty — a slide with no content is a warning (Wave 5), not an error. */
  elements: z.array(elementSchema),
  accessibility: slideAccessibilitySchema.optional(),
  /**
   * Constrained to string values. Free-form nested data would defeat the
   * reject-unknown-fields rule that FR-019 leans on.
   */
  metadata: z.record(z.string(), z.string()).optional(),
})

export const lessonManifestSchema = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  lesson: lessonMetaSchema,
  /** A lesson with nothing in it cannot be played (spec §31, blocking error). */
  slides: z.array(slideSchema).min(1),
})

export type LessonManifestOutput = z.infer<typeof lessonManifestSchema>
