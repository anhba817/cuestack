import type { ValidationIssue } from './issues.js'

/**
 * Tier 2. These rules need the whole document, so they cannot be expressed in a
 * per-node schema. They run only when Tier 1 is clean: referential errors over a
 * structurally broken document are usually consequences of the structural
 * fault, and reporting them is noise rather than information.
 */

interface Element {
  id: string
  type: string
  effects?: Array<{ id: string }>
  payload?: Record<string, unknown>
}

interface Slide {
  id: string
  elements: Element[]
  advance: { mode: string; mediaElementId?: string; interactionElementId?: string }
}

interface Manifest {
  slides: Slide[]
}

const MEDIA_TYPES = new Set(['video', 'audio'])

function duplicate(
  issues: ValidationIssue[],
  id: string,
  path: Array<string | number>,
  location: ValidationIssue['location'],
  scope: string,
): void {
  issues.push({
    code: 'DUPLICATE_ID',
    path,
    location,
    message: `Duplicate id "${id}" within ${scope}. Ids must be unique so a reference can name exactly one thing.`,
  })
}

export function checkReferences(manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenSlideIds = new Set<string>()

  manifest.slides.forEach((slide, slideIndex) => {
    const base = { slideId: slide.id, slideIndex }

    if (seenSlideIds.has(slide.id)) {
      duplicate(issues, slide.id, ['slides', slideIndex, 'id'], { ...base, field: 'id' }, 'the lesson')
    }
    seenSlideIds.add(slide.id)

    const seenElementIds = new Set<string>()
    const byId = new Map<string, Element>()

    slide.elements.forEach((element, elementIndex) => {
      const at = { ...base, elementId: element.id, elementIndex }
      if (seenElementIds.has(element.id)) {
        duplicate(
          issues,
          element.id,
          ['slides', slideIndex, 'elements', elementIndex, 'id'],
          { ...at, field: 'id' },
          'the slide',
        )
      }
      seenElementIds.add(element.id)
      byId.set(element.id, element)

      const seenEffectIds = new Set<string>()
      element.effects?.forEach((effect, effectIndex) => {
        if (seenEffectIds.has(effect.id)) {
          duplicate(
            issues,
            effect.id,
            ['slides', slideIndex, 'elements', elementIndex, 'effects', effectIndex, 'id'],
            { ...at, field: 'id' },
            'the element',
          )
        }
        seenEffectIds.add(effect.id)
      })

      // Option ids must be unique, else correctResponse is ambiguous.
      const options = element.payload?.['options'] as Array<{ id: string }> | undefined
      if (options) {
        const seenOptionIds = new Set<string>()
        options.forEach((option, optionIndex) => {
          if (seenOptionIds.has(option.id)) {
            duplicate(
              issues,
              option.id,
              ['slides', slideIndex, 'elements', elementIndex, 'payload', 'options', optionIndex, 'id'],
              { ...at, field: 'id' },
              'the interaction',
            )
          }
          seenOptionIds.add(option.id)
        })

        const correct = element.payload?.['correctResponse']
        const expected = Array.isArray(correct) ? correct : [correct]
        const known = new Set(options.map((o) => o.id))
        for (const answer of expected) {
          if (typeof answer === 'string' && !known.has(answer)) {
            issues.push({
              code: 'CORRECT_RESPONSE_UNKNOWN_OPTION',
              path: ['slides', slideIndex, 'elements', elementIndex, 'payload', 'correctResponse'],
              location: { ...at, field: 'correctResponse' },
              message: `correctResponse "${answer}" names no option on this interaction.`,
            })
          }
        }
      }
    })

    // BR-006: media-end advancement must reference an existing playable media
    // element on THIS slide. A reference to another slide's video would wait
    // forever on a slide where nothing is playing.
    const advance = slide.advance
    if (advance.mode === 'after_media_ends') {
      /* v8 ignore next -- schema requires mediaElementId; guard is belt-and-braces */
      const target = advance.mediaElementId ? byId.get(advance.mediaElementId) : undefined
      const at = { ...base, field: 'mediaElementId' }
      const path = ['slides', slideIndex, 'advance', 'mediaElementId']
      if (!target) {
        issues.push({
          code: 'ADVANCE_MEDIA_NOT_FOUND',
          rule: 'BR-006',
          path,
          location: at,
          message: `Slide advances after media "${advance.mediaElementId}" ends, but no such element exists on this slide.`,
        })
      } else if (!MEDIA_TYPES.has(target.type)) {
        issues.push({
          code: 'ADVANCE_MEDIA_WRONG_TYPE',
          rule: 'BR-006',
          path,
          location: { ...at, elementId: target.id },
          message: `Slide advances after media "${target.id}" ends, but that element is a ${target.type}, which never ends.`,
        })
      }
    }

    if (advance.mode === 'after_interaction') {
      /* v8 ignore next -- schema requires interactionElementId; guard is belt-and-braces */
      const target = advance.interactionElementId ? byId.get(advance.interactionElementId) : undefined
      const at = { ...base, field: 'interactionElementId' }
      const path = ['slides', slideIndex, 'advance', 'interactionElementId']
      if (!target || target.type !== 'question') {
        issues.push({
          code: 'ADVANCE_INTERACTION_NOT_FOUND',
          path,
          location: at,
          message: `Slide advances after interaction "${advance.interactionElementId}" completes, but no question element with that id exists on this slide.`,
        })
      } else if (target.payload?.['required'] !== true) {
        issues.push({
          code: 'ADVANCE_INTERACTION_NOT_REQUIRED',
          rule: 'BR-005',
          path,
          location: { ...at, elementId: target.id },
          message: `Slide advances after interaction "${target.id}" completes, but that question is optional — the slide could never advance.`,
        })
      }
    }
  })

  return issues
}
