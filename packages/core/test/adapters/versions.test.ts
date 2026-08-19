import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../../src/adapters/memory/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * Loading an earlier version, and the token it comes back with.
 *
 * `loadVersion` closes a gap that was not difficulty but impossibility: FR-DAT-009 asks a
 * teacher to restore an earlier draft, and until feature 008 this interface could load only
 * the current one.
 *
 * **The token assertion is the load-bearing one.** What comes back is content to be saved
 * *forward* as a new version (FR-DAT-010), so `loadVersion` returns the **current** draft's
 * token. Return the loaded version's and the very next save reads as a conflict — a restore
 * that looks correct until the moment it is saved, which is the worst kind of wrong.
 */
describe('loading an earlier version', () => {
  const now = () => 1_700_000_000_000

  async function threeCheckpoints() {
    const storage = createMemoryStorage({ now })
    let token = 'unset'
    const tokens: string[] = []
    for (let i = 1; i <= 3; i++) {
      const r = await storage.saveDraft('l1', lessonOf({ slides: i }), token, { checkpoint: {} })
      if (!r.ok) throw new Error('setup')
      token = r.token
      tokens.push(r.token)
    }
    return { storage, tokens, current: token }
  }

  it('returns the content stored at that version', async () => {
    const { storage, tokens } = await threeCheckpoints()
    const loaded = await storage.loadVersion('l1', tokens[0]!)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides).toHaveLength(1)
  })

  it('returns the CURRENT draft’s token, not the loaded version’s', async () => {
    const { storage, tokens, current } = await threeCheckpoints()
    const loaded = await storage.loadVersion('l1', tokens[0]!)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.token).toBe(current)
    expect(loaded.token).not.toBe(tokens[0])
  })

  it('so saving the loaded content forward succeeds rather than conflicting', async () => {
    const { storage, tokens } = await threeCheckpoints()
    const loaded = await storage.loadVersion('l1', tokens[0]!)
    if (!loaded.ok) throw new Error('setup')

    const saved = await storage.saveDraft('l1', loaded.manifest, loaded.token, { checkpoint: {} })
    expect(saved.ok).toBe(true)
  })

  it('and restoring removes no later checkpoint', async () => {
    const { storage, tokens } = await threeCheckpoints()
    const loaded = await storage.loadVersion('l1', tokens[0]!)
    if (!loaded.ok) throw new Error('setup')
    await storage.saveDraft('l1', loaded.manifest, loaded.token, { checkpoint: {} })

    const entries = await storage.listVersions('l1')
    expect(entries).toHaveLength(4)
    expect(entries.map((e) => e.token).slice(0, 3)).toEqual(tokens)
  })

  it('answers not_found for a token this lesson never had', async () => {
    const { storage } = await threeCheckpoints()
    const loaded = await storage.loadVersion('l1', 'v999')
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('not_found')
  })

  it('answers not_found for a lesson that does not exist', async () => {
    const storage = createMemoryStorage({ now })
    const loaded = await storage.loadVersion('nope', 'v1')
    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('not_found')
  })

  it('listing does not require loading any version’s content', async () => {
    // A structural assertion rather than a behavioural one: entries carry no manifest, so a
    // history of two hundred checkpoints costs two hundred rows and no lesson data.
    const { storage } = await threeCheckpoints()
    const entries = await storage.listVersions('l1')
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(['recordedAt', 'token', 'versionNumber'])
    }
  })
})
