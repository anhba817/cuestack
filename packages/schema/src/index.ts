/**
 * @cuestack/schema — the lesson format.
 *
 * This entry point exports **types only** and compiles to zero runtime bytes.
 * Validators live behind `@cuestack/schema/validate`; migrations behind
 * `@cuestack/schema/migrate`.
 *
 *   import type { LessonManifest } from '@cuestack/schema'      // free
 *   import { validate } from '@cuestack/schema/validate'        // pulls in Zod
 *
 * A change that adds a runtime export here is a breaking change to the package
 * contract, and the zero-bytes assertion in CI is what enforces it.
 */
export type {
  LessonManifest,
  LessonMeta,
  Slide,
  Element,
  Effect,
  Interaction,
  InteractionOption,
  Advance,
  Background,
  Transition,
  AssetRef,
  AspectRatio,
  ElementType,
  EffectType,
  EffectPhase,
  InteractionType,
  CompletionPolicy,
} from './types/index.js'
