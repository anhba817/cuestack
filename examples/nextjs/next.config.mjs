/**
 * @type {import('next').NextConfig}
 *
 * No `transpilePackages`. The Cuestack packages ship built ESM with correct exports
 * maps, so Next has nothing to transpile — and listing them there made Turbopack
 * unable to resolve the `./styles.css` subpath export.
 *
 * `agentRules: false` because Next 16 otherwise writes `AGENTS.md` and `CLAUDE.md` into this
 * directory on every `next dev`. The constitution puts agent-facing guidance in the repository's
 * own `CLAUDE.md` and says it must not be restated elsewhere; a generated copy inside an example
 * is exactly the kind of second source that drifts. Turning it off is cleaner than gitignoring
 * files we would rather not have written.
 */
export default { agentRules: false }
