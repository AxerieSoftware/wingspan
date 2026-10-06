# Contributing

Thanks for helping. Bugs go in [Issues](https://github.com/axerieSoftware/wingspan/issues/new/choose), and pull requests are welcome.

Before building a feature, check the [roadmap](https://wingspan.axerie.com/roadmap/). Wingspan only adds what Monarch doesn't have, never rebuilds or unlocks Monarch's own features, and a feature that extends one of Monarch's uses Monarch's name for it.

## How it works

- **No sign-in of its own.** Wingspan runs in the Monarch tab you're signed
  into and uses the same session. The browser attaches Monarch's session
  cookies, and Wingspan adds the CSRF token the web app sends with its own
  requests. It never shows or logs either.
- **Monarch's API, and the retailer you sync.** Data comes from the GraphQL
  endpoint Monarch's web app calls, sent from the Monarch page's origin like
  the app's own requests. Retail receipt sync also calls the retailer's own
  API, from the retailer tab Wingspan opens. The extension runs on Monarch's
  pages with `storage` and `scripting`, and asks for access to a retailer's
  site only the first time it's synced.
- **Saves in your Monarch account.** Wingspan keeps its data in the notes of one manual account named "wingspan". It creates
  that account, hides it from Monarch's lists and leaves it out of net worth,
  so every browser and everyone in the household sees the same data. The notes
  hold compact, versioned JSON under a line asking people not to edit them. If
  an edit leaves them unreadable, Wingspan reports it and doesn't save over
  them. Other than that account, the only thing Wingspan writes to Monarch is
  receipts from retail receipt sync. There's no server of its own: no
  analytics, no tracking, no backend.
- **Cached in the browser.** Wingspan caches a copy in the browser for fast
  startup and for when Monarch can't be reached. If a change can't be saved to
  Monarch, it's kept there and saved once Monarch is reachable again. The cache
  is kept per Monarch household, and the page reloads if a different household
  signs in. Tabs in the same browser take turns using a Web Lock, and each
  browser merges against the last copy it synced with Monarch. If two browsers
  create the account at the same time, the oldest account named "wingspan" with
  the do-not-edit line wins; Wingspan never touches an account it didn't
  create. Wingspan's save buttons show its mark, so you can tell what Wingspan
  saves.
- **Part of the app.** Everything Wingspan renders uses the class names of
  Monarch's own rows, panels, dialogs and controls, so it follows Monarch's
  light and dark themes.
- **Easy to audit.** Every request Wingspan sends to Monarch has a
  `client=wingspan%2F<version>` query parameter, and each GraphQL request has
  an `operationName` starting with `wingspan_`. Filter DevTools → Network by
  `client=wingspan` to see every request it sends. The filter matches URLs,
  not request bodies, so it finds the query parameter, not the operation name.

Monarch doesn't publish this API. It can change without notice, and parts of
Wingspan will stop working until they're updated.

## Develop

```bash
npm install
npm run dev:edge   # Edge
npm run check      # typecheck, lint, knip and unit tests together, before you push
npm run typecheck
npm run lint       # Biome: lint, formatting and import order
npm run format     # Biome: fix what it can
npm run knip       # unused files, exports and dependencies
npm run ensure:classes # every class Wingspan uses exists in Monarch's live stylesheet
npm test           # Vitest unit tests
```

## Test end to end

```bash
npx playwright install chromium
npm run e2e                # the built extension in Monarch's real web app, with a made-up household
npm run screenshots        # the README's and the stores' screenshots, from the made-up household
```

`e2e` serves Monarch's own web app from a local snapshot of its public bundle,
fetched on first run into `tests/.monarch-snapshot/` and kept out of git
(`npm run e2e:refresh` picks up Monarch's latest). Its API is answered from
a made-up household in `tests/e2e/`, checked against the GraphQL schema
Monarch ships in that bundle. Tests seed Wingspan's storage
and reload the extension from `chrome://extensions`.

CI also runs `e2e` every morning, so a Monarch release that breaks Wingspan
shows up even when nothing was pushed.

## Load it unpacked

```bash
npm run build:edge
```

1. Open `edge://extensions` (or `chrome://extensions` after `npm run build:chrome`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose `.output/edge-mv3` (or `.output/chrome-mv3`).
4. Open Monarch.

If Wingspan doesn't seem to be working, DevTools → Network filtered by
`client=wingspan` shows whether Monarch rejected its requests. Monarch returns
status 200 for a rejected request, so look for `"errors"` in the response.

## Release

1. Pick the version. We practice [semantic versioning](https://semver.org/).
2. If what Wingspan saves changes shape so an older Wingspan would misread it,
   bump `CURRENT_SCHEMA_VERSION` in `src/data/models/wingspanData.ts`. Older
   versions then won't overwrite the newer data. Each browser
   is updated by hand, so a household can run both versions on one account for
   a while.
3. Run `npm version patch` (or `minor` or `major`), then
   `git push --follow-tags`. That bumps `package.json`, commits it, tags
   `vX.Y.Z` and pushes both. The tag starts `release.yml`, which runs CI, builds
   zips for Chrome, Edge, Firefox and Safari, and attaches all four to a draft
   GitHub release. During the beta nothing goes to the browser stores.
4. Open the draft under Releases, write the notes and click **Publish
   release**. Nothing is public until then. GitHub fills in the merged pull
   requests, grouped by label (see `.github/release.yml`); add a short summary
   of what changed for users above them.

## Layout

Features are grouped the way Monarch groups its own: by area, then by the
feature Monarch would most likely ship. When Monarch ships one, Wingspan's
folder for it is deprecated, then deleted. Each feature folder holds its
feature class, with `models/`, `services/` and `components/` beside it.
Classes take their dependencies through their constructors, and
`Wingspan.init` in `src/wingspan.ts` builds and wires them. Monarch's design
system is built on [Base UI](https://base-ui.com) and tailwind-variants, so
Wingspan's UI works with Monarch's own style definitions.

| Path | What it is |
| --- | --- |
| `entrypoints/monarch.content/` | Content script: starts Wingspan on Monarch's pages |
| `src/wingspan.ts` | Builds everything and keeps the features in sync with Monarch's page |
| `src/features/` | Feature code scoped by folder |
| `src/data/` | What Wingspan saves and where (validated with Valibot), and Monarch's data (cached with TanStack Query) |
| `src/monarch/api/` | Monarch's GraphQL API (`fetch`, with each response checked by Valibot) and the `wingspan_*` queries |
| `src/monarch/session/` | Which Monarch household is signed in, as Monarch keeps it for its own pages |
| `src/monarch/pages/` | One class per Monarch page Wingspan adds to |
| `src/monarch/ui/` | Monarch's design system: React and Base UI components, and its styles |
| `src/common/` | Common utilities used across the app |
| `assets/` | The logo, `logo.svg`, and the wordmark for light and dark backgrounds |
| `public/icon/` | Extension icons, rendered from `assets/` by `npm run generate:icons` |
| `tests/e2e/` | Playwright tests against a snapshot of Monarch's real web app, with a mocked API checked against Monarch's schema and a made-up household |

Monarch's markup isn't an API. If Wingspan's rows stop appearing after a
Monarch update, `npm run e2e:refresh && npm run e2e` against Monarch's latest
bundle shows which page element Wingspan can no longer find.
