import type { LessonManifest } from '@cuestack/schema'
import type { Ports } from '@cuestack/core'

/**
 * Mount a `<cuestack-lesson>` with a clock a test drives by hand.
 *
 * Nothing here waits on wall-clock time. Constitution II forbids a timing test that sleeps, and the
 * transport takes its time source as a port precisely so no test has to — the same shape every
 * timing suite in this repository has used since Wave 1.
 */

export interface Mounted {
  readonly element: HTMLElement
  /** The shadow root, which is where everything this adapter writes lives. */
  readonly root: ShadowRoot
  /** Move the lesson clock, then let the frame loop run. */
  advance(ms: number): Promise<void>
  unmount(): void
}

export function fakePorts(): Pick<Ports, 'time' | 'visibility'> & { tick(ms: number): void } {
  let now = 0
  const listeners = new Set<(hidden: boolean) => void>()
  return {
    time: () => now,
    visibility: {
      isHidden: () => false,
      subscribe(listener) {
        listeners.add(listener)
        return () => void listeners.delete(listener)
      },
    },
    tick: (ms) => {
      now += ms
    },
  }
}

/** One frame, scheduled the way the element schedules its own. */
export const frame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

export async function mount(
  manifest: LessonManifest,
  options: {
    resolveAsset?: (assetId: string) => string | undefined
    /**
     * Attached before the element is connected, which is what a host does — `addEventListener`
     * then `append`. A listener added afterwards misses anything reported on the first frame.
     */
    on?: Record<string, (event: Event) => void>
    /**
     * Defaults to true, mirroring `autoPlay: true` in the React suite's `play()` helper.
     *
     * The element does not play by itself — the contract says an absent `autoplay` means the host
     * calls `play()` — so a harness that never set it would test the seek path and call it playback.
     */
    autoplay?: boolean
  } = {},
): Promise<Mounted> {
  // Imported here rather than at module scope so the custom element is defined by the time a test
  // creates one — a definition that runs after `document.createElement` yields an unupgraded node.
  await import('../../src/index.js')

  const ports = fakePorts()
  const element = document.createElement('cuestack-lesson')
  const withProps = element as HTMLElement & {
    manifest?: LessonManifest
    ports?: unknown
    resolveAsset?: (assetId: string) => string | undefined
  }
  if (options.autoplay !== false) element.setAttribute('autoplay', '')
  withProps.ports = ports
  if (options.resolveAsset) withProps.resolveAsset = options.resolveAsset
  withProps.manifest = manifest

  for (const [name, listener] of Object.entries(options.on ?? {})) {
    element.addEventListener(name, listener)
  }

  document.body.append(element)
  await frame()

  return {
    element,
    root: element.shadowRoot!,
    async advance(ms) {
      // In steps, because the kernel clamps a single tick — machine sleep and a paused debugger
      // produce enormous deltas and none of them happened to the learner.
      for (let elapsed = 0; elapsed < ms; elapsed += 100) {
        ports.tick(Math.min(100, ms - elapsed))
        await frame()
      }
    },
    unmount() {
      element.remove()
    },
  }
}

/** Every element the adapter wrote, by its manifest id. */
export const rendered = (root: ShadowRoot): Map<string, HTMLElement> =>
  new Map(
    [...root.querySelectorAll<HTMLElement>('[data-cs-element-id]')].map((node) => [
      node.dataset['csElementId']!,
      node,
    ]),
  )
