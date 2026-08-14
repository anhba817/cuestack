import { describe, expect, it } from 'vitest'
import { createMemoryAnalytics } from '../../src/adapters/memory/index.js'
import type { LessonEvent } from '../../src/adapters/index.js'

/**
 * FR-033 / NFR-PRV-002. The event carries what an analyst needs and has no field a
 * learner identifier could occupy — enforced structurally rather than by review,
 * because a field that exists eventually gets filled.
 */
describe('lesson events', () => {
  const event: LessonEvent = {
    kind: 'interaction_submitted',
    lessonId: 'lesson_1',
    schemaVersion: '1.0',
    slideId: 'slide_2',
    interactionId: 'q1',
    attempt: 2,
    outcome: 'correct',
  }

  it('identifies version, slide, interaction, attempt, and outcome', () => {
    const analytics = createMemoryAnalytics()
    analytics.record(event)
    expect(analytics.events[0]).toEqual(event)
  })

  it('has no field a learner identifier could occupy', () => {
    const keys = Object.keys(event)
    for (const forbidden of ['learnerId', 'userId', 'studentId', 'email', 'sessionId', 'ip']) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('the type itself admits no such field', () => {
    // A compile-time claim made observable: assigning an identifier is a type
    // error, so the guarantee cannot be eroded by a well-meaning addition.
    const withIdentity = { ...event, learnerId: 'student_42' }
    const asEvent: LessonEvent = withIdentity as LessonEvent
    // Even smuggled in via a cast, it is not part of the declared shape.
    const declared: Array<keyof LessonEvent> = [
      'kind', 'lessonId', 'schemaVersion', 'slideId', 'interactionId', 'attempt', 'outcome',
    ]
    expect(declared).not.toContain('learnerId' as keyof LessonEvent)
    expect(asEvent.kind).toBe('interaction_submitted')
  })

  it('recording never throws and never returns a promise', () => {
    const analytics = createMemoryAnalytics()
    // Fire and forget: analytics must not be able to stall playback or fail a lesson.
    expect(analytics.record(event)).toBeUndefined()
    expect(() => analytics.record({ ...event, kind: 'lesson_completed' })).not.toThrow()
  })

  it('accepts every event kind the player will emit', () => {
    const analytics = createMemoryAnalytics()
    const kinds: LessonEvent['kind'][] = [
      'lesson_started', 'slide_started', 'slide_completed',
      'interaction_submitted', 'lesson_paused', 'lesson_resumed', 'lesson_completed',
    ]
    for (const kind of kinds) analytics.record({ ...event, kind })
    expect(analytics.events).toHaveLength(kinds.length)
  })
})
