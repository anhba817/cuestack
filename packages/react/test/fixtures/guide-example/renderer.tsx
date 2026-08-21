import type { ReactNode } from 'react'
import type { ElementRenderer, ElementRendererProps } from '../../../src/elements/registry.js'

/**
 * The guide example's **second** piece, in a different package from its first.
 *
 * A plugin lives in `@cuestack/core` and describes the type; a renderer lives in an adapter and draws
 * it. Splitting them is what lets one type be drawn by React here and by a web component elsewhere
 * from the same plugin — and it is also the fact the guide exists to make visible, because no file in
 * the codebase states it.
 *
 * **Its absence is survivable**, unlike a missing plugin member: the element reports itself
 * unavailable and the rest of the slide still plays. Three pieces, three different failure modes.
 */
function Countdown({ element }: ElementRendererProps): ReactNode {
  const seconds = (element.payload as { seconds?: number } | undefined)?.seconds ?? 0
  // Text, not markup. A renderer that assembled HTML would be the injection route React's escaping
  // closes for free — and the reason `dangerouslySetInnerHTML` is banned repository-wide.
  return <span className="cs-countdown">{`${seconds}s`}</span>
}

// #region renderer
export const countdownRenderer: ElementRenderer = {
  type: 'countdown',
  Component: Countdown,
  /**
   * How assistive technology describes this type when the author gave no label of their own.
   *
   * Required, and easy to miss because nothing visual depends on it. A renderer without one is a
   * renderer whose elements are announced by their role and nothing else.
   */
  label: 'Countdown',
}
// #endregion renderer
