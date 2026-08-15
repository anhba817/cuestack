import { describe, expect, it } from 'vitest'
import { emptyInteractionState, submit } from '../../src/interactions/state.js'
import { question } from '../harness/interactions.js'

/**
 * Session state: what the learner answered, and what the gate reads from it.
 *
 * Immutable by construction. Interaction state is an *input* to advancement, and an input
 * that mutates under its reader is the class of bug that opens a gate one frame early.
 */

const q = question()

describe('submit', () => {
  it('returns a new state rather than mutating the old one', () => {
    const before = emptyInteractionState()
    const { state: after } = submit(before, 'q', q, 'a', 100)
    expect(after).not.toBe(before)
    expect(before.responses.size).toBe(0)
    expect(after.responses.size).toBe(1)
  })

  it('records what was answered, when, and whether it was right', () => {
    const { response } = submit(emptyInteractionState(), 'q', q, 'b', 250)
    expect(response).toEqual({
      elementId: 'q',
      selected: 'b',
      attempt: 1,
      correct: false,
      atMs: 250,
    })
  })

  it('numbers attempts in order', () => {
    let state = emptyInteractionState()
    for (const choice of ['b', 'b', 'a']) {
      state = submit(state, 'q', q, choice, 0).state
    }
    expect(state.responses.get('q')?.map((r) => r.attempt)).toEqual([1, 2, 3])
  })

  it('returns the event rather than recording it', () => {
    // The kernel does not own the analytics adapter. A function that both computed and
    // emitted could not be called twice in a test without a spy.
    const { event } = submit(emptyInteractionState(), 'q', q, 'a', 400)
    expect(event.kind).toBe('interaction_submitted')
    expect(event.interactionId).toBe('q')
    expect(event.attempt).toBe(1)
    expect(event.outcome).toBe('correct')
  })

  it('emits no learner identifier of any kind', () => {
    // FR-006, SC-012. Asserted on the payload's keys rather than by reading it, because a
    // field added later would slip past an assertion that named the fields it expected.
    const { event } = submit(emptyInteractionState(), 'q', q, 'a', 0)
    const serialised = JSON.stringify(event).toLowerCase()
    for (const forbidden of ['user', 'learner', 'email', 'session', 'name']) {
      expect(serialised).not.toContain(forbidden)
    }
  })
})

describe('responses key by element, not by slide visit', () => {
  it('keeps an answer when the learner returns to the slide', () => {
    // Wave 1's `slideId#visitCount` instance key exists to make *advancement* fire once per
    // visit. It deliberately does not scope answers: "has this slide advanced on this visit"
    // and "has this learner answered this question" are different questions.
    const { state } = submit(emptyInteractionState(), 'q', q, 'a', 0)
    expect(state.completedIds.has('q')).toBe(true)
    expect(state.outcomeOf('q', q).correct).toBe(true)
  })

  it('does not consume an attempt by navigating', () => {
    const { state } = submit(emptyInteractionState(), 'q', question({ maxAttempts: 3 }), 'b', 0)
    expect(state.outcomeOf('q', question({ maxAttempts: 3 })).attemptsUsed).toBe(1)
  })

  it('keeps two questions apart', () => {
    let state = emptyInteractionState()
    state = submit(state, 'q1', q, 'a', 0).state
    state = submit(state, 'q2', q, 'b', 0).state
    expect(state.outcomeOf('q1', q).correct).toBe(true)
    expect(state.outcomeOf('q2', q).correct).toBe(false)
  })
})

describe('completedIds', () => {
  it('is what the advance controller consumes', () => {
    const { state } = submit(emptyInteractionState(), 'q', q, 'a', 0)
    expect([...state.completedIds]).toEqual(['q'])
  })

  it('omits a question that is answered but not complete under its policy', () => {
    const strict = question({ completionPolicy: 'on_correct', maxAttempts: 3 })
    const { state } = submit(emptyInteractionState(), 'q', strict, 'b', 0)
    expect(state.completedIds.has('q')).toBe(false)
  })

  it('is derived, so it cannot disagree with the outcome', () => {
    const strict = question({ completionPolicy: 'on_correct', maxAttempts: 3 })
    let state = submit(emptyInteractionState(), 'q', strict, 'b', 0).state
    expect(state.completedIds.has('q')).toBe(false)
    state = submit(state, 'q', strict, 'a', 0).state
    expect(state.completedIds.has('q')).toBe(true)
  })
})
