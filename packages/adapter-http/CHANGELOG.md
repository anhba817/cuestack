# @cuestack/adapter-http

## 0.1.0

### Minor Changes

- d4573e6: `@cuestack/adapter-http`: HTTP storage, asset, and analytics adapters for a host.
  
  A host that speaks HTTP can back a lesson without writing an adapter. Drafts and published
  versions persist over a documented endpoint contract, assets resolve through it, and
  analytics events reach it — with conflict detection, so two editors cannot silently
  overwrite one another.
  
  Also portable lesson packages: a lesson and its assets export and import as one unit,
  so a lesson can move between hosts without either end knowing the other.

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
