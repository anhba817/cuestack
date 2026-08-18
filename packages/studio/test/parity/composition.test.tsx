import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { renderEditor } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'

/**
 * The preview mounts the player, unmodified.
 *
 * The claim the whole feature rests on, asserted two ways because neither alone is enough.
 * The rendered output can be inspected for leaked affordances; it cannot see a prop that was
 * added to a player component to make a preview possible. The source can see the prop; it
 * cannot see what actually rendered.
 *
 * The pair to read this beside is `overlay.test.tsx`'s "adds no editor prop to SlideView" —
 * that one guards the canvas, this one the preview.
 */

afterEach(cleanup)

/**
 * Read a source file relative to the repository root.
 *
 * Found by walking up to the workspace marker rather than assuming `process.cwd()`: it is the
 * workspace root under vitest's project runner and the package directory under a bare
 * `vitest` invocation, and a test that reads the wrong file passes for the wrong reason.
 */
function repoRoot(): string {
  let dir = process.cwd()
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const up = dirname(dir)
    if (up === dir) throw new Error('No pnpm-workspace.yaml above the working directory.')
    dir = up
  }
  return dir
}

const REPO = repoRoot()
const src = (path: string): string => readFileSync(join(REPO, path), 'utf8')

describe('the rendered preview carries nothing of the editor', () => {
  it('contains no editor markup', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const stage = container.querySelector('.cs-preview .cs-stage') as HTMLElement
    expect(stage.querySelector('.cs-overlay')).toBeNull()
    expect(stage.querySelector('[data-cs-editor]')).toBeNull()
    expect(stage.innerHTML).not.toContain('cs-handle')
  })
})

describe('no player component was changed to make a preview possible', () => {
  /**
   * Feature 007 adds exactly two things to `@cuestack/react`, and both are named here so a
   * third arrives as a decision rather than a diff nobody read.
   *
   *   `overrideAdvance`  a host option, absent by default, whose absence is the guarantee.
   *   `ports: Partial`   the fallback merged per member instead of replaced wholesale.
   *
   * Neither is preview-shaped: nothing in the player knows what an editor is.
   */
  it('adds no preview-shaped prop to the player', () => {
    const player = src('packages/react/src/player/LessonPlayerClient.tsx')
    for (const forbidden of ['preview', 'editor', 'authoring', 'studio']) {
      const props = player.slice(0, player.indexOf('const DEFAULT_RENDERERS'))
      expect(
        new RegExp(`readonly\\s+\\w*${forbidden}\\w*\\??:`, 'i').test(props),
        `the player gained a ${forbidden}-shaped prop`,
      ).toBe(false)
    }
  })

  it('leaves the studio importing the player rather than reimplementing it', () => {
    const preview = src('packages/studio/src/preview/Preview.tsx')
    expect(preview).toContain("from '@cuestack/react'")
    // No second renderer registry, no second clock, no second effect implementation.
    expect(preview).not.toContain('createRendererRegistry')
    expect(preview).not.toContain('createTransport')
    expect(preview).not.toContain('createFrameWriter')
    expect(preview).not.toContain('useFrameLoop')
  })

  it('renders no completion state of its own', () => {
    // The player renders `<LessonComplete>` itself. A second one here would be the forked
    // path Constitution V forbids, and it would double the message rather than replace it.
    //
    // Matched on the import and the element, not on the word: the component's own
    // documentation explains *why* it does not render one, and a substring check would fail
    // on the explanation — which is the kind of test that gets deleted rather than fixed.
    const preview = src('packages/studio/src/preview/Preview.tsx')
    expect(preview).not.toMatch(/import\s*\{[^}]*LessonComplete/)
    expect(preview).not.toContain('<LessonComplete')
  })
})
