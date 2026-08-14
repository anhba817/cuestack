import type { ReactNode } from 'react'
import type { ResolvedElement } from '@cuestack/core'

export interface ElementRendererProps {
  readonly element: ResolvedElement
}

/**
 * A renderer receives the resolved element and nothing else.
 *
 * Not the slide, not the lesson, not its siblings, not the transport, not the time.
 * The same restriction the kernel's plugin contract makes, for the same reason: a
 * renderer *able* to reach the lesson becomes one that does, and then the lesson
 * shape cannot change without breaking third-party renderers.
 */
export interface ElementRenderer {
  readonly type: string
  readonly Component: (props: ElementRendererProps) => ReactNode
  /** How assistive technology describes this type when the author gave no label. */
  readonly label: string
}

export interface ElementRendererRegistry {
  get(type: string): ElementRenderer | undefined
  has(type: string): boolean
  register(renderer: ElementRenderer): void
  types(): readonly string[]
}

const REQUIRED: ReadonlyArray<keyof ElementRenderer> = ['type', 'Component', 'label']

function assertComplete(renderer: ElementRenderer): void {
  const missing = REQUIRED.filter((key) => renderer?.[key] === undefined)
  if (missing.length > 0) {
    throw new Error(
      `Element renderer "${renderer?.type ?? '<unnamed>'}" registration incomplete: ` +
        `missing ${missing.join(', ')}. A renderer without a label is unannounceable, ` +
        'which is discovered by a learner using a screen reader rather than by a test.',
    )
  }
}

export function createRendererRegistry(
  renderers: readonly ElementRenderer[] = [],
): ElementRendererRegistry {
  const map = new Map<string, ElementRenderer>()
  for (const r of renderers) {
    assertComplete(r)
    map.set(r.type, r)
  }
  return {
    get: (type) => map.get(type),
    has: (type) => map.has(type),
    register(renderer) {
      assertComplete(renderer)
      map.set(renderer.type, renderer)
    },
    types: () => [...map.keys()].sort(),
  }
}
