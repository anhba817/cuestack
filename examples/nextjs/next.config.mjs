/**
 * @type {import('next').NextConfig}
 *
 * No `transpilePackages`. The Cuestack packages ship built ESM with correct exports
 * maps, so Next has nothing to transpile — and listing them there made Turbopack
 * unable to resolve the `./styles.css` subpath export.
 */
export default {}
