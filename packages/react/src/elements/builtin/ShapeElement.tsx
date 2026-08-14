import type { ReactNode } from 'react'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'

type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow'

/**
 * A shape, as inline SVG.
 *
 * `aria-hidden` deliberately: a rectangle has nothing to announce, and a screen
 * reader stopping on it wastes a learner's time. An author who needs a shape
 * described should use an image with alternative text.
 *
 * Fill comes from a theme property with a readable fallback — a shape that renders
 * transparent because a token was missing looks like a bug in the lesson.
 */
function ShapeComponent({ element }: ElementRendererProps): ReactNode {
  const payload = element.payload as { shape?: ShapeKind } | undefined
  const kind = payload?.shape ?? 'rect'
  const fill = 'var(--cs-theme-accent-primary, currentColor)'

  return (
    <svg
      className="cs-element-shape"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'ellipse' ? (
        <ellipse cx="50" cy="50" rx="50" ry="50" fill={fill} />
      ) : kind === 'line' ? (
        <line x1="0" y1="50" x2="100" y2="50" stroke={fill} strokeWidth="4" />
      ) : kind === 'arrow' ? (
        <polygon points="0,40 70,40 70,20 100,50 70,80 70,60 0,60" fill={fill} />
      ) : (
        <rect x="0" y="0" width="100" height="100" fill={fill} />
      )}
    </svg>
  )
}

export const shapeRenderer: ElementRenderer = {
  type: 'shape',
  Component: ShapeComponent,
  label: 'Shape',
}
