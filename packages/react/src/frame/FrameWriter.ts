import type { RenderState } from '@cuestack/core'
import { visualProperties } from './applyVisual.js'

/**
 * The only imperative DOM writer in this package.
 *
 * Isolated deliberately (plan.md Complexity Tracking). Every style mutation that
 * bypasses React lives here, so a reviewer can audit the complete set in one file
 * rather than hunting for `ref.current.style` across the tree.
 *
 * Why bypass React at all: playback updates opacity and transform up to sixty times a
 * second. A reconciliation pass per frame per element would put the 60fps budget out of
 * reach before Wave 3 adds transitions. React still owns structure — an element
 * appearing or disappearing is a normal render.
 */
export interface FrameWriter {
  register(elementId: string, node: HTMLElement | null): void
  /**
   * A stable ref callback for one element.
   *
   * Here rather than a `useCallback` in the wrapper, and that is not a style preference.
   * A hook in the element wrapper makes the wrapper unable to be a React Server
   * Component, so the static player could not server-render a slide that had any elements
   * on it — and the failure was hidden twice over: `renderToString` is ordinary SSR where
   * hooks work fine, and the reference lesson's first slide is empty at time zero, so the
   * example app rendered zero wrappers and built cleanly.
   *
   * Memoised per id because React detaches and reattaches a ref whose identity changed,
   * which would unregister and re-register every element on every render.
   */
  refFor(elementId: string): (node: HTMLElement | null) => void
  /**
   * The registered node for an element, if it is mounted.
   *
   * Added so the DOM media port can find a slide's `<video>` without any renderer holding a
   * ref. The video and audio renderers are on the **server** path — they are in the static
   * renderer set — and a React Server Component may not carry a ref, so registration cannot
   * live in them. The writer already has every element's node for its own purposes, so
   * asking it is free and adds no second registry to keep in step.
   */
  nodeFor(elementId: string): HTMLElement | null
  write(state: RenderState): void
  clear(): void
}

export function createFrameWriter(): FrameWriter {
  const nodes = new Map<string, HTMLElement>()
  /** What was last written per element, so an unchanged frame costs nothing. */
  const written = new Map<string, string>()
  const refs = new Map<string, (node: HTMLElement | null) => void>()

  const writer: FrameWriter = {
    register(elementId, node) {
      if (node) {
        nodes.set(elementId, node)
      } else {
        nodes.delete(elementId)
        written.delete(elementId)
      }
    },

    nodeFor(elementId) {
      return nodes.get(elementId) ?? null
    },

    refFor(elementId) {
      let ref = refs.get(elementId)
      if (!ref) {
        ref = (node) => writer.register(elementId, node)
        refs.set(elementId, ref)
      }
      return ref
    },

    write(state) {
      for (const element of state.elements) {
        const node = nodes.get(element.id)
        if (!node) continue

        const properties = visualProperties(element)
        /**
         * will-change belongs here, not in the React render.
         *
         * It is derived from whether an effect is active — which is timing — and
         * React only re-renders when the *set* of visible elements changes. Applying
         * it during render therefore left it stale whenever time moved without
         * visibility changing, and the rendered-parity sweep caught exactly that:
         * seeking to 500ms produced different markup from stepping to 500ms.
         *
         * research R-06 said the value must come from the kernel rather than from
         * renderer state. The same reasoning applies to where it is applied: any
         * timing-derived value written on React's schedule can disagree with the
         * kernel's, and two models of animation is one too many.
         */
        const animating = element.activeEffects.length > 0
        if (animating) {
          node.style.setProperty('will-change', 'transform, opacity')
        } else {
          node.style.removeProperty('will-change')
        }
        // A cheap equality check: most frames change nothing for most elements, and
        // touching style is the expensive part.
        const signature = JSON.stringify(properties)
        if (written.get(element.id) === signature) continue
        written.set(element.id, signature)

        // Properties absent from the bag were removed, and must be cleared or the
        // stylesheet's fallback never applies again.
        for (const name of ['--cs-opacity', '--cs-tx', '--cs-ty', '--cs-sx', '--cs-sy', '--cs-rotate', '--cs-brightness', '--cs-blur']) {
          if (!(name in properties)) node.style.removeProperty(name)
        }
        for (const [name, value] of Object.entries(properties)) {
          node.style.setProperty(name, value)
        }
      }
    },

    clear() {
      nodes.clear()
      written.clear()
      // Not `refs`: a cleared writer may be written to again, and discarding the memoised
      // callbacks would hand React a new identity for every element on the next render.
    },
  }

  return writer
}
