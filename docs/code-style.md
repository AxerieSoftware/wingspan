# Code style

How code in this repo should read, beyond what Biome enforces. It comes from the maintainer's C# background, so the TypeScript here leans toward C# habits.

## Structure

- One class per concept, with dependencies passed into the constructor and kept in private read-only fields. No module-level singletons or service locators.
- Give a service an interface when it has several implementations or tests need a seam. Don't add one for a single implementation.
- Order members: fields, constructor, public properties, public methods, then private helpers in the order they're first called.
- When several public methods share an implementation, put it in a private `…Core` method rather than having one public method call another with special arguments.
- Mappers that convert between shapes are named `to<Target>`.
- Organize by feature (vertical slices), with models, services and UI beside the feature that uses them. The public API sits at the top of a feature, its implementation details below it.

## Names

- Spell out names of fields, parameters, properties, methods and variables: `eventStateRepository`, `optionsAccessor`, `lockSemaphore`. No abbreviations.
- A lambda parameter can be a single letter when the collection names what it holds: `accounts.map(a => a.id)`, `groups.flatMap(g => g.rules)`. A lambda longer than a line gets a full name.
- Booleans read as questions: `isEnabled`, `hasChosenBusinesses`, `canPay`.
- Methods are verbs that say what they return or change. `tryGetUser` returns null when the user is missing; `getUser` throws.
- Name literal arguments. Never pass a bare `0`, `true` or `null` whose meaning isn't obvious at the call site.

## Control flow

- Guard clauses first: validate inputs and return early, then do the work without nesting.
- Short guards and early returns go on one line with no braces.
- Plain `if`/`else` blocks over nested ternaries or clever one-liners. One ternary for a simple choice is fine.
- Run a multi-step operation as a sequence of steps, each checking its result and returning early on failure.
- Break long call chains one call per line.
- Update immutable data by copying it with a change, not by mutating what was passed in.

## Errors

- Expected failures, like a missing record or a rejected request, are returned as results, not thrown.
- Throw only for programmer errors and broken invariants, with a full-sentence message that names the value: `Account 'acc-1' has no balance.`
- Catch only to add context, clean up, or turn an error into a result. Never swallow one silently. If ignoring it is correct, a comment says why.
- Unexpected errors go to `logError`.

## Comments

- Public members get a short doc comment: one sentence, two at most, saying what it is or why it exists. Skip it when the name already says it all.
- Implementations inherit their interface's doc comment instead of repeating it.
- Inside code, comment only what isn't clear from reading it. Explain why, often in a few words.
- A short label can head a block of steps in a long method, but splitting the method is usually better.
- No comments that restate the code, narrate a change, or mention how it used to work.

## Tests

- Prefer end-to-end and system tests. Unit-test complicated logic, invariants and edge-case bug fixes.
- Name tests after the behavior: what's done, under what condition, and what happens.
- No arrange, act or assert comments. Blank lines separate the phases.

## Scope

- Greenfield code has no compatibility shims or leftovers from earlier iterations.
- Handle what users can actually hit. No speculative guards, options or abstractions "for later".
- Don't do work that isn't needed, and prune unused code and dependencies.

## TypeScript

- Classes for services, stores and features, with constructor parameter properties: `public constructor(private readonly store: Store) {}`.
- Write `public` and `private` on every class member, constructors included.
- `const` by default, `let` only when the value is reassigned. Let types be inferred inside functions. Annotate public signatures.
- No `any`. Parse unknown data with a schema or type guards at the boundary, then trust the types inside.
- Use `undefined` or `null` for missing values consistently within a module. A `tryGet…` method returns one of them; a `get…` method throws.
- Represent results as discriminated unions (`{ status: 'ready', data } | { status: 'failed' }`) and switch on the tag.
- Name literal arguments with an options object or a named constant: `wait({ timeoutMs: 0 })`, not `wait(0)`.
- Constants are `UPPER_SNAKE_CASE` at the top of the file.
- Release resources with `using`, `DisposableStack` or `finally`.
- When an operation can be cancelled, pass its `AbortSignal` down to the I/O.
- Doc comments are `/** … */` on exported and public members. Private members only when they're hard to follow.
- One exported class or main function per file, with the file named after it in camelCase.
- Import types with `import type`.

## Wingspan

- Monarch's DOM is read and changed only in `src/monarch/pages`. Features ask a page object, and never query Monarch's elements themselves.
- Monarch's API is called only through the clients in `src/monarch/api`.
- Data from storage, Monarch's API or a retailer is parsed with valibot schemas where it enters, in a store, client or the feature's `models/`.
- Features follow the `WingspanFeature` lifecycle: `start` subscribes, `sync` brings the page in line, and disposing undoes everything.

## Where this differs from what an AI writes by default

- Doc comments are one line, not a paragraph explaining the design.
- Private helpers usually have no comment at all.
- Explicit `if` blocks over dense expressions, even when they're longer.
- No defensive guards for states that can't happen.
- Descriptive names everywhere except in short lambdas over a well-named collection.