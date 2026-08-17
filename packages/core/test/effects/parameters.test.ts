import { describe, expect, it } from 'vitest'
import { createEffectRegistry, type EffectDescriptor } from '../../src/effects/registry.js'
import { builtinEffects } from '../../src/effects/builtin/index.js'

/**
 * An effect declares which parameters it accepts, on the descriptor.
 *
 * Feature 006 T009/T010. Every built-in read an untyped bag with a default inlined in its
 * own `at()` — `pulse` reads `amount`, `slide` reads `from` and `distance` — and nothing
 * declared any of it. So an editor could not offer what nothing described, and the only
 * alternative was a parameter table held by the editor: a per-effect branch by another
 * name, which rots the first time a ninth effect registers and which Constitution I calls a
 * defect.
 *
 * `InspectorField` rather than a new shape, because effect parameters are the problem the
 * element inspector already solved. One difference, and it is load-bearing: on an element a
 * `key` is a **dotted path** from the element root (`payload.text`); on an effect it is a
 * **flat key** into `effect.parameters` (`amount`). Sharing the type must not become sharing
 * the read.
 */

describe('EffectDescriptor.parameters', () => {
  it('is optional — an effect with nothing to configure declares nothing', () => {
    const bare: EffectDescriptor = {
      type: 'probe-bare',
      phases: ['enter'],
      motion: false,
      defaultEasing: 'linear',
      at: (progress) => ({ opacity: progress }),
    }
    const registry = createEffectRegistry([bare])
    expect(registry.get('probe-bare')?.parameters).toBeUndefined()
  })

  it('is what a consumer reads off the registry, not off the effect module', () => {
    const declared: EffectDescriptor = {
      type: 'probe-declared',
      phases: ['emphasis'],
      motion: false,
      defaultEasing: 'ease-in-out',
      parameters: [
        { key: 'amount', label: 'Amount', kind: 'number' },
        { key: 'from', label: 'From', kind: 'select', options: ['top', 'bottom'] },
      ],
      at: () => ({}),
    }
    const registry = createEffectRegistry([declared])
    const fields = registry.get('probe-declared')?.parameters ?? []

    expect(fields.map((f) => f.key)).toEqual(['amount', 'from'])
    expect(fields[1]?.options).toEqual(['top', 'bottom'])
  })

  it('carries a flat key, never a dotted path', () => {
    // The element inspector's `key` is a path into the element; an effect's is a plain key
    // into `effect.parameters`. A dotted key here would mean somebody reached for
    // `inspector/path.ts` and the two uses had quietly shared a code path.
    for (const descriptor of builtinEffects) {
      for (const field of descriptor.parameters ?? []) {
        expect(field.key, `${descriptor.type}.${field.key}`).not.toContain('.')
      }
    }
  })
})

/**
 * The sweep that would have caught a guessed table.
 *
 * Reading the eight implementations found two things a plausible guess gets wrong:
 * `slide.from` is a *direction string* while `zoom.from` is a *starting scale number* — one
 * key, two types, in two effects a teacher picks between in the same menu — and `amount`
 * carries three different defaults across `pulse`, `highlight`, and `dim`.
 */
describe('every built-in declares what it actually reads', () => {
  /** What each effect's `at()` is known to consult, read from the source. */
  const READS: Record<string, readonly string[]> = {
    appear: [],
    fade: [],
    disappear: [],
    slide: ['from', 'distance'],
    zoom: ['from'],
    pulse: ['amount'],
    highlight: ['amount'],
    dim: ['amount'],
  }

  it('covers all eight, so a ninth cannot be added without a decision here', () => {
    expect(builtinEffects.map((e) => e.type).sort()).toEqual(Object.keys(READS).sort())
  })

  it('declares exactly the keys its at() consults', () => {
    for (const descriptor of builtinEffects) {
      const declared = (descriptor.parameters ?? []).map((f) => f.key).sort()
      expect(declared, descriptor.type).toEqual([...READS[descriptor.type]!].sort())
    }
  })

  it('declares slide with both from and distance', () => {
    // Named separately because it is the one an editor author would forget: `slide` looks
    // like a direction-only effect until you read the `distance` default of 64.
    const keys = (builtinEffects.find((e) => e.type === 'slide')?.parameters ?? []).map((f) => f.key)
    expect(keys).toContain('from')
    expect(keys).toContain('distance')
  })

  it('gives slide.from options and zoom.from none, because they are different types', () => {
    const from = (type: string) =>
      builtinEffects.find((e) => e.type === type)?.parameters?.find((f) => f.key === 'from')

    expect(from('slide')?.kind).toBe('select')
    expect(from('slide')?.options).toEqual(['top', 'bottom', 'left', 'right'])
    // A number: the scale it starts at, defaulting to 0.92. Offering a direction dropdown
    // here is exactly what a central parameter table would have produced.
    expect(from('zoom')?.kind).toBe('number')
    expect(from('zoom')?.options).toBeUndefined()
  })

  it('leaves the defaults in at(), so a server render with no parameters still works', () => {
    // The declaration says what *may* be set. It does not become the only source of a
    // default, because `at` is called per frame on a server and `parameters` is optional.
    const pulse = builtinEffects.find((e) => e.type === 'pulse')!
    const withNothing = pulse.at(0.5)
    const withAmount = pulse.at(0.5, { amount: 0.5 })
    expect(withNothing.scale).toBeDefined()
    expect(withNothing.scale).not.toEqual(withAmount.scale)
  })
})
