/**
 * Types inferred from the validators, never declared beside them.
 *
 * Every import here is `import type`, so this module compiles to zero runtime
 * bytes — which is what lets the package root be free of Zod. A learner's
 * browser gets a manifest that was validated at author time and has no reason
 * to carry a validation library.
 */
import type { z } from 'zod'
import type { lessonManifestSchema, lessonMetaSchema, slideSchema, ASPECT_RATIOS } from '../validate/lesson.js'
import type { elementSchema, ELEMENT_TYPES } from '../validate/element.js'
import type { effectSchema, EFFECT_TYPES, EFFECT_PHASES } from '../validate/effect.js'
import type { interactionSchema, optionSchema, INTERACTION_TYPES, COMPLETION_POLICIES } from '../validate/interaction.js'
import type { advanceSchema, backgroundSchema, transitionSchema } from '../validate/advance.js'
import type { assetRefSchema } from '../validate/asset.js'

export type LessonManifest = z.infer<typeof lessonManifestSchema>
export type LessonMeta = z.infer<typeof lessonMetaSchema>
export type Slide = z.infer<typeof slideSchema>
export type Element = z.infer<typeof elementSchema>
export type Effect = z.infer<typeof effectSchema>
export type Interaction = z.infer<typeof interactionSchema>
export type InteractionOption = z.infer<typeof optionSchema>
export type Advance = z.infer<typeof advanceSchema>
export type Background = z.infer<typeof backgroundSchema>
export type Transition = z.infer<typeof transitionSchema>
export type AssetRef = z.infer<typeof assetRefSchema>

export type AspectRatio = (typeof ASPECT_RATIOS)[number]
export type ElementType = (typeof ELEMENT_TYPES)[number]
export type EffectType = (typeof EFFECT_TYPES)[number]
export type EffectPhase = (typeof EFFECT_PHASES)[number]
export type InteractionType = (typeof INTERACTION_TYPES)[number]
export type CompletionPolicy = (typeof COMPLETION_POLICIES)[number]
