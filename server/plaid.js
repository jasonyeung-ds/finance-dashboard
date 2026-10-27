// Plaid bank connections: link a bank, pull credit card data (Liabilities), and disconnect.
// Access tokens never leave this file's process: they're encrypted on disk and never sent to the page.
import express from 'express';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import plaid from 'plaid';
import { decryptSecret, encryptSecret } from './secure.js';

const { Configuration, PlaidApi, PlaidEnvironments } = plaid;

export function plaidConfig() {
  const env = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  return { env, clientId, secret, configured: Boolean(clientId && secret && PlaidEnvironments[env]) };
}

/** Plaid errors carry the request (including your secret) inside them, so only ever pass on this. */
function plaidError(err) {
  const data = err?.response?.data;
  if (data?.error_code) {
    return { code: data.error_code, message: data.display_message || data.error_message || data.error_code };
  }
  return { code: 'UNKNOWN', message: err?.message === 'Windows encryption failed' ? err.message : 'Could not reach Plaid' };
}

const dayOf = (date) => (/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? Number(date.slice(8, 10)) : null);

/** Turns a /liabilities/get response into card fields this app understands. */
export function creditCardsFrom({ accounts = [], liabilities }) {
  const details = new Map((liabilities?.credit ?? []).map((c) => [c.account_id, c]));
  return accounts
    .filter((a) => a.type === 'credit')
    .map((a) => {
      const d = details.get(a.account_id) ?? {};
      return {
        plaidAccountId: a.account_id,
        name: a.official_name || a.name || 'Credit card',
        last4: String(a.mask ?? '').replace(/\D/g, '').slice(-4),
        balance: a.balances?.current ?? 0,
        limit: a.balances?.limit ?? 0,
        minPayment: d.minimum_payment_amount ?? 0,
        dueDay: dayOf(d.next_payment_due_date),
        statementDay: dayOf(d.last_statement_issue_date),
        nextDueDate: d.next_payment_due_date ?? null,
        lastStatementBalance: d.last_statement_balance ?? null,
        isOverdue: Boolean(d.is_overdue),
      };
    });
}

// Fields that come from the bank. The rest (your name for the card, notes) stays yours.
const SYNCED_FIELDS = ['last4', 'balance', 'limit', 'minPayment', 'nextDueDate', 'lastStatementBalance', 'isOverdue'];
const LINK_FIELDS = ['source', 'plaidItemId', 'plaidAccountId', 'institution', 'lastSynced', ...SYNCED_FIELDS.slice(4)];

/** Adds or updates cards from one bank connection. Returns how many cards it touched. */
export function applySync(db, item, synced, now = new Date().toISOString()) {
  for (const s of synced) {
    let card = db.cards.find((c) => c.plaidAccountId === s.plaidAccountId);
    if (!card) {
      card = { id: randomUUID(), name: s.name, notes: '', dueDay: 1, statementDay: 1 };
      db.cards.push(card);
    }
    for (const f of SYNCED_FIELDS) card[f] = s[f];
    // Keep the previous day if the bank didn't report one this time.
    card.dueDay = s.dueDay ?? card.dueDay;
    card.statementDay = s.statementDay ?? card.statementDay;
    Object.assign(card, {
      source: 'plaid',
      plaidItemId: item.itemId,
      plaidAccountId: s.plaidAccountId,
      institution: item.institution,
      lastSynced: now,
    });
  }
  return synced.length;
}

/** Disconnecting keeps the cards (with their last values) as normal manual cards. */
export function unlinkCards(db, itemId) {
  for (const card of db.cards) {
    if (card.plaidItemId !== itemId) continue;
    for (const f of LINK_FIELDS) delete card[f];
  }
}

// ---- Saved connections (plaid-items.json, next to db.json) -------------

function createItemStore(file) {
  async function load() {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return { items: [] };
      throw err;
    }
  }
  let queue = Promise.resolve();
  function mutate(fn) {
    const run = queue.then(async () => {
      const data = await load();
      const result = await fn(data);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(data, null, 2));
      await rename(`${file}.tmp`, file);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }
  return { load, mutate };
}

// What the page is allowed to see about a connection: never the token.
const publicItem = ({ itemId, institution, createdAt, lastSynced, lastError }) => ({
  itemId,
  institution,
  createdAt,
  lastSynced,
  lastError,
});

// ---- Routes ------------------------------------------------------------

export function plaidRouter({ store, dataFile }) {
  const config = plaidConfig();
  const items = createItemStore(path.join(path.dirname(dataFile), 'plaid-items.json'));
  const client = config.configured
    ? new PlaidApi(
        new Configuration({
          basePath: PlaidEnvironments[config.env],
          baseOptions: { headers: { 'PLAID-CLIENT-ID': config.clientId, 'PLAID-SECRET': config.secret } },
        }),
      )
    : null;

  const router = express.Router();

  router.use((req, res, next) => {
    if (req.path === '/status' || client) return next();
    res.status(400).json({ error: 'Plaid is not set up. Add your keys to the .env file and restart.' });
  });

  router.get('/status', async (_req, res) => {
    const { items: list } = await items.load();
    res.json({ configured: config.configured, env: config.env, items: list.map(publicItem) });
  });

  router.post('/link-token', async (_req, res) => {
    try {
      const { data } = await client.linkTokenCreate({
        user: { client_user_id: 'local-user' },
        client_name: 'Finance Dashboard',
        products: ['liabilities'],
        country_codes: ['US'],
        language: 'en',
      });
      res.json({ linkToken: data.link_token });
    } catch (err) {
      res.status(502).json({ error: plaidError(err).message });
    }
  });

  async function syncItem(item) {
    try {
      const accessToken = await decryptSecret(item.token);
      const { data } = await client.liabilitiesGet({ access_token: accessToken });
      const synced = creditCardsFrom(data);
      const now = new Date().toISOString();
      await store.mutate((db) => applySync(db, item, synced, now));
      return { lastSynced: now, lastError: null };
    } catch (err) {
      const { code, message } = plaidError(err);
      return { lastError: code === 'ITEM_LOGIN_REQUIRED' ? 'The bank needs you to reconnect.' : message };
    }
  }

  router.post('/exchange', async (req, res) => {
    const publicToken = typeof req.body?.publicToken === 'string' ? req.body.publicToken : '';
    const institution = String(req.body?.institution ?? 'Bank').trim().slice(0, 100) || 'Bank';
    if (!publicToken) return res.status(400).json({ error: 'publicToken is required' });
    try {
      const { data } = await client.itemPublicTokenExchange({ public_token: publicToken });
      const item = {
        itemId: data.item_id,
        institution,
        token: await encryptSecret(data.access_token),
        createdAt: new Date().toISOString(),
      };
      Object.assign(item, await syncItem(item));
      await items.mutate((all) => {
        all.items = all.items.filter((i) => i.itemId !== item.itemId).concat(item);
      });
      res.status(201).json(publicItem(item));
    } catch (err) {
      res.status(502).json({ error: plaidError(err).message });
    }
  });

  router.post('/sync', async (_req, res) => {
    const updated = await items.mutate(async (all) => {
      for (const item of all.items) Object.assign(item, await syncItem(item));
      return all.items.map(publicItem);
    });
    res.json({ items: updated });
  });

  router.delete('/items/:itemId', async (req, res) => {
    const { items: list } = await items.load();
    const item = list.find((i) => i.itemId === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Not found' });
    try {
      // Tell Plaid first: this revokes the token and, on paid plans, stops the monthly fee.
      await client.itemRemove({ access_token: await decryptSecret(item.token) });
    } catch (err) {
      const { code, message } = plaidError(err);
      // Already gone on Plaid's side: safe to forget locally too.
      if (!['ITEM_NOT_FOUND', 'INVALID_ACCESS_TOKEN'].includes(code)) {
        return res.status(502).json({ error: `Could not disconnect: ${message}` });
      }
    }
    await items.mutate((all) => {
      all.items = all.items.filter((i) => i.itemId !== item.itemId);
    });
    await store.mutate((db) => unlinkCards(db, item.itemId));
    res.status(204).end();
  });

  return router;
}
