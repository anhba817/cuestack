# @cuestack/element

## 0.1.0

### Minor Changes

- d4573e6: `@cuestack/element`: the lesson player as a custom element.
  
  A second adapter over the same kernel, usable from any page without a bundler or a
  framework — `<cuestack-lesson>` takes a manifest and plays it. Its existence is also the
  proof that the kernel is genuinely framework-agnostic rather than React-shaped.
  
  Also the authoring guide: how to write an element renderer, and what a plugin owes the
  player.
- 364d74a: Initial release — Wave 0, the framework foundation.
  
  `@cuestack/schema` ships the lesson format: types inferred from validators, two-tier
  validation with located issues, and a forward-only migration chain. Its root entry is
  type-only and compiles to zero runtime bytes; validation lives behind `/validate` so the
  player never carries it.
  
  `@cuestack/core`, `@cuestack/react`, and `@cuestack/element` are published as stubs. They
  exist so the workspace graph, the export conditions, and the core/UI boundary are real and
  enforced from the first commit rather than retrofitted onto code that already violates them.
  The kernel arrives in Wave 1 and the React adapter in Wave 2.
- d4573e6: A learner can move through a lesson.
  
  Navigation controls that know when they may act: a slide gated by a required question or
  by media that has not finished refuses to advance, and says so, rather than appearing
  operable and doing nothing. `learnerMayLeave` states that rule once, in the kernel, so
  both adapters answer the same question the same way.
  
  Fixes: a learner who reviewed a lesson could not complete it again in either adapter, and
  the web component never reported a timed slide carrying a required question.

### Patch Changes

- Updated dependencies [d4573e6]
- Updated dependencies [57e429d]
- Updated dependencies [364d74a]
- Updated dependencies [d4573e6]
- Updated dependencies [ba7c410]
- Updated dependencies [d4573e6]
- Updated dependencies [e0f5f16]
- Updated dependencies [2df3723]
- Updated dependencies [d4573e6]
- Updated dependencies [d4573e6]
  - @cuestack/core@0.1.0
  - @cuestack/schema@0.1.0
