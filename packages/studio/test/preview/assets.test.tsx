import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor } from '../harness/editor.js'
import { assetLesson } from '../harness/preview.js'
import type { AssetResolver } from '@cuestack/react'

/**
 * The preview asks the host for the real asset.
 *
 * FR-003, and the reason it is a requirement rather than an assumption: a preview showing a
 * placeholder where the lesson has an image would make a broken slide look deliberate here
 * and broken in production. The resolver is the *editor's* — one function, so the canvas and
 * the preview cannot disagree about what an id points at.
 */

afterEach(cleanup)

afterEach(() => {
  /* nothing to restore: the resolver is a prop, not a global */
})

describe('assets resolve through the host’s function', () => {
  it('requests the source the editor’s resolver returns', () => {
    const asked: string[] = []
    const resolveAsset: AssetResolver = (ref) => {
      asked.push(ref.assetId)
      return `https://assets.example/${ref.assetId}`
    }
    const { container } = renderEditor(assetLesson(), { preview: 'beginning', resolveAsset })
    const preview = container.querySelector('.cs-preview') as HTMLElement
    const img = preview.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://assets.example/fx_image_asset')
    expect(asked).toContain('fx_image_asset')
  })

  it('shows the player’s own fallback when the resolver has nothing', () => {
    // Deliberately the same path a genuine load failure takes (FR-003, FR-PLY-011). A
    // preview that hid the difference would be the one place a teacher could not find out.
    const resolveAsset: AssetResolver = () => undefined
    const { container } = renderEditor(assetLesson(), { preview: 'beginning', resolveAsset })
    const preview = container.querySelector('.cs-preview') as HTMLElement
    expect(preview.querySelector('img')).toBeNull()
    // The fallback reserves the space and carries the description as its accessible name —
    // asserted there rather than in the text, because that is where a learner meets it.
    expect(preview.querySelector('.cs-asset-fallback')?.getAttribute('aria-label')).toContain(
      'A diagram',
    )
  })
})
