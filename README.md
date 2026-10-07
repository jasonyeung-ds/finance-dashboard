# Finance Dashboard

A local dashboard for tracking credit card balances, statement/due dates, and important dates.

Everything runs on your machine. Data is stored in `data/db.json` (git-ignored), and the
server only listens on `127.0.0.1`, so nothing is reachable from your network.

## Run it

```bash
npm install     # first time only
npm run dev     # then open http://127.0.0.1:5173
```

`npm start` builds the app and serves everything from a single server at http://127.0.0.1:3001.

## Features

- **Credit cards**: balance, limit, minimum payment, and the day of the month the statement
  closes and the payment is due. Shows each card's next dates and utilization.
- **Summary**: total balance, total limit, overall utilization, and the next payment due.
- **Important dates**: anything with a date and optional time. Split into upcoming and past.
- **Next 30 days**: one timeline that combines payments, statement closings, and your dates.

## Notes

- Currently hosted locally
- Manual input for credit card information (Balance, limit, minimum payment)
- Idea to expand to using Plaid API to grab credit card information
- Expand from only website to website and app
- Evaluate hosting options
- Optimization/Bug fixes