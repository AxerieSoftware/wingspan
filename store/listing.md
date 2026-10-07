# Store listing

What goes into the Chrome Web Store and Edge Add-ons forms.

## Name

Wingspan for Monarch Money

## Summary

Up to 132 characters, the same as `description` in `wxt.config.ts`.

> Extended features inside the Monarch Money web app. Not affiliated with Monarch.

## Description

> Wingspan adds features Monarch Money doesn't have yet to its web app. Each one shows up on the Monarch page it belongs on, looks like Monarch, and has a small Wingspan mark so you can tell it apart from Monarch's own.
>
> RECURRING
> • Card payments in Monarch's Statements card, showing how much checking can cover on each due date, marked paid once the statement balance is paid off.
> • Manual bills for payments without a fixed date, like a check that gets cashed late. They stay unpaid until the payment clears.
> • A due date on every row, Monarch's included, with each table in date order.
>
> CASH FLOW
> • Projected balances: checking day by day, with recurring income and expenses, bills, everyday spending and card payments.
> • Free cash: how much you can spend from checking today and still keep a minimum balance, split into money set aside for goals and money that's actually free.
> • Credit left: when checking runs low, which cards you'd use (in the order you choose), then your reserves.
>
> TRANSACTIONS
> • Retail receipt sync: your purchases are sent to Monarch as receipts, which Monarch matches and splits like its Amazon and Target receipts.
>
> SIDEBAR
> • Workspaces: switch between the household and a business, and supported pages show only that one's money. For households using Monarch's businesses (Plus plan).
>
> YOUR DATA
> Wingspan has no server, analytics or tracking. It talks to Monarch with the session you're already signed into, and to a retailer's site only when you sync receipts from it. It saves its own items in a hidden manual account named "wingspan" in your Monarch account. It never unlocks Monarch's paid features.
>
> Made by Axerie Software. Not affiliated with or endorsed by Monarch Money.

## Details

| Field | Value |
| --- | --- |
| Category | Chrome: Tools. Edge: Productivity |
| Language | English (United States) |
| Website | https://wingspan.axerie.com |
| Support | https://github.com/axerieSoftware/wingspan/issues |
| Privacy policy | https://wingspan.axerie.com/privacy/ |
| Visibility for the beta | Unlisted, then public |

## Images

`npm run screenshots` takes them from the e2e tests' made-up household, never a real account. They show Recurring with Statements and due dates, a manual bill's details, Projected balances, and the Cash and cards dialog.

| Image | Size | Store |
| --- | --- | --- |
| Icon | 128x128 (`public/icon/128.png`) | Both |
| Screenshots (`store/screenshots`) | 1280x800 | Both |
| Small promo tile | 440x280 | Chrome |
| Logo | 300x300 | Edge |

## Privacy practices (Chrome)

**Single purpose:** adds personal finance features to the Monarch Money web app.

**Permissions:**
- `storage`: keeps Wingspan's items and settings so pages load fast, and holds changes that couldn't be saved to Monarch until they can be retried.
- `scripting`: reads Walmart or Costco purchase history in the store tab Wingspan opens for a sync, using the store's own API in that page.
- `https://app.monarch.com/*`: where Wingspan adds its features.
- `https://www.walmart.com/*` and `https://www.costco.com/*` (optional): asked for only when the household first syncs that store.

**Remote code:** No. All code ships in the package.

**Data usage** (boxes to check):
- **Financial and payment information:** accounts, transactions, recurring items, budgets, goals and the household's businesses, read from Monarch to show Wingspan's features. With retail receipt sync, each purchase's items, prices, totals and payment method, sent only to Monarch as receipts.
- **Website content:** text on Monarch's pages, like row names, dates and the month shown, so Wingspan can place its additions next to Monarch's. Also Monarch's business filter on the page and how Recurring is grouped, so Wingspan can follow them.
- **Authentication information:** Monarch's CSRF cookie, sent only back to Monarch's API with Wingspan's requests, the same way Monarch's web app does. During a Costco sync, the sign-in token Costco's own page sends with its receipts request, kept only in that tab's memory and sent only back to Costco with the same request. Neither is stored or sent anywhere else.
- **Personally identifiable information:** the signed-in household's ID from Monarch's saved session, used only to keep each household's data apart in this browser. Nothing else from the session is kept, and the ID is never sent anywhere.

**Certifications:** not sold or transferred to third parties, not used for anything outside the single purpose, and not used to determine creditworthiness or for lending.

## Notes for reviewers

> Wingspan runs on app.monarch.com and needs a Monarch Money account with Recurring 2.0 turned on (Settings → Early Access). It adds rows to the Recurring page, a Projected balances card to Cash Flow, and a Sync retailer menu to Transactions → Receipts. Syncing Walmart or Costco first asks for that site on the extension's own page.
>
> Its requests to Monarch's own API are each tagged client=wingspan in their address, and its GraphQL requests are named with a wingspan_ prefix. It reads Monarch's CSRF cookie only to send it back to Monarch with those requests, and Monarch's saved session only for the household's ID. When the household syncs Walmart or Costco, it also calls that store's own API from the store tab it opens, with the session signed in there; for Costco it reuses the sign-in token Costco's page sends with its receipts request, in that tab only. Purchases read there go only to Monarch, as receipts. The source is at https://github.com/axerieSoftware/wingspan.
