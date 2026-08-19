import type { VisibilityPort } from '@cuestack/core'

/**
 * Write what is outstanding before the page goes away.
 *
 * FR-024a keeps work on the save schedule rather than on every change, because `localStorage`
 * is synchronous and the write is a whole manifest — per keystroke it would sit between a key
 * press and the character appearing. That leaves a window of up to one interval, and this
 * closes it in the ordinary case.
 *
 * **The hidden signal comes through `VisibilityPort`**, which already exists in `@cuestack/core`
 * and already has a browser implementation inside `browserPorts()`. Using it makes the flush
 * injectable — a test flips a fake rather than dispatching a DOM event — which is what
 * Constitution II asks for and what every other timing seam in this feature already does.
 *
 * A raw `pagehide` listener sits beside it for what the port does not model: `visibilitychange`
 * does not fire on every navigation away, and a synchronous write is exactly what survives one.
 *
 * The guard is load-bearing. `visibilitychange` fires on every tab switch, so flushing
 * unconditionally would reintroduce the cost FR-024a exists to avoid; with nothing outstanding
 * there is nothing to write.
 */
export function onPageHidden(
  visibility: VisibilityPort | undefined,
  flush: () => void,
): () => void {
  const unsubscribe = visibility?.subscribe((hidden) => {
    if (hidden) flush()
  })

  const onPageHide = (): void => flush()
  const hasWindow = typeof window !== 'undefined'
  if (hasWindow) window.addEventListener('pagehide', onPageHide)

  return () => {
    unsubscribe?.()
    if (hasWindow) window.removeEventListener('pagehide', onPageHide)
  }
}
