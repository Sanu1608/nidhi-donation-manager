# Nidhi — Charity & Donation Management

*Nidhi* (Hindi: fund, treasury) is a small, complete donation-management
system built for a fundraising drive: donors, campaigns, donations with
auto-generated receipts, fund utilization tracking, and a donor
communication log.

## Running it (no setup required)

You need only [Node.js](https://nodejs.org) installed — nothing else.

```bash
node server.js
```

Then open **http://localhost:3000** in a browser. That's it — there is no
`npm install` step, because the app has zero external dependencies (see
"Why no dependencies" below).

To reset the data back to the original demo seed at any time:

```bash
node seed.js
```

Data is stored in `data/db.json`, a plain file. Delete it and restart the
server to regenerate the seed data from scratch.

## The business process this models

A donation drive, end to end:

1. **Donors** register (individuals or organizations) — name, contact
   details, and PAN for tax receipts.
2. **Campaigns** are created with a title, category, fundraising goal, and a
   start/end window.
3. A **donation** is recorded against a donor and a campaign. This is the
   moment with the most business logic attached to it:
   - A sequential **receipt number** (`REC-2026-0001`, …) is issued
     automatically and a printable receipt is generated.
   - A **"Thank You" communication is auto-logged** for the donor — this
     mirrors how a real charity acknowledges every gift without someone
     having to remember to do it manually.
   - If the donation brings a campaign's total to its goal, the campaign is
     automatically marked **Completed**.
4. **Fund utilization** is logged separately from fundraising — how the
   money raised was actually spent (category, amount, description). This
   is deliberately a distinct step from "raised", because a real charity
   has to account for both sides: what came in, and what went out. The
   dashboard highlights any campaign where utilization has overtaken what
   was actually raised, rather than blocking it — that situation happens in
   practice (e.g. bridge-funded expenses) and should be visible, not hidden.
5. **Donor communications** — thank-you notes (automatic) plus manually
   logged updates and appeals — are kept as a simple timeline per donor.

The **Dashboard** ties it together: total raised, total utilized, balance,
donor count, active campaigns, campaign-by-campaign progress bars, and a
recent-activity feed.

## Key design decisions (useful for the walkthrough)

- **Derived totals, not stored totals.** A campaign's `raised_amount`,
  `utilized_amount`, and a donor's lifetime total are *never* stored as a
  separate field — they are computed live from the donation/utilization
  ledger every time (`helpers.js`). This was a deliberate choice: it makes
  the donation ledger the single source of truth and makes it impossible
  for a total to drift out of sync with the underlying records, which is a
  real bug class in naive donation-tracking systems.
- **Receipts and thank-yous are side effects of recording a donation**, not
  separate manual steps — because in the real process they always happen
  together.
- **Deletion is guarded, not free.** A donor or campaign with donation
  history can't be deleted outright (the API returns `409 Conflict`) — you
  close a campaign or keep the donor record rather than losing the
  financial trail. Only donors/campaigns with no history can be removed.
- **Zero dependencies, by design.** The backend uses a small (~150 line)
  hand-rolled HTTP router (`mini-http.js`) instead of Express, and the
  frontend is plain HTML/CSS/JS instead of a framework with a build step.
  For a live demo on a laptop that may or may not have internet or a clean
  npm cache, "just run `node server.js`" is a meaningfully more reliable
  demo than "run a build, then start a dev server."

## Project structure

```
server.js            entry point — wires up routes and static file serving
mini-http.js          tiny dependency-free Express-like router
db.js                 file-based data store (data/db.json) + seed data
helpers.js            derived totals (raised, utilized, donor lifetime giving)
routes/
  donors.js           donor CRUD
  campaigns.js        campaign CRUD
  donations.js        record donations, auto receipt + thank-you, printable receipt
  utilizations.js      log fund utilization against a campaign
  communications.js    donor communication log
  dashboard.js         aggregate stats for the dashboard
public/
  index.html          SPA shell
  css/style.css        styling
  js/app.js            all frontend view logic (vanilla JS, no build step)
```

## Possible extensions (if asked "what would you add next?")

- Authentication/roles (coordinator vs. read-only viewer)
- Recurring/pledge donations
- Email delivery of receipts and thank-you notes (currently logged, not sent)
- Export donations/utilization to CSV for accounting
- Swapping `db.js`'s file storage for a real database — the rest of the app
  would not need to change, since every route only talks to `db.load()` /
  `db.save()`.
