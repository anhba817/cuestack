import { z } from 'zod'
import { identifier, msDuration, msInt } from './primitives.js'

/** FR-TIM-011: the MVP effect library. */
export const EFFECT_TYPES = [
  'appear',
  'fade',
  'slide',
  'zoom',
  'pulse',
  'highlight',
  'dim',
  'disappear',
] as const

export const EFFECT_PHASES = ['enter', 'emphasis', 'exit'] as const

export const effectSchema = z.strictObject({
  id: identifier,
  type: z.enum(EFFECT_TYPES),
  phase: z.enum(EFFECT_PHASES),
  /** Relative to slide time, not element time. */
  startMs: msInt,
  durationMs: msDuration,
  /**
   * FR-TIM-014 requires a deterministic stored order for effects sharing a
   * start time. Array position would supply one, but making it explicit means a
   * resolver bug cannot be masked by an incidental array sort.
   */
  order: z.int(),
  easing: z.string().min(1).max(64).optional(),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})
