/**
 * The seven MVP element types.
 *
 * Restated here rather than imported because `ELEMENT_TYPES` is a runtime const in
 * `@cuestack/schema/validate` and the package root is types-only by contract. Pulling
 * the validate entry into a rendering test would drag Zod in for a list of strings.
 *
 * A restated list is a list that drifts — this project has corrected four of them. So
 * `all-types.test.ts` reads the schema's own source and asserts this matches it, which
 * makes the duplication checked rather than merely intended.
 */
export const ELEMENT_TYPES = [
  'text',
  'image',
  'shape',
  'video',
  'audio',
  'button',
  'question',
] as const
