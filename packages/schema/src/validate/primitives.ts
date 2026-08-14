import { z } from 'zod'

/**
 * Shared leaf types. Keeping them in one place is what lets map-issue.ts
 * recognise a timing fault from a geometry fault without string-matching
 * messages.
 */

/** BR-001, BR-002: non-negative integer milliseconds. */
export const msInt = z.int().min(0)

/** BR-004: a duration must be strictly positive. Zero is not "instant" — `appear` is. */
export const msDuration = z.int().positive()

/**
 * FR-004: a logical canvas coordinate. Deliberately a bare finite number:
 * accepting "120px" or "50%" would make the manifest's meaning depend on the
 * device that rendered it, which is precisely what FR-004 prevents.
 */
export const logicalNumber = z.number().finite()

/** A logical extent. Zero-area elements cannot be selected or rendered. */
export const logicalExtent = z.number().finite().positive()

export const identifier = z.string().min(1).max(128)

/** BCP-47-ish. Full validation belongs to the host, not the format. */
export const languageTag = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/)

export const themeToken = z.string().min(1).max(128)
