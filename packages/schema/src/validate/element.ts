import { z } from 'zod'
import { assetRefSchema } from './asset.js'
import { effectSchema } from './effect.js'
import { interactionSchema } from './interaction.js'
import { identifier, logicalExtent, logicalNumber, msInt, themeToken } from './primitives.js'
import type { CustomIssueParams } from './issues.js'

/** FR-CAN-001: the MVP element set. */
export const ELEMENT_TYPES = [
  'text',
  'image',
  'shape',
  'video',
  'audio',
  'button',
  'question',
] as const

const elementAccessibilitySchema = z.strictObject({
  altText: z.string().max(2000).optional(),
  label: z.string().max(2000).optional(),
  hidden: z.boolean().optional(),
})

const elementStyleSchema = z.strictObject({
  fill: themeToken.optional(),
  stroke: themeToken.optional(),
  strokeWidth: z.number().finite().nonnegative().optional(),
  color: themeToken.optional(),
  fontSize: z.number().finite().positive().optional(),
  fontFamily: themeToken.optional(),
  fontWeight: z.union([z.number().int(), z.string().max(32)]).optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  radius: z.number().finite().nonnegative().optional(),
})

/** Fields every element carries, whatever its type. */
const base = {
  id: identifier,
  x: logicalNumber,
  y: logicalNumber,
  width: logicalExtent,
  height: logicalExtent,
  rotation: z.number().finite().optional(),
  zIndex: z.int(),
  /** Authoring state; does not affect playback (BR-011). */
  locked: z.boolean().optional(),
  /** Does affect playback (BR-010), so it belongs in the manifest. */
  hidden: z.boolean().optional(),
  startMs: msInt,
  endMs: msInt,
  effects: z.array(effectSchema).optional(),
  style: elementStyleSchema.optional(),
  accessibility: elementAccessibilitySchema.optional(),
}

const mediaPayload = {
  asset: assetRefSchema,
  volume: z.number().finite().min(0).max(1).optional(),
  showControls: z.boolean().optional(),
  loop: z.boolean().optional(),
}

const variants = [
  z.strictObject({
    ...base,
    type: z.literal('text'),
    payload: z.strictObject({ text: z.string().max(20000) }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('image'),
    payload: z.strictObject({ asset: assetRefSchema, caption: z.string().max(2000).optional() }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('shape'),
    payload: z.strictObject({ shape: z.enum(['rect', 'ellipse', 'line', 'arrow']) }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('video'),
    payload: z.strictObject({ ...mediaPayload, poster: identifier.optional() }),
  }),
  z.strictObject({ ...base, type: z.literal('audio'), payload: z.strictObject(mediaPayload) }),
  z.strictObject({
    ...base,
    type: z.literal('button'),
    payload: z.strictObject({
      label: z.string().min(1).max(500),
      action: z.enum(['next_slide', 'previous_slide', 'replay_slide', 'open_url']),
      url: z.string().max(2000).optional(),
    }),
  }),
  z.strictObject({ ...base, type: z.literal('question'), payload: interactionSchema }),
] as const

/**
 * BR-003: an element's end must be later than its start.
 *
 * Expressed as a check rather than a field constraint because it relates two
 * fields, and carried through `params` so map-issue.ts can attach the stable
 * code without matching on message text.
 */
const endAfterStart: CustomIssueParams = { code: 'TIMING_END_BEFORE_START', rule: 'BR-003' }

export const elementSchema = z
  .discriminatedUnion('type', variants)
  .check((ctx) => {
    const value = ctx.value as { startMs?: number; endMs?: number }
    if (
      typeof value?.startMs === 'number' &&
      typeof value?.endMs === 'number' &&
      value.endMs <= value.startMs
    ) {
      ctx.issues.push({
        code: 'custom',
        path: ['endMs'],
        input: ctx.value,
        message: `endMs (${value.endMs}) must be greater than startMs (${value.startMs})`,
        params: endAfterStart,
      })
    }
  })

export const MEDIA_ELEMENT_TYPES = ['video', 'audio'] as const
