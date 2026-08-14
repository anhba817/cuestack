import { z } from 'zod'
import { identifier, msInt } from './primitives.js'

/**
 * A reference to an asset, carrying only what a renderer needs before the
 * network answers. Storage keys, checksums, and processing status belong to the
 * host's asset record, not to a portable lesson — see data-model.md.
 */
export const assetRefSchema = z.strictObject({
  assetId: identifier,
  mimeType: z.string().min(3).max(255),
  /** Required for image and video: their absence is what causes layout shift. */
  width: z.int().positive().optional(),
  height: z.int().positive().optional(),
  /** Required for video and audio: media-end advance needs it before playback. */
  durationMs: msInt.optional(),
  captionTrack: identifier.optional(),
  transcript: identifier.optional(),
})

export type AssetRefInput = z.input<typeof assetRefSchema>
