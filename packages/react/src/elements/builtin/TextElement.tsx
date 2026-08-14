import type { ReactNode } from 'react'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'

/**
 * Text. All typography resolves from theme properties in the stylesheet — there is no
 * style object here at all, which is the simplest way to satisfy FR-014.
 */
function TextComponent({ element }: ElementRendererProps): ReactNode {
  const payload = element.payload as { text?: string } | undefined
  return <div className="cs-element-text">{payload?.text ?? ''}</div>
}

export const textRenderer: ElementRenderer = {
  type: 'text',
  Component: TextComponent,
  label: 'Text',
}
