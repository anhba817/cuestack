import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { corpus, referenceLesson } from '../harness/corpus.js'
import { client, server } from '../harness/render.js'
import { LessonPlayer } from '../../src/index.js'
import { LessonPlayer as ServerPlayer } from '../../src/server.js'
import { testPorts } from '../harness/ports.js'

/**
 * US5 #1 · SC-012 · FR-023.
 *
 * A host renders a lesson by supplying it. One prop, nothing else — no provider, no
 * configuration call, no registry to build, no stylesheet import needed to get output.
 *
 * The requirement is about what a host has to *know*, and a player needing five things
 * wired correctly gets wired differently in two places. Every prop below beyond `lesson`
 * is optional, and this asserts that rather than trusting the type signature, because an
 * optional prop the component then crashes without is optional only in the types.
 */
describe('a minimal host', () => {
  it('renders a lesson from one prop on the server', () => {
    const markup = server(h(ServerPlayer, { lesson: referenceLesson }))
    expect(markup).toContain('cs-stage')
  })

  it('renders a lesson from one prop in the browser', async () => {
    // No ports either. Real browser ports are the default, and happy-dom supplies enough
    // of a browser for them — which is the same path a host takes.
    const container = await client(h(LessonPlayer, { lesson: referenceLesson }))
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })

  it('needs no registry, provider, or configuration call', async () => {
    // Stated as an assertion about the exported surface: if a host had to call something
    // before rendering, there would be a function here to call.
    const surface = await import('../../src/index.js')
    const required = Object.keys(surface).filter((k) => /^(configure|init|setup|createPlayer)/.test(k))
    expect(required).toEqual([])
  })

  it('renders every corpus lesson without a single option', async () => {
    for (const entry of corpus()) {
      const container = await client(h(LessonPlayer, { lesson: entry.lesson, ports: testPorts() }))
      expect(container.querySelector('.cs-stage'), entry.name).not.toBeNull()
    }
  })

  it('takes a lesson it did not validate and does not validate it again', async () => {
    // The player is not a second validator (data-model.md). A manifest missing a slide
    // must not throw — the host validated at author time, and a runtime validator here
    // would put Zod in a learner's browser, which is the thing feature 001 refused.
    const empty = { schemaVersion: '1.0', lesson: referenceLesson.lesson, slides: [] }
    const markup = server(h(ServerPlayer, { lesson: empty as typeof referenceLesson }))
    expect(markup).toBe('')
  })

  it('deep-links to a slide the host chooses', async () => {
    const container = await client(
      h(LessonPlayer, { lesson: referenceLesson, slideIndex: 2, ports: testPorts() }),
    )
    expect(container.querySelector('.cs-stage')).not.toBeNull()
  })
})
