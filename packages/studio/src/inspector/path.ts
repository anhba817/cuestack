/**
 * Read a dotted path out of an element or a slide.
 *
 * Its own module because both `Inspector` and `Field` need it, and putting it in either made
 * them import each other — a cycle the boundary gate refused, correctly. A cycle here would
 * be harmless today and would make module initialisation order a coin flip the moment one of
 * them grew a top-level constant.
 *
 * Returns `undefined` rather than throwing for an absent path: most element fields are
 * optional, so "not set" is the common case and not an error.
 */
export function readPath(source: Record<string, unknown>, key: string): unknown {
  let node: unknown = source
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}
