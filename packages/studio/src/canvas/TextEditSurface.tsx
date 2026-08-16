import { useEffect, useRef, type ReactNode } from 'react'
import type { Element } from '@cuestack/schema'

export interface TextEditSurfaceProps {
  readonly element: Element
  readonly value: string
  readonly onInput: (text: string) => void
  readonly onCommit: () => void
}

/**
 * Editing text in place, without forking the renderer.
 *
 * This is the one deliberate deviation from Constitution V that the plan declares, and the
 * whole of its bound is in the class name below.
 *
 * The tension: FR-CAN-005 wants text edited where it sits, and something focusable with a
 * caret has to be there; FR-043 says affordances live outside the element renderers. It
 * resolves on a property of this codebase rather than a general principle. `TextElement.tsx`
 * is four lines and its comment says so — "All typography resolves from theme properties in
 * the stylesheet — there is no style object here at all." Font, size, line height, wrapping,
 * and the small-size floor all live in `.cs-element-text` in `stage.css`. So a surface
 * carrying that class renders text identically **without sharing a line of component code**.
 *
 * What FR-017 forbids — a second way of *rendering* the element's text — therefore does not
 * appear. There is one styling authority, and it is the stylesheet.
 *
 * The honest limit, stated because it would otherwise be discovered: while editing, two DOM
 * nodes carry the text. It is bounded by the surface existing only in an explicit edit mode,
 * living outside the renderer, and being unable to exist during playback because the player
 * has no overlay. `text-surface.test.tsx` is what keeps the claim true — if the committed
 * text ever renders differently from what the surface showed, that test fails rather than a
 * teacher noticing their heading reflow on commit (research R-05).
 */
export function TextEditSurface({
  element,
  value,
  onInput,
  onCommit,
}: TextEditSurfaceProps): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <textarea
      ref={ref}
      className="cs-element-text cs-text-surface"
      data-cs-text-surface=""
      data-cs-element-id={element.id}
      aria-label={`Edit text of ${element.accessibility?.label ?? element.type}`}
      value={value}
      onChange={(event) => onInput(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        // Escape and Ctrl/Cmd+Enter leave edit mode. Plain Enter must not: a text element
        // may legitimately contain line breaks, and a teacher pressing Return expects one.
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
          event.preventDefault()
          onCommit()
        }
        // While editing, the canvas's shortcuts must not fire — typing `d` inserts a `d`
        // rather than duplicating the element (FR-016).
        event.stopPropagation()
      }}
      style={
        {
          '--cs-x': String(element.x),
          '--cs-y': String(element.y),
          '--cs-w': String(element.width),
          '--cs-h': String(element.height),
        } as React.CSSProperties
      }
    />
  )
}
