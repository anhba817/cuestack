---
'@cuestack/adapter-http': minor
'@cuestack/core': minor
---

`@cuestack/adapter-http`: HTTP storage, asset, and analytics adapters for a host.

A host that speaks HTTP can back a lesson without writing an adapter. Drafts and published
versions persist over a documented endpoint contract, assets resolve through it, and
analytics events reach it — with conflict detection, so two editors cannot silently
overwrite one another.

Also portable lesson packages: a lesson and its assets export and import as one unit,
so a lesson can move between hosts without either end knowing the other.
