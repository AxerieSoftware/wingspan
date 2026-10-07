# Agent guide

How to work in this repo. [CONTRIBUTING.md](CONTRIBUTING.md) covers how Wingspan works, the commands and the folder layout.

## Every change

Before calling a change done, review the diff against this guide and clean it up:

- `npm run check` passes (typecheck, lint, knip, unit tests).
- `npm run e2e` passes, with new behavior covered by an e2e test.
- `npm run ensure:classes` passes when UI classes changed.
- `npm run build:edge` last, so the unpacked Edge build is current.
- `cd site && npm run build` passes when the site changed.
- The humanizer skill has been run on any prose the change touched: comments, UI copy, docs, site pages, the store listing and PR descriptions.

## Code

Follow [docs/code-style.md](docs/code-style.md) for naming, structure, control flow, errors and comments. In short:

- **Self-documenting first.** Descriptive names for classes, methods, fields, parameters and variables; no abbreviations or cryptic names. If a comment is needed to explain what code does, try renaming or restructuring first.
- **Comments:**
  - Public members get a short comment: a simple sentence or two on what it is or why it exists, unless the name already says it all.
  - Non-public code gets a comment only when it isn't easy to understand by reading it. Explain why, not what.
  - Never restate the code, narrate a change, or mention earlier iterations ("used to", "now", "kept for older…").
- **C#-style structure.** Classes with constructor-injected dependencies, vertical slices by feature (`models/`, `services/`, `components/` beside the feature class). Combine things into a shared class only when it clearly reduces duplication.
- **Greenfield.** Wingspan hasn't shipped broadly, so renames are clean breaks: no compatibility shims, migrations, old storage keys or leftover code from earlier iterations.
- **No over-implementation.** Handle what users can actually hit. No speculative guards, options or abstractions; leave rare edge cases as a note.
- **Lean and performant.** Don't do work that isn't needed. Prune unused code, exports and dependencies.
- **Money math is exact.** Changes to projections, payment planning, matching or totals state the invariant they keep and get a unit test for it.

## Tests

- Most testing is end to end, in `tests/e2e` against Monarch's real web app with a made-up household. Extend `Household`'s resolvers rather than adding per-test fixtures.
- Unit tests only for complicated logic, money math invariants, merge or data-loss logic, and edge-case bug fixes worth pinning.
- Test data is invented. No real people, merchants, card numbers or amounts. Invented companies use Microsoft-docs-style names (Contoso, Fabrikam).

## UI

- **Look:** match Monarch's visual style exactly. Use the class names of its components, colors, type, spacing and controls so Wingspan follows Monarch's themes and reads as part of the app. Never introduce a look of Wingspan's own.
- **Placement:** build into Monarch's existing pages rather than adding separate sections.
- In-app copy describes the rule ("supported pages") rather than listing specific Monarch pages, which go stale.

## Writing

- READMEs, docs, PR descriptions and comments are succinct. Prefer bullet points over long paragraphs, and keep PR descriptions short and plain.
- Run the humanizer skill on prose.
- The site (`site/`) is for Monarch users managing money: lead with the money outcome and the Monarch page it fits, with no software internals outside How it works and Privacy. Each feature page has `introduced`, `saves` and, when needed, `plus` frontmatter.
