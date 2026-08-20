import { describe, expect, it } from 'vitest'
import { toBase64, fromBase64 } from '../../src/packaging/base64.js'

/**
 * The test that matters is not "does it encode": it is a round trip over bytes that are **not text**.
 *
 * Research R-13 names the two wrong answers, and both pass a string-only test. `Buffer.from(...)`
 * typechecks, passes every Node suite, and breaks the browser build. `btoa` is browser-only and
 * takes a Latin-1 string — feeding it arbitrary bytes silently corrupts everything above `0xFF`.
 * Every value 0–255 and an embedded `0x00` are where both show.
 */
describe('the Base64 codec', () => {
  it('round-trips every byte value', () => {
    const all = new Uint8Array(256)
    for (let i = 0; i < 256; i += 1) all[i] = i
    expect([...fromBase64(toBase64(all))]).toEqual([...all])
  })

  it('round-trips bytes with a zero in the middle', () => {
    const bytes = new Uint8Array([0xff, 0x00, 0x41, 0x00, 0xfe])
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes])
  })

  it('handles every remainder, because padding is where the off-by-one lives', () => {
    for (let length = 0; length <= 12; length += 1) {
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i += 1) bytes[i] = (i * 37 + 11) % 256
      expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes])
    }
  })

  it('produces the canonical encoding, padding included', () => {
    // Fixed vectors from RFC 4648, so "it round-trips with itself" cannot pass a private alphabet.
    const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)))
    expect(toBase64(ascii(''))).toBe('')
    expect(toBase64(ascii('f'))).toBe('Zg==')
    expect(toBase64(ascii('fo'))).toBe('Zm8=')
    expect(toBase64(ascii('foo'))).toBe('Zm9v')
    expect(toBase64(ascii('foob'))).toBe('Zm9vYg==')
    expect(toBase64(ascii('fooba'))).toBe('Zm9vYmE=')
    expect(toBase64(ascii('foobar'))).toBe('Zm9vYmFy')
  })

  it('reads back what it wrote for a realistic payload', () => {
    // A PNG header: the first bytes of every image a teacher would export.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect([...fromBase64(toBase64(png))]).toEqual([...png])
  })

  it('refuses input that is not Base64 rather than returning wrong bytes', () => {
    expect(() => fromBase64('not base64!')).toThrow()
  })
})
