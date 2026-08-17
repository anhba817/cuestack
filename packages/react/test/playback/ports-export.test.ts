import { describe, expect, it } from 'vitest'
import * as client from '../../src/index.js'
import * as server from '../../src/server.js'

/**
 * The editor cannot build its own clock, so this package has to lend it one.
 *
 * Feature 006 T008. `browserPorts` existed at `player/browserPorts.ts` from Wave 3 and was
 * never exported — every consumer was inside this package, so nobody noticed. The editor is
 * the first outside consumer, and `no-clock-in-studio` forbids it `performance.now` with no
 * exemption: without this export the studio package would have to reimplement the port,
 * which is the second clock feature 006 exists to prevent (006 research R-01).
 *
 * An omission is invisible until something needs the thing omitted. This test is what makes
 * removing it loud.
 */
describe('the client entry lends its ports', () => {
  it('exports browserPorts, so a host can drive the transport without writing a clock', () => {
    expect(typeof client.browserPorts).toBe('function')
  })

  it('exports the frame loop and writer beside it — the editor needs all three', () => {
    expect(typeof client.useFrameLoop).toBe('function')
    expect(typeof client.createFrameWriter).toBe('function')
  })

  it('keeps them off the server entry, where a transport would be inert', () => {
    // The same reasoning the playback block's own comment gives: an effect never runs during
    // a server render, so exporting a transport there would only invite a host to try.
    expect('browserPorts' in server).toBe(false)
    expect('useFrameLoop' in server).toBe(false)
  })
})
