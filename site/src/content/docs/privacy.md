---
title: Privacy policy
description: What Wingspan collects (nothing) and where your data stays.
lastUpdated: 2026-10-09
---

Wingspan is a browser extension for Monarch Money's web app, made by Axerie Software.

## What Wingspan collects

Nothing. Wingspan has no server, no analytics and no tracking. It doesn't send your data anywhere except Monarch. The one exception is your choice: **Report a problem** in Settings opens a GitHub issue form with your browser's name and version and Wingspan's version filled in, which you can change before you submit it.

## What Wingspan reads

While you're on Monarch's web app, Wingspan reads your accounts, transactions with their tags and notes and whether they have attachments, recurring items, budget and goals from Monarch, using the session you're already signed into, along with any businesses you've set up and whether your plan includes them. It also reads text on Monarch's pages, like row names and dates, to place its additions beside Monarch's, which household is signed in, to keep each household's data apart, Monarch's own business filter on the page, to follow it, and how you've grouped Recurring, to place its rows in the right sections. It uses all of this only to draw its features on the page.

To make its requests, Wingspan reads Monarch's security cookie and sends it back only to Monarch, as Monarch's own web app does. During a retail sync, if the store's own page sends a sign-in token with its requests, Wingspan reuses it in that tab only and sends it only back to that store. It never stores either or sends them anywhere else.

Your data is never sold or transferred to anyone, never used for anything but drawing Wingspan's features, and never used to determine creditworthiness or for lending.

## What Wingspan stores

Its own items, due days and settings, and which store purchases it has sent, in the notes of a hidden manual account named "wingspan" in your Monarch account.

The workspace you choose, and whether workspaces are on, stay in the browser's storage for Monarch's site, for each household, until you change them. To open pages in that workspace, Wingspan sets Monarch's own business filter on the page. The sidebar items you hide are kept there too, for every household that signs in to that browser. These stay after Wingspan is uninstalled, until you clear Monarch's site data in the browser. The browser also keeps a cached copy so Wingspan starts fast, kept separately for each Monarch household that signs in, and uninstalling the extension removes it. To remove what's in Monarch too, uninstall Wingspan first, then delete the "wingspan" account: while it's installed, Wingspan makes the account again from its copy. Monarch may keep a deleted account, its notes included, for a time under its own policy.

## Permissions

Wingspan runs on `app.monarch.com` with two permissions: `storage`, for the extension's own storage, and `scripting`, to read store purchases in a tab it opens.

Reading a supported retailer's site (currently `www.walmart.com` and `www.costco.com`) is asked for only when you first sync that store, on Wingspan's own page, and you can say no. With it, Wingspan reads your purchases there in a tab it opens while you're signed in: each one's items, prices, tax, total and how it was paid, never your name, email or address. It sends them only to Monarch, as receipts, and changes nothing on the store's site.

## Contact

Questions go to [GitHub Issues](https://github.com/AxerieSoftware/wingspan/issues).
