import { describe, expect, it } from 'vitest'
import { exportLesson } from '../../src/packaging/index.js'
import { validate } from '@cuestack/schema/validate'
import { invalidLesson } from '../harness/packages.js'

/**
 * FR-008. Exporting is not publishing.
 *
 * A teacher's broken lesson is still theirs, and refusing to hand it over is the lock-in this
 * feature exists to prevent — arriving as a helpful-sounding validation step.
 */
describe('exporting a lesson that fails validation', () => {
  it('is refused by the format, so the fixture is doing what it claims', () => {
    expect(validate(invalidLesson()).ok).toBe(false)
  })

  it('succeeds anyway', () => {
    const pkg = exportLesson(invalidLesson(), { kind: 'draft' })
    expect(pkg.lesson).toEqual(invalidLesson())
    expect(pkg.kind).toBe('draft')
  })

  it('does not quietly repair what it was given', () => {
    // A producer that normalised the manifest would make round-tripping lossy in a way nobody asked
    // for, and would hide the fault from the person who has to fix it.
    const pkg = exportLesson(invalidLesson(), { kind: 'draft' })
    expect(pkg.lesson.slides[0]!.durationMs).toBe(-1)
  })
})
