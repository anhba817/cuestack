import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Shared flat config for the Cuestack workspace.
 *
 * Per-file rules live here. Graph-level rules — "core must not import React",
 * "no cycles" — are dependency-cruiser's job, because a lint rule sees one file at
 * a time and cannot detect a cycle that passes through three packages.
 * See specs/001-framework-foundation/research.md R-03.
 */

/**
 * Shared because `no-restricted-syntax` is replaced, not merged, when two flat-config
 * blocks both set it for the same file.
 *
 * Feature 005 found that the hard way: adding a workspace-wide innerHTML ban after the
 * theme-literal block silently disarmed the theme gate for element renderers — a gate
 * green while enforcing nothing, which is the exact failure this project has now hit three
 * times. Every block that sets `no-restricted-syntax` on files under `packages/` must
 * spread this in.
 */
/**
 * Colour, typography, and spacing must resolve from theme tokens (Constitution III).
 *
 * Shared for the same reason `NO_INNER_HTML` is: `no-restricted-syntax` is **replaced, not merged**,
 * when a narrower block sets it, so every block covering files under `packages/` has to spread these
 * back in. Feature 011 found that `packages/studio/src` had never had them — `gate:theme-values` ran
 * ESLint over that directory and reported it clean while enforcing nothing there, because the
 * `no-clock-in-studio` block replaced the rule. Nine features of editor code went unchecked; spreading
 * them in produced zero violations, so the code was clean and only the enforcement was absent.
 *
 * The `TemplateElement` selector is not decoration: a stylesheet written as a template literal is a
 * `TemplateElement`, and the `Literal` selector alone reaches nothing inside one.
 */
const NO_THEME_LITERALS = [
  {
    selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgb|rgba|hsl|hsla)/]",
    message:
      'no-theme-literals: colour values must resolve from var(--cs-theme-*), never be written into a renderer (Constitution III, FR-014).',
  },
  {
    selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3}|rgba?\\(|hsla?\\(/]",
    message:
      'no-theme-literals: a colour inside a template literal is still a colour — resolve it from var(--cs-theme-*) (Constitution III).',
  },
  {
    selector:
      "Property[key.name=/^(color|backgroundColor|borderColor|fill|stroke|fontFamily|fontSize|padding|margin|gap)$/] > Literal[value!=/^var\\(/]",
    message:
      'no-theme-literals: this style property must resolve from var(--cs-theme-*) with a readable fallback (Constitution III, FR-014).',
  },
]

/**
 * The web-component adapter writes a DOM by hand, so the protection React gave for free is gone.
 *
 * `NO_INNER_HTML` below bans `dangerouslySetInnerHTML`, whose selectors are JSX-only — and its own
 * message says why the ban mattered: "author-supplied text reaches the page as a React child, which
 * escapes it". A custom element has no such child. Lesson text is author-supplied and a package may
 * have been written by anybody (NFR-SEC-007, FR-015a).
 */
const NO_RAW_HTML = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'].map((property) => ({
  selector: `MemberExpression[property.name='${property}']`,
  message:
    `no-raw-html: ${property} may not be used. Author-supplied content reaches the page through ` +
    'textContent and attribute assignment, never as markup (NFR-SEC-007, FR-015a).',
}))

const NO_INNER_HTML = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message:
      'no-inner-html: dangerouslySetInnerHTML is banned. Author-supplied text reaches the page ' +
      'as a React child, which escapes it; server-rendered markup executes before any ' +
      'client-side guard could run (NFR-SEC-007, FR-046).',
  },
  {
    selector: "Property[key.name='dangerouslySetInnerHTML']",
    message:
      'no-inner-html: dangerouslySetInnerHTML is banned, including when spread from an object ' +
      '(NFR-SEC-007, FR-046).',
  },
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Constitution I: no `any` in an exported signature.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Constitution I: bare @ts-ignore is banned; @ts-expect-error needs a reason.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
    },
  },
  {
    /**
     * Feature 005 T009: `dangerouslySetInnerHTML` is banned across every package.
     *
     * A lock, not a sanitizer. The prop appears nowhere in this repository today and every
     * renderer passes text as a React child, which escapes it — so NFR-SEC-007 already holds
     * by construction and adding a sanitization library would be defending a door that is
     * shut. What needs guarding is the *next* renderer, written under deadline, reaching for
     * innerHTML to satisfy a formatting request. A lint rule fails that at review; a
     * dependency sitting unused in the tree would only suggest a review had happened.
     *
     * Sharpened by SSR: server-rendered markup ships inside the HTML document, so it runs
     * before any client-side guard could (research R-11, FR-046).
     *
     * Placed BEFORE the theme-literal block on purpose: flat config replaces
     * `no-restricted-syntax` rather than merging it, so the narrower block must come last
     * and must spread NO_INNER_HTML back in.
     */
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_INNER_HTML],
    },
  },
  {
    // Determinism: SC-008 requires validate(x) to deep-equal validate(x).
    // The realistic way that breaks is an error message interpolating a
    // timestamp, or a migration stamping updatedAt — both look harmless in
    // review. research.md R-07.
    files: ['packages/schema/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Schema validation must be deterministic (SC-008). No clock reads.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Schema validation must be deterministic (SC-008).' },
        { object: 'Math', property: 'random', message: 'Schema validation must be deterministic (SC-008).' },
      ],
      'no-restricted-syntax': [
        'error',
        ...NO_INNER_HTML,
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Schema validation must be deterministic (SC-008). No clock reads.',
        },
      ],
    },
  },
  {
    /**
     * Constitution I: element and effect types are added by registration, never
     * by modifying resolution logic (FR-025). A `switch` on element.type is the
     * exact shape the principle forbids: easy to write in a hurry, invisible in
     * review once the file is long, and the reason a framework stops being
     * extensible. Only the registries may dispatch on a type discriminant.
     */
    files: ['packages/core/src/**/*.ts', 'packages/react/src/**/*.{ts,tsx}'],
    ignores: [
      'packages/core/src/elements/registry.ts',
      'packages/core/src/effects/registry.ts',
      'packages/react/src/elements/registry.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_INNER_HTML,
        {
          selector: "SwitchStatement > MemberExpression.discriminant[property.name='type']",
          message:
            'no-switch-on-element-type: dispatch on a type discriminant belongs in a registry, not in resolution logic (Constitution I, FR-025).',
        },
        {
          selector: "SwitchStatement > MemberExpression.discriminant[property.name='phase']",
          message:
            'no-switch-on-element-type: dispatch on an effect phase belongs in a registry, not in resolution logic (Constitution I, FR-025).',
        },
      ],
    },
  },
  {
    /**
     * Feature 011: the web-component adapter.
     *
     * Two protections that reached it through no existing block. **Theme tokens** — its stylesheet is
     * the only place in the package colours appear, and `gate:theme-values` runs ESLint over the
     * directories in its `targets` list, so the rule has to apply here for the gate to mean anything.
     * **Raw HTML** — `NO_INNER_HTML`'s selectors are JSX-only, and this is the one package that writes
     * a DOM by hand.
     *
     * Narrower than the workspace-wide block, so it replaces `no-restricted-syntax` and everything it
     * needs is spread back in.
     */
    files: ['packages/element/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_INNER_HTML, ...NO_THEME_LITERALS, ...NO_RAW_HTML],
    },
  },
  {
    /**
     * Constitution I: @cuestack/core must not import a UI framework.
     *
     * This lives in ESLint, not dependency-cruiser, for a reason worth writing
     * down. Under pnpm's isolated node_modules, `react` is not resolvable from
     * packages/core at all — so a resolver-based tool records no edge and the
     * graph rule is blind to precisely the import it exists to forbid. A
     * syntactic rule sees the specifier whether or not it resolves.
     *
     * dependency-cruiser still owns cycles and cross-package direction, which
     * DO resolve (via workspace links) and which ESLint cannot see.
     */
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'vue', 'vue/*', 'svelte', 'svelte/*', 'preact', 'preact/*', 'solid-js', 'solid-js/*'],
              message:
                'no-ui-in-core: @cuestack/core must not import a UI framework. The kernel is what makes every adapter possible; the moment React leaks into it, the Vue and web-component adapters stop being thin bindings and start being rewrites. (Constitution I)',
            },
            {
              group: ['@cuestack/react', '@cuestack/element', '@cuestack/react/*', '@cuestack/element/*'],
              message:
                'no-adapters-in-core: @cuestack/core must not import an adapter. The arrow points the other way.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/schema/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@cuestack/core', '@cuestack/react', '@cuestack/element', '@cuestack/*/dist/*'],
              message:
                'no-core-in-schema: dependencies flow schema <- core <- adapters, one direction only. @cuestack/schema is the format contract and must not depend on anything that consumes it.',
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * Constitution III: all colour, typography, and spacing resolve from theme
     * tokens (FR-014). A hard-coded `#333` survives review — it is invisible in a
     * diff and looks deliberate — and then survives every theme anyone applies.
     * Renderers may only reach values through var(--cs-theme-*).
     */
    files: ['packages/react/src/elements/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        // Spread in, not inherited: a later block setting this rule would otherwise
        // replace these selectors wholesale. See NO_INNER_HTML above.
        ...NO_INNER_HTML,
        ...NO_THEME_LITERALS,
      ],
    },
  },
  {
    /**
     * Feature 005 T006: DOM measurement is confined to one module.
     *
     * Wave 2's central win was that nothing measures anything — that is what lets a server
     * emit a correct first paint with no layout shift on hydration. A pointer event arrives
     * in screen pixels, so the editor has to convert somewhere; confining that to
     * `canvas/pointer.ts` keeps the rendering path measurement-free and keeps the geometry
     * engine testable in an environment where `getBoundingClientRect` returns zero, which
     * happy-dom does (research R-04).
     *
     * An ESLint rule rather than a dependency-cruiser one: this restricts *identifiers*, and
     * a module-graph tool would only be able to forbid the import that the design requires.
     */
    files: ['packages/studio/src/**/*.{ts,tsx}'],
    ignores: ['packages/studio/src/canvas/pointer.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['getBoundingClientRect', 'offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight'].map(
          (property) => ({
            property,
            message:
              `dom-measurement-confined: ${property} may only be read in canvas/pointer.ts. ` +
              'Rendering must never depend on a measurement — that is what makes the server-rendered ' +
              'first frame correct — and the geometry engine must stay testable with no layout ' +
              'engine at all (research R-04).',
          }),
        ),
      ],
    },
  },
  {
    /**
     * Feature 006 T002: there is one clock, and it is not in the editor.
     *
     * `createTransport` has been in `@cuestack/core` since Wave 1 and the player has driven
     * it since Wave 3. The editor becomes its second consumer and ED-6 will be its third;
     * the specification named two clocks as the failure mode to design against, and
     * intention is not a mechanism.
     *
     * **No `ignores`, and that is the point.** Both primitives the editor needs already live
     * in `@cuestack/react` — `requestAnimationFrame` inside `useFrameLoop`, `performance.now`
     * inside `browserPorts` — so `usePlayback` imports rather than reimplements, and the rule
     * needs no exemption at the one module most likely to grow a clock (research R-01).
     *
     * Written with rule names the studio blocks do not already use. Flat config *replaces* a
     * rule's configuration rather than merging it, so putting these on
     * `no-restricted-properties` would disarm the DOM-measurement ban above for every file
     * both blocks match — feature 005's innerHTML defect exactly. `NO_INNER_HTML` is spread
     * back in for the same reason.
     */
    files: ['packages/studio/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['setTimeout', 'setInterval', 'requestAnimationFrame', 'Date'].map((name) => ({
          name,
          message:
            `no-clock-in-studio: ${name} may not be read in the editor. Time comes from the ` +
            'transport — `createTransport` with `browserPorts()`, driven by `useFrameLoop`, both ' +
            'from @cuestack/react. A second clock is the failure mode this feature was designed ' +
            'against (research R-01, FR-011).',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        // Narrower block than the workspace-wide one, so it replaces it: spread it back in.
        ...NO_INNER_HTML,
        // Feature 011 T003a1: these had never reached studio, for exactly the reason above.
        ...NO_THEME_LITERALS,
        ...[
          ['Date', 'now'],
          ['performance', 'now'],
        ].map(([object, property]) => ({
          selector: `MemberExpression[object.name='${object}'][property.name='${property}']`,
          message:
            `no-clock-in-studio: ${object}.${property} may not be read in the editor. Ask the ` +
            'transport what time it is (research R-01, FR-011).',
        })),
      ],
    },
  },
  {
    // dependency-cruiser's config is CommonJS by design — it is loaded by a tool
    // that predates ESM config support.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // Build and check scripts run in Node, not a browser or a bundle.
    files: ['tools/**/*.{js,mjs}', '*.config.{js,mjs,ts}', '**/*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts', 'tools/**/*.{js,mjs,ts}'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
