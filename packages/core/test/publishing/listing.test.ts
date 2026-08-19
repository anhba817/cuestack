import { describe, expect, it } from 'vitest'
import * as core from '../../src/index.js'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import { correct } from '../harness/faulty.js'

describe('listing published versions', () => {
  const published = async () => {
    let clock = 1_700_000_000_000
    const publishing = createMemoryPublishing({ now: () => (clock += 60_000) })
    await publishing.publish('lesson', correct(), 'ms-okafor')
    await publishing.publish('lesson', correct(), 'mr-adeyemi')
    return publishing
  }

  it('lists newest first, each carrying its publisher and its time', async () => {
    const versions = await (await published()).listPublished('lesson')
    expect(versions.map((v) => v.publishedBy)).toEqual(['mr-adeyemi', 'ms-okafor'])
    expect(versions[0]!.publishedAt).toBeGreaterThan(versions[1]!.publishedAt)
  })

  it('is empty rather than absent for a lesson never published', async () => {
    expect(await createMemoryPublishing().listPublished('never')).toEqual([])
  })

  it('gives a version a stable id across reads and across a later publish', async () => {
    /**
     * FR-027. An addressable identifier that changed when somebody published again would break
     * every link a host had already handed out — which is the whole use of having one.
     */
    const publishing = await published()
    const before = (await publishing.listPublished('lesson')).map((v) => v.id)
    expect((await publishing.listPublished('lesson')).map((v) => v.id)).toEqual(before)

    await publishing.publish('lesson', correct(), 'teacher')
    const after = (await publishing.listPublished('lesson')).map((v) => v.id)
    expect(after.slice(1)).toEqual(before)
  })

  it('ships no URL builder anywhere in the exported surface', () => {
    /**
     * FR-027 again, from the other side. The framework provides the identifier a host puts behind
     * a URL and ships no server — so a `urlFor(version)` here would be a guess about somebody
     * else's routing, wrong for every host that did not happen to match it.
     */
    const names = Object.keys(core)
    // `createMediaLink` and `emptyLink` are the media-element link, an unrelated concept, so the
    // match is on the address-building words rather than on "link".
    expect(names.filter((n) => /url|href|route|permalink/i.test(n))).toEqual([])
  })
})
