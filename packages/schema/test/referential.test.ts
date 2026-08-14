import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { withReference } from './helpers.js'

/**
 * Tier-2 checks from data-model.md. These cannot live in the schema because
 * they need the whole document, not one node.
 */
describe('referential integrity', () => {
  describe('identifier uniqueness', () => {
    it('rejects duplicate slide ids', () => {
      const r = validate(withReference((m) => { m.slides[1].id = 'slide_intro' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('DUPLICATE_ID')
    })

    it('rejects duplicate element ids within a slide', () => {
      const r = validate(withReference((m) => { m.slides[0].elements[1].id = 'element_title' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('DUPLICATE_ID')
    })

    it('allows the same element id on different slides', () => {
      const r = validate(withReference((m) => { m.slides[3].elements[0].id = 'element_title' }))
      expect(r.ok).toBe(true)
    })

    it('rejects duplicate effect ids within an element', () => {
      const r = validate(withReference((m) => {
        m.slides[0].elements[1].effects[1].id = 'effect_accent_pulse'
      }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('DUPLICATE_ID')
    })
  })

  describe('after_media_ends (BR-006)', () => {
    it('rejects a reference to a missing element', () => {
      const r = validate(withReference((m) => { m.slides[1].advance.mediaElementId = 'nope' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      const issue = r.issues.find((i) => i.code === 'ADVANCE_MEDIA_NOT_FOUND')
      expect(issue?.rule).toBe('BR-006')
    })

    it('rejects a reference to a non-media element', () => {
      const r = validate(withReference((m) => { m.slides[1].advance.mediaElementId = 'element_worker' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('ADVANCE_MEDIA_WRONG_TYPE')
    })

    it('rejects a reference to media on a different slide', () => {
      const r = validate(withReference((m) => { m.slides[0].advance = { mode: 'after_media_ends', mediaElementId: 'element_briefing' } }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('ADVANCE_MEDIA_NOT_FOUND')
    })

    it('accepts an audio element as controlling media', () => {
      const r = validate(withReference((m) => { m.slides[1].advance.mediaElementId = 'element_ambient' }))
      expect(r.ok).toBe(true)
    })
  })

  describe('after_interaction', () => {
    it('rejects a reference to a missing element', () => {
      const r = validate(withReference((m) => { m.slides[2].advance.interactionElementId = 'nope' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('ADVANCE_INTERACTION_NOT_FOUND')
    })

    it('rejects a question that is not required — it could never advance', () => {
      const r = validate(withReference((m) => { m.slides[2].elements[0].payload.required = false }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('ADVANCE_INTERACTION_NOT_REQUIRED')
    })

    it('rejects a reference to a non-question element', () => {
      const r = validate(withReference((m) => {
        m.slides[1].advance = { mode: 'after_interaction', interactionElementId: 'element_worker' }
      }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('ADVANCE_INTERACTION_NOT_FOUND')
    })
  })

  describe('correctResponse', () => {
    it('rejects an option id that does not exist', () => {
      const r = validate(withReference((m) => { m.slides[2].elements[0].payload.correctResponse = 'opt_z' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('CORRECT_RESPONSE_UNKNOWN_OPTION')
    })

    it('rejects duplicate option ids', () => {
      const r = validate(withReference((m) => { m.slides[2].elements[0].payload.options[1].id = 'opt_a' }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.issues.map((i) => i.code)).toContain('DUPLICATE_ID')
    })
  })

  it('does not run referential checks when the structure is already broken', () => {
    // Noise, not information: referential errors over a malformed document are
    // usually consequences of the structural fault, not independent problems.
    const r = validate(withReference((m) => {
      m.slides[1].advance.mediaElementId = 'nope'
      m.slides[0].durationMs = 'not a number'
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).not.toContain('ADVANCE_MEDIA_NOT_FOUND')
  })
})

describe('multi-answer correctResponse', () => {
  it('accepts an array of option ids', () => {
    const r = validate(withReference((m) => {
      m.slides[2].elements[0].payload.correctResponse = ['opt_a', 'opt_c']
    }))
    expect(r.ok).toBe(true)
  })

  it('rejects an array containing an unknown option id', () => {
    const r = validate(withReference((m) => {
      m.slides[2].elements[0].payload.correctResponse = ['opt_a', 'opt_missing']
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.map((i) => i.code)).toContain('CORRECT_RESPONSE_UNKNOWN_OPTION')
  })
})
