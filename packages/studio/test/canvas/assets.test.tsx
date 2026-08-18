import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import type { AssetResolver } from '@cuestack/react'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The canvas resolves assets the way the player does.
 *
 * **A gap the editor already had, found by asking a question about the preview.** `SlideView`
 * has accepted a resolver since Wave 3 and `EditorCanvas` has never passed one, so a host
 * supplying a resolver to `<LessonPlayer>` could not supply one to the canvas: every image in
 * the editor fell through `defaultAssetResolver`, which resolves nothing that is not already
 * a locator. It looked correct because the reference lesson's asset ids are opaque and
 * nothing serves them, so the fallback was what a teacher saw either way.
 *
 * It matters here because the preview inherits the *editor's* resolver (FR-003). A preview
 * taking its own would let the canvas and the preview disagree about what an asset id means,
 * which is the parity failure this feature exists to prevent, one layer down.
 */

afterEach(cleanup)

const imageLesson = (): LessonManifest =>
  lessonOf([
    slide([
      element({
        id: 'fx-picture',
        type: 'image',
        payload: { asset: { assetId: 'worker_image', mimeType: 'image/png' }, altText: 'A worker' },
      }),
    ]),
  ])

function Harness({
  manifest,
  resolveAsset,
}: {
  manifest: LessonManifest
  resolveAsset?: AssetResolver
}): React.ReactNode {
  const session = useEditorSession({ manifest, slideId: manifest.slides[0]!.id })
  return <EditorCanvas session={session} {...(resolveAsset ? { resolveAsset } : {})} />
}

describe('a host resolver reaches the canvas', () => {
  it('renders the source the resolver returns', () => {
    const asked: string[] = []
    const resolveAsset: AssetResolver = (ref) => {
      asked.push(ref.assetId)
      return `https://assets.example/${ref.assetId}.png`
    }
    const { container } = render(<Harness manifest={imageLesson()} resolveAsset={resolveAsset} />)

    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://assets.example/worker_image.png')
    expect(asked).toContain('worker_image')
  })

  it('falls back to the default resolver when the host supplies none', () => {
    // The negative control, and the reason the gap survived two features: with no resolver
    // an opaque id is unresolvable, so the element renders its fallback — which is correct
    // behaviour and indistinguishable from a canvas that never asked.
    const { container } = render(<Harness manifest={imageLesson()} />)
    expect(container.querySelector('img')).toBeNull()
  })
})
