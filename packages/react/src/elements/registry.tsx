import type { ReactNode } from 'react'
import type { InteractionOutcome, InteractionResponse, ResolvedElement } from '@cuestack/core'
import type { AssetResolver } from './assets.js'

export interface ElementRendererProps {
  readonly element: ResolvedElement
  /**
   * How to address an asset. A widening of the contract below, and a necessary one: an
   * `<img>` needs a `src`, and a manifest carries an opaque `assetId`.
   *
   * It does not weaken the restriction. The reason a renderer is denied the lesson is that
   * a renderer *able* to reach it will, coupling third-party renderers to the lesson
   * shape. A pure `(AssetRef) => string | undefined` gives no route to the lesson, the
   * slide, the transport, or the time — it is a capability, not access. See `assets.ts`.
   */
  readonly resolveAsset: AssetResolver
  /**
   * The learner's answers to *this* element, and a way to add one.
   *
   * Optional, because six of the seven built-in renderers have no use for it and a required
   * field they all ignore is a field that invites being used for something else. Absent means
   * "not interactive", not "interactions unavailable".
   *
   * Note what is still not here: no slide, no lesson, no transport, no time. `submit` takes
   * only the answer — the kernel stamps the moment — so a renderer cannot report a time other
   * than the one that happened.
   */
  readonly interaction?: InteractionAccess
}

export interface InteractionAccess {
  /** Derived from the responses under the authored policy. Never stored (contracts/). */
  readonly outcome: InteractionOutcome
  readonly responses: readonly InteractionResponse[]
  readonly submit: (selected: string | readonly string[]) => void
}

/**
 * A renderer receives the resolved element and a way to address assets. Nothing else.
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
