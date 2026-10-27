# Finance Dashboard

| Overview | Calendar |
|---|---|
| ![Overview tab showing card totals, utilization, and upcoming card dates](docs/screenshot.png) | ![Calendar tab showing payment, statement, and important dates for the month](docs/calendar.png) |

*Screenshots use made-up example data.*

A local dashboard for tracking credit card balances, statement/due dates, and important dates.

Everything runs on your machine. Data is stored in `%APPDATA%\Finance Dashboard\db.json`
(outside the repo), and the server only listens on `127.0.0.1`, so nothing is reachable from your network.

## Tech stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express (local server on 127.0.0.1)
- **Desktop app:** Electron, packaged with electron-builder
- **Storage:** JSON file in `%APPDATA%\Finance Dashboard\db.json`

  
## Desktop app (.exe)

```bash
npm run dist:win
```

This creates two files in `release/`:

- `Finance Dashboard Setup <version>.exe`: installer with Start menu and desktop shortcuts
- `Finance Dashboard-<version>-portable.exe`: single file you can run without installing

The app isn't code-signed, so Windows SmartScreen will warn the first time.
Click **More info → Run anyway**. To try the desktop app without packaging, run `npm run app`.

## Run it in the browser (development)

```bash
npm install     # first time only
npm run dev     # then open http://127.0.0.1:5173
```

`npm start` builds the app and serves everything from a single server at http://127.0.0.1:3001.

## Bank connections (Plaid, optional)

Plaid can pull each card's balance, limit, minimum payment, and statement and due dates
straight from your bank. Manual cards keep working alongside bank-synced ones.

1. Create a free account at [dashboard.plaid.com](https://dashboard.plaid.com/signup) and
   copy your **client ID** and **Sandbox secret** from *Developers → Keys*.
2. Copy `.env.example` to `.env` and fill in the keys:
   - for `npm run dev`: in this project folder
   - for the desktop app: in `%APPDATA%\Finance Dashboard\`
3. Restart the app, open **Manage → Bank connections → Connect a bank**.
   In Sandbox, pick any bank and log in with `user_good` / `pass_good` (Plaid's test login).

Bank-synced cards update when the app opens (if the last sync was over an hour ago) or when
you click **Sync now**. You can rename them and edit notes; everything else comes from the bank.
**Disconnect** revokes the connection with Plaid and keeps the cards as manual cards.

Sandbox is free and uses fake data. Using real banks needs Plaid's Trial or paid plan
(`PLAID_ENV=production` and a production secret). Banks that log in through their own
website (OAuth) aren't supported yet.

## Your data

The desktop app and `npm run dev` share one file: `%APPDATA%\Finance Dashboard\db.json`.
Bank connections are saved next to it in `plaid-items.json`.
Paste that path into File Explorer's address bar to find it. Copy it somewhere safe to back up.
Uninstalling the app does not delete it.

If an older `data/db.json` exists in the project, it's copied to the new location once.
The original is left in place as a backup.

## Security

- The server only accepts connections from this computer (`127.0.0.1`).
- Requests from other websites are rejected. That includes DNS rebinding, cross-site
  requests, and loading the app inside another page's frame.
- A strict Content Security Policy only allows the app's own scripts.
- The desktop window runs with Electron's recommended lockdown (sandbox, context isolation,
  no Node.js in the page), can't navigate to other sites, and denies all device permissions.
- Plaid keys live only in `.env` (git-ignored and never packaged into the `.exe`).
- Plaid access tokens are encrypted with Windows DPAPI, so only your Windows account can
  read them. They are never sent to the page or written to logs, and are kept out of `db.json`.
- Your bank password is entered in Plaid's own window. This app never sees it.
- Only the last 4 digits of a card number are ever stored. **Don't put full card numbers or
  passwords in Notes.** The data file is not encrypted.

## Features

The app has three tabs:

- **Overview**: total balance, total credit limit, overall utilization, and the next payment
  due, plus each card's balance, utilization, available credit, minimum payment, and next
  statement and due dates, and a list of upcoming card dates.
- **Calendar**: a month view with every card's payment due date and statement closing date
  (repeated each month) and your important dates. Click a day to see its details.
- **Manage**: add, edit, and delete cards and important dates (with optional times).

## Roadmap

- [x] Manual entry for card balance, limit, and minimum payment
- [x] Combined 30-day timeline for payments, statements, and important dates
- [x] Calendar view with recurring payment and statement dates
- [ ] Pull card data automatically with the Plaid API
- [ ] Demo mode with sample data, so it can be hosted publicly
- [ ] Deploy a live demo
- [ ] Mobile app version
- [ ] Performance improvements and bug fixes

