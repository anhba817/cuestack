import type { ResolvedElement } from '@cuestack/core'

/**
 * What a learner sees where this adapter cannot show something.
 *
 * **The ordinary path, not the edge one** — four of the seven element types take it, so this is
 * closer to a feature than to an error case. It occupies the element's geometry rather than
 * collapsing, so a slide does not reflow around a hole, and it says which type it could not show.
 *
 * The React player answers the same question for an unregistered type, and the wording follows it
 * rather than inventing a second vocabulary: a learner meeting two different apologies depending on
 * which adapter their school runs is the failure worth avoiding.
 */
export function unavailableNode(element: ResolvedElement, doc: Document): HTMLElement {
  const node = doc.createElement('div')
  node.className = 'cs-unavailable'
  /**
   * A data hook alongside the class, matching `data-cs-element-id`: styling is the class's job and
   * identifying-this-thing is the attribute's, so a theme that restyles the notice cannot break a
   * test. Deliberately not `data-cs-unavailable` — the *frame* carries that, and a selector matching
   * both would find the wrapper first and read no role off it.
   */
  node.setAttribute('data-cs-notice', element.type)
  // A word, not a colour. Somebody using a screen reader gets the same information as somebody
  // looking at the dashed border (NFR-ACC-003).
  node.textContent = `This ${element.type} cannot be shown here.`
  node.setAttribute('role', 'note')

  const described = element.accessibility?.label ?? element.accessibility?.altText
  if (described) node.setAttribute('aria-label', `${described} — cannot be shown here`)

  return node
}
