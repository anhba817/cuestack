/**
 * Architectural boundaries, enforced as graph rules.
 *
 * These are properties of the whole graph, not of any one file: an ESLint rule
 * sees one module at a time and cannot detect a cycle that passes through three
 * packages. Constitution I requires the core/UI boundary to be machine-enforced,
 * and this is the machine.
 *
 * Every rule's `comment` is the message a contributor reads when it fires, so
 * each one names the rule and says why it exists (FR-016).
 */
module.exports = {
  forbidden: [
    {
      name: 'no-ui-in-core',
      severity: 'error',
      comment:
        'no-ui-in-core: @cuestack/core must not import a UI framework. The kernel is what ' +
        'makes every adapter possible; the moment React leaks into it, the Vue and web-component ' +
        'adapters stop being thin bindings and start being rewrites. (Constitution I)',
      from: { path: '^packages/core/src' },
      // Deliberately not filtered by dependencyTypes: React is not a dependency
      // of core, so an illegal import is *unresolvable* rather than an npm edge.
      // Requiring resolution would make the rule blind to the exact case it
      // exists to catch.
      to: { path: '^(react|react-dom|vue|svelte|preact|solid-js)($|/)' },
    },
    {
      name: 'no-core-in-schema',
      severity: 'error',
      comment:
        'no-core-in-schema: dependencies flow schema <- core <- adapters, one direction only. ' +
        '@cuestack/schema is the format contract and must not depend on anything that consumes it.',
      from: { path: '^packages/schema/src' },
      to: { path: '^(packages/(core|react|element)/|@cuestack/(core|react|element)($|/))' },
    },
    {
      name: 'no-adapters-in-core',
      severity: 'error',
      comment:
        'no-adapters-in-core: @cuestack/core must not import an adapter. The arrow points the ' +
        'other way.',
      from: { path: '^packages/core/src' },
      to: { path: '^(packages/(react|element)/|@cuestack/(react|element)($|/))' },
    },
    {
      name: 'no-zod-from-schema-root',
      severity: 'error',
      comment:
        'no-zod-from-schema-root: the @cuestack/schema root entry must compile to zero runtime ' +
        'bytes. A learner\'s browser receives a manifest validated at author time and has no ' +
        'reason to carry a validation library — that is the whole point of the separate ' +
        '/validate entry point.',
      from: { path: '^packages/schema/src/index\\.ts$' },
      to: { dependencyTypes: ['npm'], path: '^zod($|/)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'no-circular: a dependency cycle makes build order undefined and module initialisation ' +
        'order a coin flip.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'no-orphans: a module nothing imports is usually dead code.',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)tsdown\\.config\\.ts$', '(^|/)index\\.ts$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.next|coverage|node_modules)(/|$)' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts', '.tsx', '.mjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
