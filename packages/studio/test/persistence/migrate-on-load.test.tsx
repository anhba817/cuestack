import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDraftRecovery, type DraftRecovery } from '../../src/persistence/useDraftRecovery.js'
import { recordingStorage } from '../harness/storage.js'
import { lessonWith, element } from '../harness/corpus.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * Every lesson from storage is brought forward before anything sees it.
 *
 * `migrate()` has been in `@cuestack/schema` since Wave 1 with **no consumer anywhere**,
 * because nothing had ever loaded a lesson it did not itself construct. This feature loads one
 * twice — on open and on restore — and once restoring goes through `applyEdit` the question
 * stops being academic: the validator judges against the *current* schema, so a version
 * written under an earlier format would be refused and the refusal would look like data
 * corruption to a teacher whose lesson is perfectly intact (FR-050, research R-14).
 */
afterEach(cleanup)

function open(storage: ReturnType<typeof recordingStorage>) {
  const holder = { recovery: undefined as unknown as DraftRecovery }
  function Harness(): React.ReactNode {
    holder.recovery = useDraftRecovery({ storage, lessonId: 'lesson' })
    return null
  }
  render(<Harness />)
  return holder
}

const fromTheFuture = (): LessonManifest =>
  ({ ...lessonWith([element()]), schemaVersion: '99.0' } as unknown) as LessonManifest

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('a lesson already at the current format', () => {
  it('passes through unchanged', async () => {
    const storage = recordingStorage()
    const original = lessonWith([element({ id: 'a', effects: [], width: 123 })])
    storage.seed('lesson', original)

    const holder = open(storage)
    await settle()
    expect(holder.recovery.status).toBe('ready')
    expect(holder.recovery.manifest?.slides[0]!.elements[0]!.width).toBe(123)
  })
})

describe('a lesson that cannot be brought forward', () => {
  it('is reported rather than loaded (FR-050)', async () => {
    const storage = recordingStorage()
    // A version stamp from a future the editor knows nothing about. The double cast is the
    // honest way to say so: the type system's whole job is to make this unconstructible, and
    // what is being tested is what happens when storage returns one anyway.
    storage.seed('lesson', fromTheFuture())

    const holder = open(storage)
    await settle()
    expect(holder.recovery.status).toBe('failed')
    expect(holder.recovery.manifest).toBeNull()
  })

  it('names the lesson and says nothing was changed', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', fromTheFuture())

    const holder = open(storage)
    await settle()
    expect(holder.recovery.message).toMatch(/lesson/i)
    expect(holder.recovery.message).toMatch(/nothing has been changed/i)
  })
})

describe('a lesson that cannot be reached', () => {
  it('says so, and says what to try', async () => {
    const storage = recordingStorage()
    storage.fail('unavailable')
    const holder = open(storage)
    await settle()

    expect(holder.recovery.status).toBe('failed')
    expect(holder.recovery.message).toMatch(/connection/i)
  })

  it('distinguishes permission from unreachable', async () => {
    const storage = recordingStorage()
    storage.fail('unauthorized')
    const holder = open(storage)
    await settle()
    expect(holder.recovery.message).toMatch(/permission/i)
  })
})
