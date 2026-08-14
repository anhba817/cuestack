import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../src/elements/registry.js'
import { createEffectRegistry } from '../../src/effects/registry.js'
import { builtinEffects } from '../../src/effects/builtin/index.js'
import { resolve } from '../../src/resolve/index.js'
import { slide } from '../harness/corpus.js'
import { syntheticElement, syntheticPlugin } from '../harness/plugins.js'

/**
 * FR-028: an unregistered *required interaction* type blocks.
 *
 * The asymmetry with FR-027 is the requirement, not an inconsistency. Losing a
 * decorative element costs the learner some content; silently skipping a question
 * that gates progression strands them on a slide with no way forward. The two
 * failures are not comparable, so the responses are not either.
 */
const context = () => ({
  elements: createElementRegistry([syntheticPlugin({ type: 'text' })]),
  effects: createEffectRegistry(builtinEffects),
})

const questionOfType = (type: string, required: boolean) =>
  slide([
    syntheticElement({
      id: 'q',
      type,
      effects: [],
      payload: {
        interactionType: 'matching',
        prompt: 'Pair these',
        options: [{ id: 'a', label: 'A' }],
        correctResponse: 'a',
        required,
      },
    }),
  ])

describe('an unregistered required interaction type', () => {
  it('blocks the slide', () => {
    const blocked = resolve(questionOfType('question', true), 0, context()).blocked
    expect(blocked?.code).toBe('UNKNOWN_REQUIRED_INTERACTION')
    expect(blocked?.elementId).toBe('q')
  })

  it('explains why, in terms of the learner rather than the type system', () => {
    const blocked = resolve(questionOfType('question', true), 0, context()).blocked
    expect(blocked?.message).toMatch(/strand|gates progression/i)
  })

  it('does not block when the same unknown type is optional', () => {
    expect(resolve(questionOfType('question', false), 0, context()).blocked).toBeNull()
  })

  it('does not block for a registered question type', () => {
    const withQuestion = {
      elements: createElementRegistry([syntheticPlugin({ type: 'text' }), syntheticPlugin({ type: 'question' })]),
      effects: createEffectRegistry(builtinEffects),
    }
    expect(resolve(questionOfType('question', true), 0, withQuestion).blocked).toBeNull()
  })
})
