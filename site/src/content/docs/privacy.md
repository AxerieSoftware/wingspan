---
title: Privacy policy
description: What Wingspan collects (nothing) and where your data stays.
lastUpdated: 2026-10-11
---

Wingspan is a browser extension for Monarch Money's web app, made by Axerie Software.

## What Wingspan collects

Nothing. Wingspan has no server, no analytics and no tracking, and sends your data only to Monarch. The one exception is your choice: **Report a problem** in Settings opens a GitHub issue form prefilled with your browser's name and version and Wingspan's version, which you can edit before submitting.

## What Wingspan reads

While you're on Monarch's web app, Wingspan reads from Monarch, using the session you're already signed into:

- Your accounts, with their balance history.
- Transactions, with their tags, notes and whether they have attachments.
- Recurring items, cash flow totals, budget and goals.
- Any businesses you've set up, and whether your plan includes them.

It also reads from Monarch's pages:

- Text like row names and dates, to place its additions beside Monarch's.
- Which household is signed in, to keep each household's data apart.
- Monarch's own business filter on the page, to follow it.
- How you've grouped Recurring, to place its rows in the right sections.

It uses all of this only to draw its features on the page.

To make its requests, Wingspan reads Monarch's security cookie and sends it back only to Monarch, as Monarch's own web app does. During a retail sync, if the store's own page sends a sign-in token with its requests, Wingspan reuses it in that tab only and sends it only back to that store. It never stores either or sends them anywhere else.

Your data is never sold or transferred to anyone, never used for anything but drawing Wingspan's features, and never used to determine creditworthiness or for lending.

## What Wingspan stores

Its own items, due days, the loans your recurring payments pay toward, its settings, and which store purchases it has sent, in the notes of a hidden manual account named "wingspan" in your Monarch account.

The browser's storage for Monarch's site keeps:

- The workspace you choose, and whether workspaces are on, for each household, until you change them. To open pages in that workspace, Wingspan sets Monarch's own business filter on the page.
- The sidebar items you hide, for every household that signs in to that browser.

These stay after Wingspan is uninstalled, until you clear Monarch's site data in the browser.

The browser also keeps a cached copy so Wingspan starts fast, one for each Monarch household that signs in. Uninstalling the extension removes it.

To remove what's in Monarch too, uninstall Wingspan first, then delete the "wingspan" account. While it's installed, Wingspan recreates the account from its copy. Monarch may keep a deleted account, notes included, for a time under its own policy.

## What Wingspan changes in Monarch

Only what you ask it to. Retail receipt sync sends the receipts you choose. **Update balance**, on a manual loan's page or a payment's details, enters the balance you save as that loan's balance. Wingspan never changes any other account or transaction.

## Permissions

Wingspan runs on `app.monarch.com` with two permissions: `storage`, for the extension's own storage, and `scripting`, to read store purchases in a tab it opens.

Wingspan asks to read a supported retailer's site (currently `www.walmart.com` and `www.costco.com`) only when you first sync that store, on Wingspan's own page, and you can say no. With it, Wingspan reads your purchases in a tab it opens while you're signed in: each one's items, prices, tax, total and how it was paid, never your name, email or address. It sends them only to Monarch, as receipts, and changes nothing on the store's site.

## Contact

Questions go to [GitHub Issues](https://github.com/AxerieSoftware/wingspan/issues).
