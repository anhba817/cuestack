import type { ReactNode } from 'react'
import type { ResolvedElement } from '@cuestack/core'

export interface AssetFallbackProps {
  readonly element: ResolvedElement
  /** What kind of thing is missing, in the learner's terms. */
  readonly kind: 'image' | 'video' | 'audio'
}

/**
 * An asset that could not be addressed or could not be loaded.
 *
 * FR-018: keeps its reserved space and carries an accessible description. Both halves
 * matter and for different people — the space stops the slide reflowing around the gap
 * for a learner who can see it, and the description is the only thing a learner using a
 * screen reader gets at all.
 *
 * `role="img"` with a name, rather than a bare div: an announced description of what is
 * missing is useful, whereas an unlabelled box is noise the learner has to work out.
 * Where the author supplied alternative text, that text *is* the description — it was
 * written to convey what the asset conveys, which is exactly what is needed when the
 * asset is absent.
 *
 * No `alert` and no `status`. This is a static condition, not an event, and interrupting
 * a learner to announce a missing decorative image is worse than the missing image.
 */
export function AssetFallback({ element, kind }: AssetFallbackProps): ReactNode {
  const authored = element.accessibility?.altText ?? element.accessibility?.label
  const description = authored ?? `${KIND_LABEL[kind]} unavailable`

  return (
    <div className="cs-asset-fallback" role="img" aria-label={description}>
      <span className="cs-asset-fallback-text" aria-hidden="true">
        {description}
      </span>
    </div>
  )
}

const KIND_LABEL: Record<AssetFallbackProps['kind'], string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
}
