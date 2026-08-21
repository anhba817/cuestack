import { describe, expect, it } from 'vitest'
import { checkDocument, regionOf } from '../check-doc-snippets.mjs'

const SOURCE = `
export const x = 1
// #region example
const greet = () => 'hello'
// #endregion example
export const y = 2
`

const doc = (body: string): string => `# Guide\n\n<!-- from: src/a.ts#example -->\n\`\`\`ts\n${body}\`\`\`\n`
const read = (path: string) => (path === 'src/a.ts' ? SOURCE : null)

describe('the snippet checker', () => {
  it('passes when the block matches its source', () => {
    const result = checkDocument(doc("const greet = () => 'hello'\n"), read)
    expect(result.found).toBe(1)
    expect(result.problems).toEqual([])
  })

  it('fails when the block has drifted', () => {
    const result = checkDocument(doc("const greet = () => 'goodbye'\n"), read)
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain('drifted')
  })

  it('fails when the region does not exist', () => {
    /**
     * The case that matters most: a snippet pointing at a deleted region would otherwise pass by
     * finding nothing, which is how a checker becomes a comment.
     */
    const doc2 = doc("const greet = () => 'hello'\n").replace('#example', '#gone')
    const result = checkDocument(doc2, read)
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain('region does not exist')
  })

  it('fails when the file does not exist', () => {
    const result = checkDocument(doc("x\n").replace('src/a.ts', 'src/missing.ts'), read)
    expect(result.problems[0]).toContain('does not exist')
  })

  it('ignores fenced blocks that claim no source', () => {
    // Prose examples are allowed; only blocks that name a file are held to it.
    const result = checkDocument('# Guide\n\n```ts\nanything at all\n```\n', read)
    expect(result.found).toBe(0)
    expect(result.problems).toEqual([])
  })

  it('strips the common indent, so a nested region reads as code', () => {
    const nested = `
class A {
  // #region method
  run() {
    return 1
  }
  // #endregion method
}
`
    expect(regionOf(nested, 'method')).toBe('run() {\n  return 1\n}')
  })
})
