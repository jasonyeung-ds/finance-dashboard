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

## Your data

The desktop app and `npm run dev` share one file: `%APPDATA%\Finance Dashboard\db.json`.
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

