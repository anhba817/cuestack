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
  write(state: RenderState): void
  clear(): void
}

export function createFrameWriter(): FrameWriter {
  const nodes = new Map<string, HTMLElement>()
  /** What was last written per element, so an unchanged frame costs nothing. */
  const written = new Map<string, string>()

  return {
    register(elementId, node) {
      if (node) {
        nodes.set(elementId, node)
      } else {
        nodes.delete(elementId)
        written.delete(elementId)
      }
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
    },
  }
}
