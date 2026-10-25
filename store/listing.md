# Store listing

What goes into the Chrome Web Store's form. Edge installs extensions from the Chrome Web Store, so there's no separate Edge Add-ons listing.

## Name

Wingspan for Monarch Money

## Summary

Up to 132 characters, the same as `description` in `wxt.config.ts`.

> A third-party extension that adds features to the Monarch Money web app. Not affiliated with Monarch.

## Description

> Wingspan is a third-party extension that adds features to Monarch Money's web app. Each one shows up on the Monarch page it belongs on, looks like Monarch, and has a small Wingspan mark so you can tell it apart from Monarch's own.
>
> RECURRING
> • Card payments in Monarch's Statements card, showing how much checking can cover on each due date, marked paid once the statement balance is paid off.
> • Manual bills for payments without a fixed date, like a check that gets cashed late. They stay unpaid until the payment clears.
> • A due date on every row, Monarch's included, with each table in date order.
> • Expected income for pay that varies, like client payouts, counted at what you usually take in.
> • Pays toward on Monarch's own expenses: link a loan's payment to the loan, and Wingspan estimates its new balance after each one.
>
> CASH FLOW
> • Projected balances: checking day by day, with recurring income and expenses, bills, everyday spending and card payments.
> • Free cash: how much you can spend from checking today and still keep a minimum balance, split into money set aside for goals and money that's actually free.
> • Credit left: when checking runs low, which cards you'd borrow on (in the order you choose), then your backup accounts.
> • Month-end projection: this month's income and expense bars extended to where the month is headed, bills still due included.
>
> BUDGET AND GOALS
> • Spending averages: a category's 3-month, 12-month and year-to-date averages on Budget, and its average per month on its own page.
> • HSA spending on Budget: how much of each row was paid from your HSA, so medical bills don't read as overspending.
> • Goal planner: how much more you can put toward goals each month, when each goal or debt finishes with an extra, and where its money goes once it's done. Save the amounts to your goals when you're happy with them.
>
> LOANS AND DEBT
> • Loans paid down: how much your loans went down, and its share of your income, beside Monarch's savings rate on Cash Flow and Reports.
> • Interest cost: what your loans and carried card balances cost in interest a day, a month and a year.
> • Update balance: for a loan you track by hand, an estimated new balance after each payment, saved only when you choose to.
>
> ACCOUNTS
> • HSA reimbursements: medical expenses you paid yourself and can still pay back from your HSA, with missing receipts flagged.
>
> TRANSACTIONS
> • Retail receipt sync: your purchases are sent to Monarch as receipts, which Monarch matches and splits like its Amazon and Target receipts.
> • Order items: move a synced order's items between categories, or cross out one you didn't get, and its splits and their amounts follow.
> • Sync status: when your accounts last synced, which ones are behind or need attention, and a button to refresh them all.
> • Transactions to review: how many still need reviewing, on Transactions in the sidebar.
>
> SIDEBAR
> • Workspaces: switch between the household and a business, and supported pages show only that one's money. For households using Monarch's businesses (Plus plan).
> • Sidebar items: hide the pages you don't use from Monarch's sidebar.
>
> YOUR DATA
> Wingspan has no server, analytics or tracking. It talks to Monarch with the session you're already signed into, and to a retailer's site only when you sync receipts from it. It saves its own items in a hidden manual account named "wingspan" in your Monarch account, and changes nothing else unless you ask, like saving a loan's new balance, new goal amounts or an order's splits. It never unlocks Monarch's paid features.
>
> Made by Axerie Software. Not affiliated with or endorsed by Monarch Money.

## Details

| Field | Value |
| --- | --- |
| Category | Productivity → Tools |
| Language | English (United States) |
| Website | https://wingspan.axerie.com |
| Support | https://github.com/AxerieSoftware/wingspan/issues |
| Privacy policy | https://wingspan.axerie.com/privacy/ |
| Visibility for the beta | Unlisted, then public |
| Distribution | United States, since Monarch works in US dollars |
| Payments | Free of charge |

## Images

`npm run screenshots` takes them from the e2e tests' made-up household, never a real account. They show Recurring with Statements and due dates, a manual bill's details, Projected balances, and the Cash and cards dialog.

| Image | Size |
| --- | --- |
| Icon | 128x128 (`public/icon/128.png`) |
| Screenshots (`store/screenshots`) | 1280x800 |
| Small promo tile | 440x280 (`store/promo-tile.png`, from `assets/promo-tile.svg`) |
| Demo video | YouTube upload of `site/public/videos/wingspan-demo.mp4`, recorded by `npm run videos` |

## Privacy practices

**Single purpose:** adds personal finance features to the Monarch Money web app.

**Permissions:**
- `storage`: keeps Wingspan's items and settings so pages load fast, and holds changes that couldn't be saved to Monarch until they can be retried.
- `scripting`: reads Walmart or Costco purchase history in the store tab Wingspan opens for a sync, using the store's own API in that page.
- `https://app.monarch.com/*`: where Wingspan adds its features.
- `https://www.walmart.com/*` and `https://www.costco.com/*` (optional): asked for only when the household first syncs that store.

**Remote code:** No. All code ships in the package.

**Data usage** (boxes to check). The store counts data an extension reads and uses, even only in the browser, so these are checked although nothing reaches Axerie:
- **Financial and payment information:** accounts, transactions, recurring items, budgets, goals and the household's businesses, read from Monarch to show Wingspan's features. With retail receipt sync, each purchase's items, prices, totals and payment method, sent only to Monarch as receipts. With Update balance, the loan balance you save, sent only to Monarch.
- **Website content:** text on Monarch's pages, like row names, dates and the month shown, so Wingspan can place its additions next to Monarch's. Also Monarch's business filter on the page and how Recurring is grouped, so Wingspan can follow them.
- **Authentication information:** Monarch's CSRF cookie, sent only back to Monarch's API with Wingspan's requests, the same way Monarch's web app does. During a Costco sync, the sign-in token Costco's own page sends with its receipts request, kept only in that tab's memory and sent only back to Costco with the same request. Neither is stored or sent anywhere else.
- **Health information:** the medical expenses HSA reimbursements reads from Monarch, to total what's left to pay back from the HSA. They're shown only on the HSA's page.
- **Personally identifiable information:** the signed-in household's ID from Monarch's saved session, used only to keep each household's data apart in this browser. Nothing else from the session is kept, and the ID is never sent anywhere.

**Certifications:** not sold or transferred to third parties, not used for anything outside the single purpose, and not used to determine creditworthiness or for lending.

## Notes for reviewers

The **Test instructions** tab, with no username or password, since Monarch is a paid service and we don't share an account. Up to 500 characters:

> Wingspan needs a paid Monarch Money account at app.monarch.com, with Recurring 2.0 turned on (Settings > Early Access). We can't share one, but each feature page at https://wingspan.axerie.com/features/ has a clip of it running in a made-up household. Its requests go only to Monarch's API, tagged client=wingspan, with GraphQL names prefixed wingspan_. Wingspan is open source, so you can read all of its code at https://github.com/AxerieSoftware/wingspan.
