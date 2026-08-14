/**
 * Every `--cs-*` custom property, declared once.
 *
 * The stylesheet consumes these names and the frame writer produces them. Two
 * places naming the same thing is two places to misspell it, and a misspelt custom
 * property does not error — it silently falls back, which looks like a positioning
 * bug and is not one.
 */
export const CANVAS_WIDTH = '--cs-canvas-w'
export const CANVAS_HEIGHT = '--cs-canvas-h'

export const GEOMETRY = {
  x: '--cs-x',
  y: '--cs-y',
  width: '--cs-w',
  height: '--cs-h',
  rotation: '--cs-rotation',
  zIndex: '--cs-z',
} as const

export const VISUAL = {
  opacity: '--cs-opacity',
  translateX: '--cs-tx',
  translateY: '--cs-ty',
  scaleX: '--cs-sx',
  scaleY: '--cs-sy',
  rotate: '--cs-rotate',
  brightness: '--cs-brightness',
  blur: '--cs-blur',
} as const

/** A theme token becomes `--cs-theme-<token>`, with dots flattened to dashes. */
export function themeProperty(token: string): string {
  return `--cs-theme-${token.replace(/\./g, '-')}`
}

export type PropertyBag = Record<string, string>
