import express from 'express';
import { copyFile, readFile, writeFile, rename, mkdir, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
// Where data lived before the desktop app existed; migrated once (see migrateLegacyData).
const LEGACY_DATA_FILE = path.join(__dirname, '..', 'data', 'db.json');

/**
 * One data file shared by `npm run dev` and the desktop app:
 * %APPDATA%\Finance Dashboard\db.json on Windows (~/.config/... elsewhere).
 * DATA_FILE overrides it, e.g. demo data for screenshots.
 */
export function defaultDataFile() {
  if (process.env.DATA_FILE) return path.resolve(process.env.DATA_FILE);
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(base, 'Finance Dashboard', 'db.json');
}

const exists = (file) => access(file).then(() => true, () => false);

/** Copies data/db.json to the shared location the first time; the original is left as a backup. */
async function migrateLegacyData(dbPath) {
  if (process.env.DATA_FILE || (await exists(dbPath)) || !(await exists(LEGACY_DATA_FILE))) return;
  await mkdir(path.dirname(dbPath), { recursive: true });
  await copyFile(LEGACY_DATA_FILE, dbPath);
  console.log(`Copied existing data from ${LEGACY_DATA_FILE} to ${dbPath}`);
}

// ---- JSON file storage -------------------------------------------------

function createStore(dbPath) {
  async function load() {
    try {
      const db = JSON.parse(await readFile(dbPath, 'utf8'));
      return { cards: [], events: [], ...db };
    } catch (err) {
      if (err.code === 'ENOENT') return { cards: [], events: [] };
      throw err;
    }
  }

  async function save(db) {
    await mkdir(path.dirname(dbPath), { recursive: true });
    // Write to a temp file then rename, so a crash mid-write can't corrupt the data.
    const tmp = `${dbPath}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, dbPath);
  }

  // Serialize writes so two quick requests can't overwrite each other.
  let queue = Promise.resolve();
  function mutate(fn) {
    const run = queue.then(async () => {
      const db = await load();
      const result = fn(db);
      await save(db);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  return { load, mutate };
}

// ---- Validation --------------------------------------------------------

const MAX_TEXT = 500;
const text = (v) => (v == null ? '' : String(v).trim().slice(0, MAX_TEXT));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const day = (v) => Math.min(31, Math.max(1, Math.round(num(v)) || 1));

const schemas = {
  cards: {
    name: text,
    // Only ever keep the last 4 digits, so a full card number can't be stored by accident.
    last4: (v) => text(v).replace(/\D/g, '').slice(-4),
    balance: num,
    limit: num,
    minPayment: num,
    statementDay: day,
    dueDay: day,
    notes: text,
  },
  events: {
    title: text,
    date: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : ''),
    time: (v) => (/^\d{2}:\d{2}$/.test(text(v)) ? text(v) : ''),
    notes: text,
  },
};
const required = { cards: 'name', events: 'date' };

function clean(name, body, partial) {
  const out = {};
  for (const [key, parse] of Object.entries(schemas[name])) {
    if (partial && !(key in body)) continue;
    out[key] = parse(body[key]);
  }
  return out;
}

// ---- Security ----------------------------------------------------------

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

function hostnameOf(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** Blocks requests from other websites (DNS rebinding, cross-site requests, framing). */
function localOnly(req, res, next) {
  // DNS rebinding: a malicious site can point its own domain at 127.0.0.1. The Host header
  // still carries that domain, so only accept requests addressed to localhost itself.
  if (!LOCAL_HOSTNAMES.has(req.hostname)) {
    return res.status(403).json({ error: 'Forbidden host' });
  }
  // Cross-site requests: browsers send Origin / Sec-Fetch-Site; reject anything not from this app.
  const origin = req.get('origin');
  if ((origin && !LOCAL_HOSTNAMES.has(hostnameOf(origin))) || req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site request blocked' });
  }
  next();
}

function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // React sets inline widths on the utilization bars
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
}

function requireJson(req, res, next) {
  if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Expected application/json' });
  }
  next();
}

// ---- Routes ------------------------------------------------------------

function collection(name, store) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    res.json((await store.load())[name]);
  });

  router.post('/', async (req, res) => {
    const item = { id: randomUUID(), ...clean(name, req.body ?? {}, false) };
    if (!item[required[name]]) {
      return res.status(400).json({ error: `${required[name]} is required` });
    }
    await store.mutate((db) => db[name].push(item));
    res.status(201).json(item);
  });

  router.put('/:id', async (req, res) => {
    const changes = clean(name, req.body ?? {}, true);
    const updated = await store.mutate((db) => {
      const i = db[name].findIndex((x) => x.id === req.params.id);
      if (i === -1) return null;
      db[name][i] = { ...db[name][i], ...changes };
      return db[name][i];
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const removed = await store.mutate((db) => {
      const before = db[name].length;
      db[name] = db[name].filter((x) => x.id !== req.params.id);
      return db[name].length < before;
    });
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });

  return router;
}

export function createApp(dbPath) {
  const store = createStore(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnly, securityHeaders);

  const api = express.Router();
  api.use((_req, res, next) => (res.set('Cache-Control', 'no-store'), next()));
  api.use(requireJson, express.json({ limit: '50kb' }));
  api.use('/cards', collection('cards', store));
  api.use('/events', collection('events', store));
  app.use('/api', api);

  // Serve the built frontend (after `vite build`), so one server runs the whole app.
  app.use(express.static(DIST_DIR));

  // Never send stack traces or file paths to the browser.
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : 'Bad request' });
  });

  return app;
}

/** Starts the server on 127.0.0.1 only, so nothing else on your network can reach it. Port 0 = any free port. */
export async function startServer({ port = 3001, dataFile = defaultDataFile() } = {}) {
  await migrateLegacyData(dataFile);
  const app = createApp(dataFile);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      console.log(`Server running at ${url} (data: ${dataFile})`);
      resolve({ server, url, dataFile });
    });
    server.on('error', reject);
  });
}

// Run directly with `node server/index.js` (used by `npm run dev` and `npm start`).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer({ port: Number(process.env.PORT) || 3001 });
}
