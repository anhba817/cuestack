import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../src/elements/registry.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { RENDER_STATE_VERSION, type ElementPlugin } from '../../src/elements/contract.js'

/**
 * What each type checks, and — as importantly — what it deliberately does not.
 *
 * The discipline here is the one R-01 sets for the whole engine: a plugin must not restate what the
 * format already rejects. The schema reports a correct answer naming no option, so `question` does
 * not; repeating it would give a teacher two issues for one fault, which is the duplication this
 * feature exists to avoid (FR-006c).
 */
const byType = new Map(builtinElements.map((p) => [p.type, p]))
const issues = (type: string, payload: unknown): string[] =>
  (byType.get(type)?.validate(payload as never) ?? []).map((i) => i.code)

describe('every MVP type has a complete plugin', () => {
  it('covers all seven', () => {
    expect([...byType.keys()].sort()).toEqual(
      ['audio', 'button', 'image', 'question', 'shape', 'text', 'video'],
    )
  })

  it('each supplies every member the contract requires', () => {
    for (const p of builtinElements) {
      for (const member of ['type', 'schema', 'resolve', 'inspector', 'validate'] as const) {
        expect(p[member], `${p.type} is missing ${member}`).toBeDefined()
      }
      expect(p.renderStateVersion).toBe(RENDER_STATE_VERSION)
    }
  })

  it('each declares inspector fields, which the studio derives from', () => {
    for (const p of builtinElements) {
      expect(p.inspector.fields.length, `${p.type} declares no fields`).toBeGreaterThan(0)
    }
  })
})

describe('what each type reports', () => {
  it('text: nothing for words, an issue for none', () => {
    expect(issues('text', { text: 'Hello' })).toEqual([])
    expect(issues('text', { text: '   ' })).toContain('TEXT_EMPTY')
  })

  it('button: an issue only for the combination the format permits and a learner cannot use', () => {
    expect(issues('button', { label: 'Go', action: 'next_slide' })).toEqual([])
    expect(issues('button', { label: 'Go', action: 'open_url', url: 'https://example.org' })).toEqual([])
    expect(issues('button', { label: 'Go', action: 'open_url' })).toContain('BUTTON_URL_ABSENT')
  })

  it('question: only what the format leaves open', () => {
    const ok = {
      prompt: 'Which?',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      correctResponse: 'a',
    }
    expect(issues('question', ok)).toEqual([])

    // Unique ids, identical labels: the format checks the ids and never reads the labels.
    expect(
      issues('question', {
        ...ok,
        options: [
          { id: 'a', label: 'Paris' },
          { id: 'b', label: 'paris ' },
        ],
      }),
    ).toContain('QUESTION_OPTIONS_INDISTINGUISHABLE')

    // `options` is `min(2)` for every interaction type, including the one named for two.
    expect(
      issues('question', {
        ...ok,
        interactionType: 'true_false',
        options: [
          { id: 'a', label: 'True' },
          { id: 'b', label: 'False' },
          { id: 'c', label: 'Maybe' },
        ],
      }),
    ).toContain('QUESTION_TRUE_FALSE_OPTION_COUNT')

    // `prompt` is `min(1)`, so a single space satisfies the format and reads as no question.
    expect(issues('question', { ...ok, prompt: '  ' })).toContain('QUESTION_PROMPT_EMPTY')
  })

  it('question: does NOT restate the option count, which the format enforces', () => {
    /**
     * The correction worth pinning. An earlier version of this plugin reported fewer than two
     * options; `interactionSchema` declares `options: z.array(optionSchema).min(2)`, so that
     * lesson is rejected by the format and the plugin's issue was a second report of one fault —
     * the duplication FR-006c exists to prevent.
     */
    expect(
      issues('question', {
        prompt: 'Which?',
        options: [{ id: 'a', label: 'A' }],
        correctResponse: 'a',
      }),
    ).toEqual([])
  })

  it('question: does NOT restate what the format already rejects', () => {
    // `CORRECT_RESPONSE_UNKNOWN_OPTION` is the schema's, and one fault must produce one issue.
    const codes = issues('question', {
      prompt: 'Which?',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      correctResponse: 'nonexistent',
    })
    expect(codes).not.toContain('CORRECT_RESPONSE_UNKNOWN_OPTION')
  })

  it('image, video, audio, shape: nothing, because the format and the engine cover them', () => {
    // Accessibility metadata is a *common* field, so it is the engine's rule rather than each
    // plugin's — a plugin sees only the payload and could not check it if it wanted to.
    expect(issues('image', { asset: { assetId: 'a' } })).toEqual([])
    expect(issues('video', { asset: { assetId: 'a' } })).toEqual([])
    expect(issues('audio', { asset: { assetId: 'a' } })).toEqual([])
    expect(issues('shape', { shape: 'rect' })).toEqual([])
  })

  it('none of them throws on a payload of the wrong shape', () => {
    for (const p of builtinElements) {
      expect(() => p.validate(null as never), p.type).not.toThrow()
      expect(() => p.validate('not an object' as never), p.type).not.toThrow()
    }
  })
})

describe('registration refuses an incomplete plugin', () => {
  it('names the missing member rather than failing vaguely', () => {
    // Exercised deliberately, because building the default registry at module scope means this
    // path now fails the *import* of the package rather than a test (research R-15).
    const incomplete = { ...builtinElements[0]!, validate: undefined } as unknown as ElementPlugin
    expect(() => createElementRegistry([incomplete])).toThrow(/validate/)
  })

  it('refuses a plugin built against a different RenderState', () => {
    const stale = { ...builtinElements[0]!, renderStateVersion: 99 } as ElementPlugin
    expect(() => createElementRegistry([stale])).toThrow(/RenderState/)
  })
})

describe('the canonical field list', () => {
  /**
   * The gap a negative control found, and the reason it is here rather than in the studio.
   *
   * `plugin-precedence.test.tsx` asserts the inspector is *identical* with and without the plugin
   * registry — which it must be, and which cannot catch a field going missing: since T029b1 the
   * studio derives its list from this one, so removing a field removes it from both sides and the
   * two stay identical. The parity test was measuring a tautology for that particular failure.
   *
   * So the field list is pinned here, where it is now declared. A field removed from a plugin is a
   * control a teacher can no longer reach, and this is the assertion that says so.
   */
  const CANONICAL: Record<string, readonly string[]> = {
    text: ['payload.text'],
    image: ['payload.asset.assetId', 'payload.caption'],
    shape: ['payload.shape'],
    video: [
      'payload.asset.assetId',
      'payload.asset.captionTrack',
      'payload.poster',
      'payload.volume',
      'payload.showControls',
      'payload.loop',
    ],
    /**
     * Audio has no `loop` row while video does, and the format allows it on both.
     *
     * Stated as an observation, not a rationale. The list came from the editor registry feature
     * 005 shipped, and the plugins carried it across unchanged — this feature moved where the list
     * is declared and deliberately did not change what is in it, since adding a control inside a
     * feature about adding checks is how a change nobody asked for reaches a teacher. Pinned here
     * so that if it is an oversight, closing it is a decision somebody makes rather than a diff
     * that slips through.
     */
    audio: [
      'payload.asset.assetId',
      'payload.asset.transcript',
      'payload.volume',
      'payload.showControls',
    ],
    button: ['payload.label', 'payload.action', 'payload.url'],
    question: [
      'payload.prompt',
      'payload.interactionType',
      'payload.options',
      'payload.correctResponse',
      'payload.required',
      'payload.maxAttempts',
    ],
  }

  for (const [type, keys] of Object.entries(CANONICAL)) {
    it(`${type} declares exactly its fields`, () => {
      const plugin = builtinElements.find((p) => p.type === type)!
      expect(plugin.inspector.fields.map((f) => f.key)).toEqual(keys)
    })
  }

  it('covers every registered type, so a new one cannot arrive unpinned', () => {
    expect(builtinElements.map((p) => p.type).sort()).toEqual(Object.keys(CANONICAL).sort())
  })
})
