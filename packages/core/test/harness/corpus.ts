import type { Effect, Element, Slide } from '@cuestack/schema'

/**
 * Fixture builders and the slide corpus the determinism and parity sweeps iterate.
 *
 * Built rather than authored as JSON so a sweep can ask "every boundary where
 * something changes" — which needs the timings to be derivable, not read.
 */

let seq = 0
const nextId = (prefix: string) => `${prefix}_${++seq}`

export function textElement(overrides: Partial<Element> = {}): Element {
  return {
    id: nextId('el'),
    type: 'text',
    x: 100,
    y: 100,
    width: 400,
    height: 80,
    zIndex: 1,
    startMs: 0,
    endMs: 8000,
    payload: { text: 'content' },
    ...overrides,
  } as Element
}

export function effect(overrides: Partial<Effect> = {}): Effect {
  return {
    id: nextId('fx'),
    type: 'fade',
    phase: 'enter',
    startMs: 0,
    durationMs: 500,
    order: 1,
    ...overrides,
  } as Effect
}

export function slide(elements: Element[], overrides: Partial<Slide> = {}): Slide {
  return {
    id: nextId('slide'),
    durationMs: 8000,
    advance: { mode: 'after_duration' },
    elements,
    ...overrides,
  } as Slide
}

/** A slide of `total` text elements, staggered so timings differ per element. */
export function largeSlide(total: number, durationMs = 8000): Slide {
  return slide(
    Array.from({ length: total }, (_, i) =>
      textElement({
        id: `el_${i}`,
        zIndex: i,
        startMs: (i * 7) % durationMs,
        endMs: durationMs,
        effects: [effect({ id: `fx_${i}`, startMs: (i * 7) % durationMs, durationMs: 300, order: 1 })],
      }),
    ),
    { durationMs },
  )
}

/**
 * The corpus. Each entry is a slide plus the times at which its rendered state
 * changes — the boundaries a sweep must visit, because a bug that only shows up
 * one millisecond either side of a transition is exactly the kind a sampled test
 * walks past.
 */
export interface CorpusEntry {
  name: string
  slide: Slide
  boundaries: number[]
}

function boundariesOf(s: Slide): number[] {
  const points = new Set<number>([0, s.durationMs])
  for (const el of s.elements) {
    for (const t of [el.startMs, el.endMs]) {
      points.add(Math.max(0, t - 1))
      points.add(t)
      points.add(t + 1)
    }
    for (const fx of el.effects ?? []) {
      for (const t of [fx.startMs, fx.startMs + fx.durationMs]) {
        points.add(Math.max(0, t - 1))
        points.add(t)
        points.add(t + 1)
        points.add(fx.startMs + Math.floor(fx.durationMs / 2))
      }
    }
  }
  return [...points].filter((t) => t >= 0).sort((a, b) => a - b)
}

function entry(name: string, s: Slide): CorpusEntry {
  return { name, slide: s, boundaries: boundariesOf(s) }
}

export function corpus(): CorpusEntry[] {
  return [
    entry('single element, no effects', slide([textElement({ effects: [] })])),
    entry(
      'enter, emphasis, exit on one element',
      slide([
        textElement({
          startMs: 500,
          endMs: 7000,
          effects: [
            effect({ type: 'fade', phase: 'enter', startMs: 500, durationMs: 500, order: 1 }),
            effect({ type: 'pulse', phase: 'emphasis', startMs: 3000, durationMs: 600, order: 1 }),
            effect({ type: 'disappear', phase: 'exit', startMs: 6600, durationMs: 400, order: 1 }),
          ],
        }),
      ]),
    ),
    entry(
      'overlapping effects sharing a start time',
      slide([
        textElement({
          effects: [
            effect({ type: 'fade', phase: 'enter', startMs: 1000, durationMs: 800, order: 1 }),
            effect({ type: 'zoom', phase: 'enter', startMs: 1000, durationMs: 800, order: 2 }),
          ],
        }),
      ]),
    ),
    entry(
      'hidden and locked elements',
      slide([
        textElement({ hidden: true }),
        textElement({ locked: true }),
        textElement(),
      ]),
    ),
    entry('layer order reversed relative to array order', slide([
      textElement({ zIndex: 9 }),
      textElement({ zIndex: 1 }),
      textElement({ zIndex: 5 }),
    ])),
    entry('effect extending past the slide end', slide([
      textElement({ endMs: 8000, effects: [effect({ startMs: 7900, durationMs: 500, order: 1 })] }),
    ])),
    entry('thirty elements', largeSlide(30)),
  ]
}
