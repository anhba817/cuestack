import { describe, expect, it } from 'vitest'
import { migrate } from '@cuestack/schema/migrate'
import { exportLesson, importLesson, readPackage } from '../../src/packaging/index.js'
import { withoutAssets } from '../harness/packages.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * A genuine 0.9 document, not a 1.0 one relabelled.
 *
 * `v0_9_to_1_0` moves `metadata` to `lesson`, so a relabelled 1.0 lesson migrates to one with
 * `lesson: undefined` and fails `migrate`'s own final validation. Discovered by trying it.
 */
const asVersion = (version: string): string => {
  const current = withoutAssets()
  const lesson =
    version === '0.9'
      ? ({ schemaVersion: '0.9', metadata: current.lesson, slides: current.slides } as unknown as LessonManifest)
      : ({ ...current, schemaVersion: version } as unknown as LessonManifest)
  return JSON.stringify({ ...exportLesson(lesson, { kind: 'draft' }), schemaVersion: version })
}

describe('lesson versions on import', () => {
  it('migrates an older lesson and reports which steps ran', () => {
    const read = readPackage(asVersion('0.9'))
    if (!read.ok) throw new Error('unreachable')

    const result = importLesson(read.package, { lessonId: 'mine' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.migrated.length).toBeGreaterThan(0)
    expect(result.migrated[0]).toContain('0.9')
    expect(result.lesson.schemaVersion).toBe('1.0')
  })

  it('reports no migration when there was none', () => {
    const read = readPackage(asVersion('1.0'))
    if (!read.ok) throw new Error('unreachable')
    const result = importLesson(read.package, { lessonId: 'mine' })
    if (!result.ok) throw new Error('unreachable')
    expect(result.migrated).toEqual([])
  })

  it("refuses a newer lesson carrying migrate's own issues rather than restating them", () => {
    /**
     * Research R-05. `migrate` already refuses an unknown version *and* distinguishes newer from
     * older, with a message worth quoting. A second message about the same fact is how two version
     * checks come to disagree — so this asserts the words came from there.
     */
    const read = readPackage(asVersion('9.9'))
    if (!read.ok) throw new Error('unreachable')

    const result = importLesson(read.package, { lessonId: 'mine' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('lesson-version-unsupported')

    const direct = migrate(JSON.parse(asVersion('9.9')).lesson)
    if (direct.ok) throw new Error('unreachable')
    expect(result.issues.map((i) => i.message)).toEqual(direct.issues.map((i) => i.message))
  })

  it('refuses an unknown *package* version by its own check', () => {
    const read = readPackage(JSON.stringify({ ...JSON.parse(asVersion('1.0')), packageVersion: '2.0' }))
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.reason).toBe('package-version-unsupported')
  })
})
