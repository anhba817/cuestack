import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Read `stage.css` and resolve what its declarations compute to.
 *
 * Scaling lives in CSS, so proving it works means evaluating CSS. The alternative —
 * measuring rendered pixels — is unavailable twice over: happy-dom implements no
 * layout, and container query units are exactly the feature a DOM shim does not have.
 *
 * Asserting on the *text* of the declarations was the cheaper option and it is not
 * enough. `calc(var(--cs-x) / var(--cs-canvas-h) * 100cqw)` has the right shape and
 * the wrong axis; only evaluating it catches that. So this substitutes custom
 * properties, converts container query units against a given container box, and
 * evaluates the arithmetic.
 *
 * Deliberately a small subset: `var()`, `calc()`, `max()`, `min()`, `clamp()`,
 * `+ - * /`, `cqw`, `cqh`, `px`, and bare numbers. Anything else throws rather than
 * guessing, so a stylesheet that grows past what this understands fails loudly instead
 * of being silently mis-evaluated.
 */

// fileURLToPath, not new URL(...).pathname — happy-dom shims URL differently from the
// node environment and the pathname form resolves to the wrong directory.
const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src')

export interface Rule {
  readonly selectors: readonly string[]
  readonly declarations: Readonly<Record<string, string>>
  /** The `@media (...)` prelude this rule sits inside, if any. */
  readonly media?: string
  /** Set when this "rule" is an `@keyframes` block; the value is its name. */
  readonly keyframes?: string
}

export interface Box {
  readonly w: number
  readonly h: number
}

export function stylesheet(name = 'stage.css'): string {
  return readFileSync(join(SRC, 'styles', name), 'utf8')
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function matchBrace(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  throw new Error('unbalanced braces in stylesheet')
}

/** Split on `sep` only at paren depth zero, so `translate(a, b)` survives. */
function splitTop(text: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (c === '(') depth += 1
    else if (c === ')') depth -= 1
    else if (c === sep && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

function declarationsOf(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of splitTop(body, ';')) {
    const decl = raw.trim()
    if (decl === '') continue
    const colon = splitTop(decl, ':')
    if (colon.length < 2) continue
    const name = colon[0]!.trim()
    out[name] = colon.slice(1).join(':').trim()
  }
  return out
}

function parse(css: string, media?: string): Rule[] {
  const out: Rule[] = []
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open === -1) break
    const prelude = css.slice(i, open).trim()
    const close = matchBrace(css, open)
    const body = css.slice(open + 1, close)
    if (prelude.startsWith('@keyframes')) {
      /**
       * Keyframe stops are not selectors.
       *
       * `from`, `to`, and `50%` name points in an animation, not elements, so feeding them
       * to a scoping check reports every keyframe as an unscoped bare selector. What *is*
       * worth checking about a keyframe is its name, which `keyframeNames()` exposes.
       */
      out.push({ selectors: [], declarations: {}, keyframes: prelude.slice('@keyframes'.length).trim() })
    } else if (prelude.startsWith('@')) {
      out.push(...parse(body, prelude))
    } else if (prelude !== '') {
      out.push({
        // splitTop, not split(','): `:where(p, h1, h2)` is one selector, and a naive split
        // reported each tag inside it as a separate bare element selector.
        selectors: splitTop(prelude, ',').map((s) => s.trim()),
        declarations: declarationsOf(body),
        ...(media === undefined ? {} : { media }),
      })
    }
    i = close + 1
  }
  return out
}

export function rules(css: string = stylesheet()): Rule[] {
  return parse(stripComments(css))
}

/** Rules matching a selector exactly, outside any media query unless asked. */
export function rulesFor(selector: string, css: string = stylesheet()): Rule[] {
  return rules(css).filter((r) => r.selectors.includes(selector))
}

/**
 * The declarations a selector contributes, later ones winning, media queries excluded.
 *
 * `.cs-element` is declared in more than one block once T049 lands, so reading only
 * the first would test half the rule.
 */
export function declarationsFor(selector: string, css: string = stylesheet()): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const rule of rulesFor(selector, css)) {
    if (rule.media !== undefined) continue
    Object.assign(merged, rule.declarations)
  }
  return merged
}

/** Substitute `var(--name, fallback)` until no references remain. */
function substituteVars(value: string, vars: Readonly<Record<string, string>>): string {
  let out = value
  for (let guard = 0; guard < 20; guard += 1) {
    const at = out.indexOf('var(')
    if (at === -1) return out
    const close = matchParen(out, at + 3)
    const inner = out.slice(at + 4, close)
    const parts = splitTop(inner, ',')
    const name = parts[0]!.trim()
    const fallback = parts.length > 1 ? parts.slice(1).join(',').trim() : undefined
    const resolved = vars[name] ?? fallback
    if (resolved === undefined) {
      throw new Error(`${name} has no value and no fallback — the declaration would be dropped`)
    }
    out = out.slice(0, at) + `(${resolved})` + out.slice(close + 1)
  }
  throw new Error('var() substitution did not terminate')
}

function matchParen(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1
    else if (text[i] === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  throw new Error('unbalanced parentheses in declaration')
}

/** Container query units and lengths become plain numbers against a container box. */
function substituteUnits(value: string, container: Box): string {
  return value
    .replace(/calc\(/g, '(')
    .replace(/(-?[\d.]+)cqw\b/g, (_m, n: string) => String((Number(n) / 100) * container.w))
    .replace(/(-?[\d.]+)cqh\b/g, (_m, n: string) => String((Number(n) / 100) * container.h))
    .replace(/(-?[\d.]+)px\b/g, (_m, n: string) => n)
    .replace(/(-?[\d.]+)deg\b/g, (_m, n: string) => n)
}

/** Recursive descent over `+ - * /` and parentheses. No `eval`, no `Function`. */
function evaluate(expr: string): number {
  let i = 0
  const skip = (): void => {
    while (i < expr.length && /\s/.test(expr[i]!)) i += 1
  }

  const parseExpr = (): number => {
    let left = parseTerm()
    for (;;) {
      skip()
      const op = expr[i]
      if (op !== '+' && op !== '-') return left
      i += 1
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
  }

  const parseTerm = (): number => {
    let left = parseFactor()
    for (;;) {
      skip()
      const op = expr[i]
      if (op !== '*' && op !== '/') return left
      i += 1
      const right = parseFactor()
      left = op === '*' ? left * right : left / right
    }
  }

  const parseFactor = (): number => {
    skip()
    // max/min/clamp: comparison functions, which is how a floor is expressed in CSS.
    // parseExpr stops at a comma of its own accord, so the arguments split themselves.
    const fn = /^(max|min|clamp)\s*\(/.exec(expr.slice(i))
    if (fn) {
      i += fn[0].length
      const args = [parseExpr()]
      for (;;) {
        skip()
        if (expr[i] !== ',') break
        i += 1
        args.push(parseExpr())
      }
      skip()
      if (expr[i] !== ')') throw new Error(`expected ) closing ${fn[1]} in ${expr}`)
      i += 1
      if (fn[1] === 'max') return Math.max(...args)
      if (fn[1] === 'min') return Math.min(...args)
      if (args.length !== 3) throw new Error(`clamp needs three arguments in ${expr}`)
      return Math.min(Math.max(args[0]!, args[1]!), args[2]!)
    }
    if (expr[i] === '(') {
      i += 1
      const value = parseExpr()
      skip()
      if (expr[i] !== ')') throw new Error(`expected ) at ${i} in ${expr}`)
      i += 1
      return value
    }
    if (expr[i] === '-') {
      i += 1
      return -parseFactor()
    }
    if (expr[i] === '+') {
      i += 1
      return parseFactor()
    }
    const match = /^-?\d*\.?\d+(?:e[+-]?\d+)?/i.exec(expr.slice(i))
    if (!match) throw new Error(`cannot evaluate ${JSON.stringify(expr.slice(i))} in ${expr}`)
    i += match[0].length
    return Number(match[0])
  }

  const value = parseExpr()
  skip()
  if (i !== expr.length) throw new Error(`trailing ${JSON.stringify(expr.slice(i))} in ${expr}`)
  return value
}

/** What a single declaration value computes to, in pixels or as a bare ratio. */
export function resolveValue(
  value: string,
  vars: Readonly<Record<string, string>>,
  container: Box = { w: 0, h: 0 },
): number {
  return evaluate(substituteUnits(substituteVars(value, vars), container))
}

/**
 * The stage's own box at a given available width.
 *
 * Derived from the stylesheet rather than assumed: the `aspect-ratio` declaration is
 * the thing under test, so reading it here means a change to it changes every scaling
 * assertion at once. `width: 100%` makes the available width the stage width.
 */
export function stageBox(availableWidth: number, vars: Readonly<Record<string, string>>): Box {
  const stage = declarationsFor('.cs-stage')
  const ratio = stage['aspect-ratio']
  if (ratio === undefined) throw new Error('.cs-stage declares no aspect-ratio')
  const wOverH = resolveValue(ratio, vars)
  return { w: availableWidth, h: availableWidth / wOverH }
}

export interface ElementBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Where `.cs-element` lands, given the stage's custom properties and its own. */
export function elementBox(
  availableWidth: number,
  stageVars: Readonly<Record<string, string>>,
  elementVars: Readonly<Record<string, string>>,
): ElementBox {
  const container = stageBox(availableWidth, stageVars)
  const vars = { ...stageVars, ...elementVars }
  const decls = declarationsFor('.cs-element')
  const read = (name: string): number => {
    const value = decls[name]
    if (value === undefined) throw new Error(`.cs-element declares no ${name}`)
    return resolveValue(value, vars, container)
  }
  return { left: read('left'), top: read('top'), width: read('width'), height: read('height') }
}

/** Every `@keyframes` name declared in a stylesheet. */
export function keyframeNames(css: string = stylesheet()): string[] {
  return rules(css)
    .filter((r) => r.keyframes !== undefined)
    .map((r) => r.keyframes!)
}
