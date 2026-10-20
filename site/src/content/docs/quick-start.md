---
title: Quick start
description: Install Wingspan and add your first card payment or bill.
---

Wingspan works in Chrome and Edge on Monarch's web app. Firefox and Safari builds are experimental; the [README](https://github.com/AxerieSoftware/wingspan#install) explains how to load them.

## Install

[Add Wingspan from the Chrome Web Store](https://chromewebstore.google.com/detail/jpbbafooilhlohnnmioddafboidfjepn), in Chrome or Edge. The first time, Edge asks you to allow extensions from other stores.

To try changes before they're released, build it from source instead:

```bash
git clone https://github.com/AxerieSoftware/wingspan.git
cd wingspan
npm install
npm run build:edge   # or npm run build:chrome for Chrome
```

1. Open `edge://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose `.output/edge-mv3` (or `.output/chrome-mv3`).

## Turn on Recurring 2.0

Wingspan adds to Monarch's newer Recurring page. In Monarch, go to **Settings → Early Access** and turn on **Recurring 2.0**. If **Recurring** in the sidebar still opens the older page, open [app.monarch.com/recurring-v2](https://app.monarch.com/recurring-v2/monthly) and bookmark it.

## Add a card payment, bill or income

1. Open **Recurring** while signed in to Monarch.
2. Choose **Add recurring → Add manually**.
3. Set **Type** to **Card payment**, **Bill** or **Income**. Wingspan shows its own fields in place of Monarch's.
4. Save. It shows up with Monarch's recurring items, sorted by date.

## Pick what counts as checking

On Cash Flow, open **Edit cash and cards** and choose your checking accounts, which cards to borrow on, and how much to keep in checking. Until you save, Wingspan uses accounts named "checking" and treats your other cash accounts as backup. Recurring's month summary links there too.

## Set up Monarch for accurate numbers

- Categorize credit card payments and moves between your own accounts as **Transfer**, so they aren't counted as spending.
- Add each card's credit limit, and APR if you carry a balance, in its details in Monarch.

## If something looks off

Open DevTools → **Network** and filter by `client=wingspan` to see every request Wingspan sends to Monarch and whether any were rejected. If one was, [open an issue](https://github.com/AxerieSoftware/wingspan/issues/new/choose).
