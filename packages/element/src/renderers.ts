import type { ResolvedElement } from '@cuestack/core'
import { covers } from './covered.js'
import { unavailableNode } from './unavailable.js'

/**
 * The covered types, drawn.
 *
 * **Author-supplied content reaches the DOM through `textContent` and attribute assignment, never
 * through markup.** React escaped children for us and banned its own escape hatch; neither
 * protection survives the move to a custom element, and a lesson imported from elsewhere may have
 * been written by anybody. A lint rule forbids `innerHTML` in this package, and the escaping suite
 * proves what the rule protects.
 *
 * Registry-driven rather than branch-driven: `covers()` is the single list, so a type cannot be
 * rendered here and apologised for elsewhere.
 */

export type AssetResolver = (assetId: string) => string | undefined

const text = (element: ResolvedElement, doc: Document): HTMLElement => {
  const node = doc.createElement('div')
  const payload = element.payload as { text?: unknown } | undefined
  node.textContent = typeof payload?.text === 'string' ? payload.text : ''
  return node
}

const shape = (element: ResolvedElement, doc: Document): HTMLElement => {
  const node = doc.createElement('div')
  const payload = element.payload as { shape?: unknown } | undefined
  node.dataset['csShape'] = typeof payload?.shape === 'string' ? payload.shape : 'rect'
  // A decorative rectangle described to a screen reader is noise, so it is hidden from one unless
  // the author gave it a label.
  if (!element.accessibility?.label) node.setAttribute('aria-hidden', 'true')
  return node
}

const image = (
  element: ResolvedElement,
  doc: Document,
  resolveAsset: AssetResolver | undefined,
): HTMLElement | null => {
  const payload = element.payload as { asset?: { assetId?: unknown } } | undefined
  const assetId = payload?.asset?.assetId
  if (typeof assetId !== 'string' || !resolveAsset) return null

  const src = resolveAsset(assetId)
  if (!src) return null

  const node = doc.createElement('div')
  const img = doc.createElement('img')
  img.setAttribute('src', src)
  // The author's words, carried through rather than invented — and set as an attribute, so markup
  // in them is a string rather than a tag.
  img.setAttribute('alt', element.accessibility?.altText ?? '')
  node.append(img)
  return node
}

export function renderElement(
  element: ResolvedElement,
  doc: Document,
  resolveAsset?: AssetResolver,
): HTMLElement {
  /**
   * `available` is the kernel's answer for a type no registry knows. Honoured first, so an
   * unregistered type takes the same path as one this adapter declines — a learner should not be
   * able to tell the two apart, because to them they are the same thing.
   */
  if (!element.available || !covers(element.type)) return unavailableNode(element, doc)

  const drawn =
    element.type === 'text'
      ? text(element, doc)
      : element.type === 'shape'
        ? shape(element, doc)
        : image(element, doc, resolveAsset)

  // An image with no resolver is something this adapter cannot show, and it says so in the same
  // words as everything else rather than rendering a broken picture.
  return drawn ?? unavailableNode(element, doc)
}
