import { z } from 'zod'
import { identifier } from './primitives.js'

/**
 * FR-INT-001: single-answer multiple choice and true/false only at v1.
 * Multiple-select, short-answer, matching, and ordering are FR-INT-002
 * ("Should") — adding an enum member later is an additive migration.
 */
export const INTERACTION_TYPES = ['multiple_choice', 'true_false'] as const

export const COMPLETION_POLICIES = [
  'on_first_attempt',
  'on_correct',
  'on_attempts_exhausted',
] as const

export const optionSchema = z.strictObject({
  id: identifier,
  label: z.string().min(1).max(2000),
})

export const interactionSchema = z.strictObject({
  interactionType: z.enum(INTERACTION_TYPES),
  prompt: z.string().min(1).max(4000),
  options: z.array(optionSchema).min(2),
  correctResponse: z.union([identifier, z.array(identifier).min(1)]),
  /**
   * Explicit, no default. Whether a question gates progression is too
   * consequential to infer (BR-005).
   */
  required: z.boolean(),
  maxAttempts: z.int().positive().optional(),
  shuffle: z.boolean().optional(),
  points: z.number().finite().optional(),
  correctFeedback: z.string().max(4000).optional(),
  incorrectFeedback: z.string().max(4000).optional(),
  completionPolicy: z.enum(COMPLETION_POLICIES).optional(),
})
