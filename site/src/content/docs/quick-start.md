---
title: Quick start
description: Install Wingspan and add your first card payment or bill.
---

Wingspan works in Chrome and Edge on Monarch's web app. Firefox and Safari builds are experimental, and the [README](https://github.com/axerieSoftware/wingspan#install) explains how to load each.

## Install

Store listings for the Chrome Web Store and Edge Add-ons are on the way. Until then, build it from source:

```bash
git clone https://github.com/axerieSoftware/wingspan.git
cd wingspan
npm install
npm run build:edge   # or npm run build:chrome for Chrome
```

1. Open `edge://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose `.output/edge-mv3` (or `.output/chrome-mv3`).

## Turn on Recurring 2.0

Wingspan adds to Monarch's newer Recurring page. In Monarch, go to **Settings → Early Access** and turn on **Recurring 2.0**.

## Add a card payment or a bill

1. Open **Recurring** while signed in to Monarch.
2. Choose **Add recurring → Add manually**.
3. Set **Type** to **Card payment** or **Bill**. Wingspan shows its own fields in place of Monarch's.
4. Save. It shows up with Monarch's recurring items, sorted by date.

## Pick what counts as checking

On Cash Flow, open **Edit cash and cards** and choose your checking accounts, which cards count, and how much to keep in checking. Recurring's month summary links there too.

## If something looks off

Open DevTools → **Network** and filter by `client=wingspan` to see every request Wingspan sends to Monarch, and whether Monarch rejected any. If it did, [open an issue](https://github.com/axerieSoftware/wingspan/issues/new/choose).
