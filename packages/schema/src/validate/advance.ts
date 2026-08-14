import { z } from 'zod'
import { identifier } from './primitives.js'

/**
 * FR-ADV-001..004. Every slide carries a progression rule: a slide without one
 * cannot be played.
 *
 * The referential half of these rules — that the named element exists, on this
 * slide, and is of the right kind — cannot live here. It needs the whole
 * document. See referential.ts.
 */
export const advanceSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('after_duration') }),
  z.strictObject({ mode: z.literal('on_click') }),
  z.strictObject({ mode: z.literal('after_media_ends'), mediaElementId: identifier }),
  z.strictObject({ mode: z.literal('after_interaction'), interactionElementId: identifier }),
])

export const transitionSchema = z.strictObject({
  type: z.enum(['none', 'fade', 'slide', 'zoom']),
  durationMs: z.int().min(0),
})

export const backgroundSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('color'), color: z.string().min(1).max(128) }),
  z.strictObject({
    kind: z.literal('gradient'),
    from: z.string().min(1).max(128),
    to: z.string().min(1).max(128),
    angle: z.number().finite().optional(),
  }),
  z.strictObject({ kind: z.literal('image'), assetId: identifier, fit: z.enum(['cover', 'contain']).optional() }),
])
