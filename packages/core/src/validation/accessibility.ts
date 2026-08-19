import type { Element } from '@cuestack/schema'
import type { PluginIssue } from '../elements/contract.js'

/**
 * BR-012's rule, and it is the engine's rather than a plugin's.
 *
 * `accessibility` is a **common** element field — `altText`, `label`, `announce` — declared beside
 * `payload` rather than inside it, so `ElementPlugin.validate(payload)` cannot see it and could not
 * report on it if it wanted to. An earlier draft attributed this to plugins, which would also have
 * made the one policy-governed rule depend on every plugin author implementing it identically
 * (research R-10).
 *
 * What each type needs is a property of the type, so the requirement is expressed as a table rather
 * than as a branch: an image needs alt text, media needs a label, and a shape needs nothing because
 * a decorative rectangle with a description is noise in a screen reader.
 */

const NEEDS_ALT_TEXT = new Set(['image'])
const NEEDS_LABEL = new Set(['video', 'audio', 'button', 'question'])

/**
 * Per element rather than per slide, because the report's order is per element (FR-007) and a
 * slide-level pass would have to be re-sorted back into it by the one caller there is.
 */
export function accessibilityIssues(element: Element): readonly PluginIssue[] {
  const bag = (element as { accessibility?: { altText?: string; label?: string } }).accessibility
  const found: PluginIssue[] = []

  if (NEEDS_ALT_TEXT.has(element.type) && !bag?.altText?.trim()) {
    found.push({
      code: 'ACCESSIBILITY_METADATA_ABSENT',
      message:
        `The image "${element.id}" has no alternative text, so a learner using a screen reader is ` +
        'told only that an image is there. Describe what it shows, or mark it decorative if it ' +
        'carries nothing.',
    })
  }

  if (NEEDS_LABEL.has(element.type) && !bag?.label?.trim()) {
    found.push({
      code: 'ACCESSIBILITY_METADATA_ABSENT',
      message:
        `The ${element.type} "${element.id}" has no accessible name, so it is announced only by ` +
        'its role. Give it a label saying what it is for.',
    })
  }

  return found
}
