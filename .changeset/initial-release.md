---
'@cuestack/schema': minor
'@cuestack/core': minor
'@cuestack/react': minor
'@cuestack/element': minor
---

Initial release — Wave 0, the framework foundation.

`@cuestack/schema` ships the lesson format: types inferred from validators, two-tier
validation with located issues, and a forward-only migration chain. Its root entry is
type-only and compiles to zero runtime bytes; validation lives behind `/validate` so the
player never carries it.

`@cuestack/core`, `@cuestack/react`, and `@cuestack/element` are published as stubs. They
exist so the workspace graph, the export conditions, and the core/UI boundary are real and
enforced from the first commit rather than retrofitted onto code that already violates them.
The kernel arrives in Wave 1 and the React adapter in Wave 2.
