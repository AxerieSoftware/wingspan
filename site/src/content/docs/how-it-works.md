---
title: How it works
description: What Wingspan reads, what it writes, and how to audit it.
---

- **No sign-in of its own.** Wingspan runs in the Monarch tab you're signed into and uses the same session. The browser attaches Monarch's session cookies, and Wingspan adds the CSRF token the web app sends with its own requests. It never shows or logs either.
- **Monarch's API, and the store you sync.** Data comes from the same API Monarch's web app uses, sent from the Monarch page like the app's own requests. Retail receipt sync also reads the store's own site, in a tab Wingspan opens, with the session you're signed into there. Wingspan runs on Monarch's pages with `storage` and `scripting`, and asks for a store's site only when you first sync it.
- **Saves in your Monarch account.** See [Where Wingspan saves](/features/where-wingspan-saves/).
- **Part of the app.** Everything Wingspan adds to the page is built from Monarch's own styles, so it looks like Monarch and follows its light and dark themes.
- **Easy to audit.** Every request Wingspan sends to Monarch carries `client=wingspan` in its address. Filter DevTools → Network by `client=wingspan` to see exactly what it asks for.
- **Open source.** The code is on [GitHub](https://github.com/AxerieSoftware/wingspan).

:::caution
Monarch doesn't publish this API. It can change without notice, and parts of Wingspan will stop working until they're updated.
:::

## Following Monarch's roadmap

Monarch publishes its plans on its [official roadmap](https://app.monarch.com/roadmap), which needs a Monarch login.

- A feature Monarch has only planned or started can still be built in Wingspan, since plans can change.
- When Monarch ships a feature that matches one of Wingspan's, Wingspan's version is deprecated and removed.
- Wingspan never rebuilds or unlocks what Monarch has already shipped, paid tiers included.
