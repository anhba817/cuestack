/**
 * Base64, hand-written, because the platform helpers are each half the runtimes this package ships to.
 *
 * `@cuestack/core` runs on a server and in a browser, and the two obvious answers are both wrong:
 *
 * - `Buffer.from(bytes).toString('base64')` is Node-only. It typechecks, passes every Node test, and
 *   breaks the browser build — the most likely wrong answer, and the one that fails latest.
 * - `btoa(...)` is browser-only, **and** it takes a Latin-1 string: feeding it arbitrary bytes
 *   silently corrupts everything above `0xFF`. It fails quietly rather than loudly, which is worse.
 *
 * Branching on the platform would put a `typeof Buffer !== 'undefined'` check inside the package
 * whose constitution keeps its dependency surface deliberately small, and would leave two code paths
 * that could disagree about what a package contains. A dependency would need justifying against the
 * same rule, and "we did not want to write twenty lines" is not one (research R-13).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Reverse lookup, built once. `-1` marks a character the alphabet does not contain. */
const VALUES: readonly number[] = (() => {
  const table = new Array<number>(128).fill(-1)
  for (let i = 0; i < ALPHABET.length; i += 1) table[ALPHABET.charCodeAt(i)] = i
  return table
})()

export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]

    out += ALPHABET[a >> 2]
    out += ALPHABET[((a & 0b11) << 4) | ((b ?? 0) >> 4)]
    // The remainder is where the off-by-one lives, so each case is written out rather than
    // computed: two bytes pad once, one byte pads twice.
    out += b === undefined ? '=' : ALPHABET[((b & 0b1111) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : ALPHABET[c & 0b111111]
  }
  return out
}

export function fromBase64(text: string): Uint8Array {
  const body = text.endsWith('==') ? text.slice(0, -2) : text.endsWith('=') ? text.slice(0, -1) : text
  const bytes = new Uint8Array(Math.floor((body.length * 6) / 8))

  let bits = 0
  let held = 0
  let at = 0
  for (let i = 0; i < body.length; i += 1) {
    const code = body.charCodeAt(i)
    const value = code < 128 ? VALUES[code]! : -1
    /**
     * Refused rather than skipped. Ignoring an unknown character would decode most of a corrupted
     * payload into bytes that look like an image and are not, which is a worse answer than saying
     * the input is not Base64.
     */
    if (value < 0) throw new SyntaxError(`Not Base64: unexpected character at position ${i}.`)
    held = (held << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes[at] = (held >> bits) & 0xff
      at += 1
    }
  }
  return bytes.subarray(0, at)
}
