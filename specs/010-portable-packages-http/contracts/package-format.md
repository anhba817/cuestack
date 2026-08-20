# Contract: the lesson package format

A package is **one JSON document**. This file is the whole definition; a reader with only this page
can write both a producer and a consumer.

---

## 1. Why the framework fixes this, when it fixes so little else

Every other boundary in this project is an interface the host implements however it likes. Storage,
assets, analytics, publishing — the framework says what it needs and never says how. This one is
different, and the difference is the entire point of the feature.

If each host serialized packages its own way, a package would be portable *within* a system and
nowhere else. That is the lock-in §7.7 exists to prevent, arriving one layer down and harder to see.
So the shape below is not a suggestion, and two packages exported from the same lesson by different
callers must be byte-identical (SC-002b).

---

## 2. The document

```jsonc
{
  "packageVersion": "1.0",        // this document's format
  "schemaVersion": "1.0",         // the lesson format the manifest uses
  "kind": "draft",                // or "published"
  "assetMode": "references",      // or "files"
  "lesson": { /* LessonManifest, unmodified */ },
  "assets": [
    { "assetId": "asset_1", "mediaType": "image/png" }
    // files mode adds: "content": "<Base64>"
  ]
}
```

Field meanings, requirements, and what is deliberately absent: [data-model.md §2–3](../data-model.md).

---

## 3. Reading one

In order, and the order is the contract:

1. **Check the size.** Refuse beyond the bound before parsing. A package is a file somebody was
   emailed; a parser that discovers a problem by exhausting memory has already lost.
2. **Parse.** A failure here is `unreadable`, including the `RangeError` deep nesting produces.
3. **Check the depth.** Refuse beyond the bound.
4. **Check `packageVersion`.** Refuse anything this reader does not know, saying whether it is newer
   or older.
5. **Check addresses.** Refuse any address-bearing field carrying a scheme that can execute, naming
   the field and the scheme.
6. **Migrate the lesson.** `migrate` owns the lesson version entirely — including refusing one newer
   than this reader supports, which it already does with a message worth quoting rather than
   restating.
7. **Validate.** The declared version is a claim; the contents are checked regardless (FR-013).

Steps 1–5 are the hardening. Steps 6–7 are the ordinary reading path.

---

## 4. What a producer must guarantee

- Each distinct asset appears **once**, however many elements reference it.
- `mediaType` is **stored**, never left for a reader to infer.
- `assetMode` matches the contents. A document saying `files` with no content is malformed, not a
  degraded reference-mode package.
- Nothing identifying a person, a credential, or a host's storage appears anywhere (FR-005).
- The manifest is carried **unmodified**. A producer that normalised it would make round-tripping a
  lossy operation nobody asked for.

---

## 5. What a consumer must not assume

- **That the assets exist anywhere.** A reference-mode package into a system that never held them is
  the ordinary case, not an error: the lesson is produced and the references are reported unresolved.
- **That the ids are free to reuse.** The lesson identity in the package is discarded; the caller
  supplies a new one. Reusing it is how an import overwrites the lesson somebody was working on.
- **That `schemaVersion` is true.** It is what the producer claimed.

---

## 6. Version policy

`packageVersion` moves when this document's shape changes, independently of `schemaVersion`.

- **A new optional field** — no version change. Readers ignore what they do not know.
- **A new required field, or a changed meaning** — minor bump, and older readers refuse rather than
  guess.
- **A structural change** — major bump.

A reader refuses a version it does not know rather than reading what it recognises. Partial reading
produces a lesson that looks complete and is quietly wrong, which is the outcome
`resolveChain`'s header already names as the worst available.

---

## 7. What this contract does not cover

Where a package is written, what it is called, how it is transported, whether it is compressed in
transit, and who is allowed to produce one. All the host's. The framework produces a document and
consumes a document.
