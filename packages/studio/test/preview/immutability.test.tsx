import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The preview has no way to change a lesson, and that is structural rather than careful.
 *
 * FR-026 says the preview must not be *able* to modify the draft. A behavioural test can show
 * that it did not; only the source can show that it could not. Both are here, and the source
 * check is the one that survives somebody adding a handler in six months.
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

const PREVIEW_DIR = join(repoRoot(), 'packages/studio/src/preview')
const files = ['Preview.tsx', 'PreviewControls.tsx', 'ViewportPreset.tsx', 'usePreviewSession.ts', 'startPoint.ts', 'constants.ts']
const source = (name: string): string => readFileSync(join(PREVIEW_DIR, name), 'utf8')

describe('nothing in the preview can write to a lesson', () => {
  it('calls no mutation path at all', () => {
    // `session.apply` is the only way to change a draft, and the reducer is the only thing
    // behind it. Neither is reachable from here — which is why the preview needs no read-only
    // branch of its own and cannot acquire one by accident.
    for (const file of files) {
      const text = source(file)
      expect(text, `${file} calls session.apply`).not.toMatch(/session\.apply/)
      expect(text, `${file} imports the reducer`).not.toMatch(/from '.*draft\/reducer/)
      expect(text, `${file} sets the authoring time`).not.toMatch(/setAuthoringTime/)
      expect(text, `${file} changes the selection`).not.toMatch(/session\.select/)
      expect(text, `${file} changes the slide`).not.toMatch(/session\.goToSlide/)
    }
  })

  it('reads the draft and passes it on, without copying or transforming it', () => {
    // A preview that reshaped the manifest before handing it over would be a second idea of
    // what the lesson is — and the divergence would be invisible, because both sides would
    // still render something.
    const preview = source('Preview.tsx')
    expect(preview).toContain('lesson={session.draft}')
    expect(preview).not.toMatch(/JSON\.parse\(JSON\.stringify/)
    expect(preview).not.toMatch(/structuredClone/)
  })

  it('holds its own state in a hook that dies with it', () => {
    // Start point, override, preset, generation — none of them on the session, so none of
    // them can outlive the preview or reach a manifest. SC-005 measures the outcome; this
    // asserts the mechanism that makes the outcome inevitable.
    const hook = source('usePreviewSession.ts')
    expect(hook).toMatch(/useState/)
    expect(hook).not.toMatch(/session\.(apply|select|goToSlide|setAuthoringTime)/)
  })
})
